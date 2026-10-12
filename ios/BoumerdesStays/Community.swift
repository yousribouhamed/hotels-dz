import Foundation
import Observation
import CryptoKit
import Supabase

/// The Supabase project behind guest reviews (see supabase/SETUP.md).
/// Paste the values from Supabase → Project Settings → API. The anon key is meant to ship
/// inside apps: the database rules in supabase/schema.sql decide who can read and write what.
/// While these are empty the app works as before, without guest reviews.
enum BackendConfig {
    static let url = ""
    static let anonKey = ""
    static let authRedirect = URL(string: "zalumo://login-callback")!

    static var isConfigured: Bool { !url.isEmpty && !anonKey.isEmpty && URL(string: url) != nil }
}

/// A review written by a guest in the app, as opposed to the collected ones in hotels.json.
struct GuestReview: Codable, Identifiable, Hashable {
    let id: UUID
    let stayId: Int
    let userId: UUID
    var displayName: String?
    var rating: Int
    var body: String
    var lang: String?
    /// Only filled in on your own review, which you can see even when it's hidden after reports.
    var status: String?
    let createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, rating, body, lang, status
        case stayId = "stay_id", userId = "user_id", displayName = "display_name"
        case createdAt = "created_at", updatedAt = "updated_at"
    }

    var isEdited: Bool { updatedAt.timeIntervalSince(createdAt) > 60 }
    var isHidden: Bool { (status ?? "published") != "published" }
    var name: String { displayName.flatMap { $0.isEmpty ? nil : $0 } ?? L("Guest") }

    var day: String? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return Fmt.day(f.string(from: createdAt))
    }
}

/// Why posting failed, in words people can act on. The reasons come from the database checks.
enum ReviewError: LocalizedError {
    case offensive, contactInfo, tooMany, banned, failed

    init(_ error: Error) {
        let text = (error as? PostgrestError)?.message ?? String(describing: error)
        if text.contains("blocked_words") { self = .offensive }
        else if text.contains("contact_info") { self = .contactInfo }
        else if text.contains("rate_limited") { self = .tooMany }
        else if text.contains("banned") { self = .banned }
        else { self = .failed }
    }

    var errorDescription: String? {
        switch self {
        case .offensive: return L("Please remove offensive words and try again.")
        case .contactInfo: return L("Please remove phone numbers, emails and links.")
        case .tooMany: return L("You’ve posted a lot of reviews today. Try again tomorrow.")
        case .banned: return L("Your account can’t post reviews.")
        case .failed: return L("Couldn’t post your review. Check your connection and try again.")
        }
    }
}

/// Guest reviews, the signed-in account, and who you've blocked.
@MainActor
@Observable
final class CommunityStore {
    private(set) var userId: UUID?
    private(set) var displayName = ""
    private(set) var reviewsByStay: [Int: [GuestReview]] = [:]
    private(set) var mineByStay: [Int: GuestReview] = [:]
    /// Reviewers you blocked. Kept on the phone so blocking works signed out, and on your account when signed in.
    private(set) var blocked: Set<UUID>
    /// Guest reviews you reported, hidden on this phone straight away.
    private(set) var hidden: Set<UUID>

    private let client: SupabaseClient?

    var isAvailable: Bool { client != nil }
    var isSignedIn: Bool { userId != nil }

    init() {
        let defaults = UserDefaults.standard
        blocked = Set((defaults.stringArray(forKey: "blockedReviewers") ?? []).compactMap(UUID.init))
        hidden = Set((defaults.stringArray(forKey: "hiddenGuestReviews") ?? []).compactMap(UUID.init))
        if BackendConfig.isConfigured, let url = URL(string: BackendConfig.url) {
            client = SupabaseClient(
                supabaseURL: url,
                supabaseKey: BackendConfig.anonKey,
                options: SupabaseClientOptions(auth: .init(redirectToURL: BackendConfig.authRedirect,
                                                           emitLocalSessionAsInitialSession: true))
            )
            Task { await watchSession() }
        } else {
            client = nil
        }
    }

    // MARK: Reading

    /// Other people's reviews of a stay, newest first, without blocked or reported ones.
    func reviews(for stayId: Int) -> [GuestReview] {
        (reviewsByStay[stayId] ?? []).filter { $0.userId != userId && !blocked.contains($0.userId) && !hidden.contains($0.id) }
    }

    func mine(for stayId: Int) -> GuestReview? { mineByStay[stayId] }

    func load(_ stayId: Int) async {
        guard let client else { return }
        do {
            let list: [GuestReview] = try await client.from("public_reviews").select()
                .eq("stay_id", value: stayId)
                .order("created_at", ascending: false)
                .limit(200)
                .execute().value
            reviewsByStay[stayId] = list
            if let userId {
                let mine: [GuestReview] = try await client.from("reviews")
                    .select("id,stay_id,user_id,rating,body,lang,status,created_at,updated_at")
                    .eq("stay_id", value: stayId)
                    .eq("user_id", value: userId)
                    .limit(1)
                    .execute().value
                mineByStay[stayId] = mine.first.map { var r = $0; r.displayName = displayName; return r }
            }
        } catch {
            // Guest reviews are extra; the collected ones still show if this fails.
        }
    }

    // MARK: Writing

    struct NewReview: Encodable {
        let stay_id: Int, rating: Int, body: String, lang: String
    }
    struct ReviewEdit: Encodable {
        let rating: Int, body: String, lang: String
    }

    /// Posts a review, or saves the changes to yours when you already reviewed this stay.
    func submit(stayId: Int, rating: Int, body: String) async throws {
        guard let client, isSignedIn else { throw ReviewError.failed }
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            if let mine = mineByStay[stayId] {
                try await client.from("reviews")
                    .update(ReviewEdit(rating: rating, body: text, lang: Bundle.languageCode))
                    .eq("id", value: mine.id)
                    .execute()
            } else {
                try await client.from("reviews")
                    .insert(NewReview(stay_id: stayId, rating: rating, body: text, lang: Bundle.languageCode))
                    .execute()
            }
        } catch {
            throw ReviewError(error)
        }
        await load(stayId)
    }

    func deleteMine(stayId: Int) async throws {
        guard let client, let mine = mineByStay[stayId] else { return }
        do {
            try await client.from("reviews").delete().eq("id", value: mine.id).execute()
        } catch {
            throw ReviewError.failed
        }
        mineByStay[stayId] = nil
        reviewsByStay[stayId]?.removeAll { $0.id == mine.id }
    }

    // MARK: Reports and blocks

    struct NewReport: Encodable { let review_id: UUID, reason: String }
    struct NewBlock: Encodable { let blocked_id: UUID }

    /// Sends the report to the moderation queue (signed in) and hides the review on this phone.
    /// Returns false when nobody is signed in, so the caller can offer to report by email instead.
    @discardableResult
    func report(_ review: GuestReview, reason: ReportReason) async -> Bool {
        hidden.insert(review.id)
        saveLocal()
        guard let client, isSignedIn else { return false }
        _ = try? await client.from("review_reports").insert(NewReport(review_id: review.id, reason: reason.code)).execute()
        return true
    }

    func block(_ review: GuestReview) async {
        blocked.insert(review.userId)
        saveLocal()
        guard let client, isSignedIn else { return }
        _ = try? await client.from("user_blocks").insert(NewBlock(blocked_id: review.userId)).execute()
    }

    var blockedCount: Int { blocked.count + hidden.count }

    func unblockAll() async {
        blocked.removeAll()
        hidden.removeAll()
        saveLocal()
        guard let client, let userId else { return }
        _ = try? await client.from("user_blocks").delete().eq("blocker_id", value: userId).execute()
    }

    private func saveLocal() {
        UserDefaults.standard.set(blocked.map(\.uuidString), forKey: "blockedReviewers")
        UserDefaults.standard.set(hidden.map(\.uuidString), forKey: "hiddenGuestReviews")
    }

    // MARK: Account

    /// Sign in with Apple, done natively; Apple shares the name only the first time.
    func signInWithApple(idToken: String, nonce: String, fullName: PersonNameComponents?) async throws {
        guard let client else { return }
        let session = try await client.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: idToken, nonce: nonce))
        if let short = fullName.flatMap(Self.shortName) {
            _ = try? await client.from("profiles").update(["display_name": short]).eq("id", value: session.user.id).execute()
        }
        await signedIn(session.user.id)
    }

    /// Google through Supabase's web sign-in page.
    func signInWithGoogle() async throws {
        guard let client else { return }
        let session = try await client.auth.signInWithOAuth(provider: .google, redirectTo: BackendConfig.authRedirect)
        await signedIn(session.user.id)
    }

    func signOut() async {
        _ = try? await client?.auth.signOut()
        signedOut()
    }

    /// Deletes the account and every review it wrote (the database cascades), then signs out.
    func deleteAccount() async throws {
        guard let client else { return }
        try await client.rpc("delete_my_account").execute()
        try? await client.auth.signOut(scope: .local)
        signedOut()
    }

    func rename(_ name: String) async throws {
        guard let client, let userId else { return }
        let clean = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40))
        guard !clean.isEmpty else { return }
        try await client.from("profiles").update(["display_name": clean]).eq("id", value: userId).execute()
        displayName = clean
        for (stay, var mine) in mineByStay { mine.displayName = clean; mineByStay[stay] = mine }
    }

    private func watchSession() async {
        guard let client else { return }
        for await (_, session) in client.auth.authStateChanges {
            if let id = session?.user.id {
                if id != userId { await signedIn(id) }
            } else if userId != nil {
                signedOut()
            }
        }
    }

    private struct Profile: Decodable { let display_name: String }
    private struct Block: Decodable { let blocked_id: UUID }

    private func signedIn(_ id: UUID) async {
        userId = id
        mineByStay = [:]
        guard let client else { return }
        if let p: Profile = try? await client.from("profiles").select("display_name").eq("id", value: id).single().execute().value {
            displayName = p.display_name
        }
        if let rows: [Block] = try? await client.from("user_blocks").select("blocked_id").execute().value {
            blocked.formUnion(rows.map(\.blocked_id))
            saveLocal()
        }
    }

    private func signedOut() {
        userId = nil
        displayName = ""
        mineByStay = [:]
    }

    /// "Yasmine Benali" → "Yasmine B.", the same rule the database uses for Google names.
    static func shortName(_ name: PersonNameComponents) -> String? {
        let first = name.givenName?.trimmingCharacters(in: .whitespaces) ?? ""
        let last = name.familyName?.trimmingCharacters(in: .whitespaces) ?? ""
        if first.isEmpty { return last.isEmpty ? nil : last }
        return last.isEmpty ? first : "\(first) \(last.prefix(1))."
    }

    // MARK: Sign in with Apple nonce

    static func randomNonce(length: Int = 32) -> String {
        let chars = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var generator = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in chars.randomElement(using: &generator)! })
    }

    static func sha256(_ text: String) -> String {
        SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

extension ReportReason {
    /// The reason as the database stores it.
    var code: String {
        switch self {
        case .spam: return "spam"
        case .offensive: return "offensive"
        case .personal: return "personal"
        case .offTopic: return "offTopic"
        case .other: return "other"
        }
    }
}
