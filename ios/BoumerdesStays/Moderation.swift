import SwiftUI

/// Contact details shown in the app and used for reports.
enum AppInfo {
    /// TODO: replace with the real support address before release (also update the privacy policy page).
    static let supportEmail = "support@zalumo.app"
    static let policyUpdated = "2026-10-11"

    static func mailURL(subject: String, body: String) -> URL? {
        var c = URLComponents()
        c.scheme = "mailto"
        c.path = supportEmail
        c.queryItems = [URLQueryItem(name: "subject", value: subject), URLQueryItem(name: "body", value: body)]
        return c.url
    }
}

/// Why someone reports a review (App Store guideline 1.2).
enum ReportReason: String, CaseIterable, Identifiable {
    case spam = "Spam or fake"
    case offensive = "Offensive or hateful"
    case personal = "Shares personal information"
    case offTopic = "Not about this place"
    case other = "Something else"

    var id: Self { self }
    var title: String { L(rawValue) }
}

/// Reviews hidden on this phone after a report or block. Stored locally only.
@Observable
final class ModerationStore {
    private(set) var hidden: Set<String>

    init() {
        hidden = Set(UserDefaults.standard.stringArray(forKey: "hiddenReviews") ?? [])
    }

    static func key(_ hotel: Hotel, _ r: Hotel.Review) -> String {
        "\(hotel.id)|\(r.d)|\(r.t.prefix(80))"
    }

    func isHidden(_ hotel: Hotel, _ r: Hotel.Review) -> Bool { hidden.contains(Self.key(hotel, r)) }

    func visibleReviews(_ hotel: Hotel) -> [Hotel.Review] {
        CollectedReviews.all(for: hotel).filter { !isHidden(hotel, $0) }
    }

    func hide(_ hotel: Hotel, _ r: Hotel.Review) {
        hidden.insert(Self.key(hotel, r))
        save()
    }

    func unhideAll() {
        hidden.removeAll()
        save()
    }

    private func save() {
        UserDefaults.standard.set(Array(hidden), forKey: "hiddenReviews")
    }
}

/// "⋯" on a review: Report or Block.
struct ReviewActionsMenu: View {
    let hotel: Hotel
    let review: Hotel.Review
    var onDone: (String) -> Void = { _ in }

    @Environment(ModerationStore.self) private var moderation
    @Environment(\.openURL) private var openURL
    @State private var showReport = false
    @State private var confirmBlock = false

    var body: some View {
        Menu {
            Button { showReport = true } label: {
                Label("Report review", systemImage: "flag")
            }
            Button(role: .destructive) { confirmBlock = true } label: {
                Label("Block reviewer", systemImage: "hand.raised")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.app(.subheadline, .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 32, height: 28)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("More options")
        .confirmationDialog("Why are you reporting this review?", isPresented: $showReport, titleVisibility: .visible) {
            ForEach(ReportReason.allCases) { reason in
                Button(reason.title) { report(reason) }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Block this reviewer?", isPresented: $confirmBlock) {
            Button("Block", role: .destructive) {
                withAnimation(.snappy) { moderation.hide(hotel, review) }
                onDone("Reviewer blocked")
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Their review will be hidden on this phone. You can unblock in Settings.")
        }
    }

    private func report(_ reason: ReportReason) {
        let body = """
        Stay: \(hotel.name) (#\(hotel.id))
        Review date: \(review.d)
        Reason: \(reason.rawValue)

        Review:
        \(review.t)
        """
        if let url = AppInfo.mailURL(subject: "Review report #\(hotel.id)", body: body) { openURL(url) }
        // Hide it straight away so the person reporting doesn't keep seeing it.
        withAnimation(.snappy) { moderation.hide(hotel, review) }
        onDone("Review reported")
    }
}

// MARK: - Privacy policy

struct PrivacyPolicyView: View {
    private let sections: [(String, String)] = [
        ("privacy.summary.title", "privacy.summary.body"),
        ("privacy.account.title", "privacy.account.body"),
        ("privacy.device.title", "privacy.device.body"),
        ("privacy.content.title", "privacy.content.body"),
        ("privacy.apps.title", "privacy.apps.body"),
        ("privacy.reports.title", "privacy.reports.body"),
        ("privacy.listings.title", "privacy.listings.body"),
        ("privacy.children.title", "privacy.children.body"),
        ("privacy.changes.title", "privacy.changes.body"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text(LF("Last updated %@", Fmt.day(AppInfo.policyUpdated) ?? AppInfo.policyUpdated))
                    .font(.app(.footnote))
                    .foregroundStyle(.secondary)
                ForEach(sections, id: \.0) { title, body in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(L(title)).font(.app(.headline))
                        Text(L(body))
                            .font(.app(.body))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(L("privacy.contact.title")).font(.app(.headline))
                    Text(L("privacy.contact.body"))
                    Link(AppInfo.supportEmail, destination: URL(string: "mailto:\(AppInfo.supportEmail)")!)
                        .font(.app(.body, .semibold))
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.canvas)
        .navigationTitle("Privacy policy")
        .navigationBarTitleDisplayMode(.inline)
    }
}
