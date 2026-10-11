import SwiftUI
import AuthenticationServices

// MARK: - Cards

/// A guest's initial in a soft circle, standing in for a profile photo.
struct ReviewerAvatar: View {
    let name: String
    var size: CGFloat = 32

    var body: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.appFixed(size: size * 0.45, weight: .semibold))
            .foregroundStyle(Color.accentColor)
            .frame(width: size, height: size)
            .background(Color.brandSoft, in: Circle())
            .accessibilityHidden(true)
    }
}

/// Small gold stars, the same as on the collected reviews.
struct ReviewStars: View {
    let rating: Int

    var body: some View {
        HStack(spacing: 1) {
            ForEach(0..<5, id: \.self) { i in
                Image(systemName: i < rating ? "star.fill" : "star")
            }
        }
        .font(.system(size: 9))
        .foregroundStyle(Color.star)
        .accessibilityLabel(LF("%d out of 5 stars", rating))
    }
}

/// Name, date and the "⋯" menu at the top of a guest review.
private struct GuestReviewHeader: View {
    let hotel: Hotel
    let review: GuestReview
    let isMine: Bool
    let onEdit: () -> Void
    let onNote: (String) -> Void

    var body: some View {
        HStack(spacing: 10) {
            ReviewerAvatar(name: review.name)
            VStack(alignment: .leading, spacing: 1) {
                Text(isMine ? L("Your review") : review.name)
                    .font(.app(.subheadline, .semibold))
                    .lineLimit(1)
                HStack(spacing: 4) {
                    ReviewStars(rating: review.rating)
                    if let day = review.day {
                        Text("· \(day)")
                    }
                    if review.isEdited {
                        Text("· \(L("Edited"))")
                    }
                }
                .font(.app(.caption))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            Spacer(minLength: 0)
            GuestReviewMenu(hotel: hotel, review: review, isMine: isMine, onEdit: onEdit, onNote: onNote)
        }
    }
}

/// A guest review in the horizontal carousel, the same size as the collected ones.
struct GuestReviewCard: View {
    let hotel: Hotel
    let review: GuestReview
    var isMine = false
    var onEdit: () -> Void = {}
    var onNote: (String) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            GuestReviewHeader(hotel: hotel, review: review, isMine: isMine, onEdit: onEdit, onNote: onNote)
            if isMine && review.isHidden {
                Label("Hidden after reports while we check it.", systemImage: "eye.slash")
                    .font(.app(.caption, .medium))
                    .foregroundStyle(Color.heart)
            }
            Text(review.body)
                .font(.app(.subheadline))
                .lineLimit(isMine && review.isHidden ? 3 : 4)
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(width: 280, height: 170, alignment: .topLeading)
        .background(Color.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            if isMine {
                RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.accentColor.opacity(0.5), lineWidth: 1.5)
            }
        }
        .fullReviewOnLongPress(review.body) {
            HStack(spacing: 10) {
                ReviewerAvatar(name: review.name)
                VStack(alignment: .leading, spacing: 1) {
                    Text(isMine ? L("Your review") : review.name)
                        .font(.app(.subheadline, .semibold))
                        .lineLimit(1)
                    HStack(spacing: 4) {
                        ReviewStars(rating: review.rating)
                        if let day = review.day { Text("· \(day)") }
                    }
                    .font(.app(.caption))
                    .foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// A guest review as a full-width row in "Show all reviews".
struct GuestReviewRow: View {
    let hotel: Hotel
    let review: GuestReview
    var isMine = false
    var onEdit: () -> Void = {}
    var onNote: (String) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            GuestReviewHeader(hotel: hotel, review: review, isMine: isMine, onEdit: onEdit, onNote: onNote)
            if isMine && review.isHidden {
                Label("Hidden after reports while we check it.", systemImage: "eye.slash")
                    .font(.app(.caption, .medium))
                    .foregroundStyle(Color.heart)
            }
            Text(review.body)
                .font(.app(.subheadline))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 14)
    }
}

/// "⋯" on a guest review: edit or delete your own; report or block anyone else's.
struct GuestReviewMenu: View {
    let hotel: Hotel
    let review: GuestReview
    let isMine: Bool
    let onEdit: () -> Void
    let onNote: (String) -> Void

    @Environment(CommunityStore.self) private var community
    @Environment(\.openURL) private var openURL
    @State private var showReport = false
    @State private var confirmBlock = false
    @State private var confirmDelete = false

    var body: some View {
        Menu {
            if isMine {
                Button(action: onEdit) { Label("Edit review", systemImage: "pencil") }
                Button(role: .destructive) { confirmDelete = true } label: { Label("Delete review", systemImage: "trash") }
            } else {
                Button { showReport = true } label: { Label("Report review", systemImage: "flag") }
                Button(role: .destructive) { confirmBlock = true } label: { Label("Block reviewer", systemImage: "hand.raised") }
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
                Task {
                    await community.block(review)
                    onNote("Reviewer blocked")
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You won’t see their reviews anymore. You can unblock in Settings.")
        }
        .alert("Delete your review?", isPresented: $confirmDelete) {
            Button("Delete", role: .destructive) {
                Task {
                    do {
                        try await community.deleteMine(stayId: hotel.id)
                        onNote("Review deleted")
                    } catch {
                        onNote("Something went wrong. Try again.")
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private func report(_ reason: ReportReason) {
        Task {
            let sent = await community.report(review, reason: reason)
            if !sent {
                // Signed out: the report goes by email instead, like for the collected reviews.
                let body = """
                Stay: \(hotel.name) (#\(hotel.id))
                Guest review: \(review.id.uuidString)
                Reason: \(reason.rawValue)

                Review:
                \(review.body)
                """
                if let url = AppInfo.mailURL(subject: "Review report #\(hotel.id)", body: body) { openURL(url) }
            }
            onNote("Review reported")
        }
    }
}

// MARK: - Write a review

struct WriteReviewSheet: View {
    let hotel: Hotel
    var onDone: (String) -> Void = { _ in }

    @Environment(CommunityStore.self) private var community
    @Environment(\.dismiss) private var dismiss
    @State private var rating = 0
    @State private var text = ""
    @State private var posting = false
    @State private var error: String?
    @State private var renaming = false
    @State private var newName = ""
    @State private var showGuidelines = false
    @State private var confirmDiscard = false
    @FocusState private var focused: Bool

    private static let minLength = 20
    private static let maxLength = 2000
    private var count: Int { text.trimmingCharacters(in: .whitespacesAndNewlines).count }
    private var isEditing: Bool { community.mine(for: hotel.id) != nil }
    private var canPost: Bool { rating > 0 && count >= Self.minLength && count <= Self.maxLength && !posting }
    /// Something typed that isn't saved yet, so closing should ask first.
    private var isDirty: Bool { count > 0 && text != (community.mine(for: hotel.id)?.body ?? "") }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(hotel.name).font(.app(.headline)).lineLimit(2)
                        Text(L(hotel.city)).font(.app(.subheadline)).foregroundStyle(.secondary)
                    }

                    VStack(spacing: 12) {
                        Text("How was your stay?").font(.app(.title3, .bold))
                        StarPicker(rating: $rating)
                        Text(rating == 0 ? L("Tap a star to rate") : L(StarPicker.labels[rating - 1]))
                            .font(.app(.subheadline, .medium))
                            .foregroundStyle(rating == 0 ? .secondary : .primary)
                            .contentTransition(.opacity)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)

                    VStack(alignment: .leading, spacing: 8) {
                        ZStack(alignment: .topLeading) {
                            if text.isEmpty {
                                Text("Tell other guests about the rooms, cleanliness, staff and location.")
                                    .font(.app(.body))
                                    .foregroundStyle(.tertiary)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 8)
                                    .allowsHitTesting(false)
                            }
                            TextEditor(text: $text)
                                .font(.app(.body))
                                .focused($focused)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 170)
                        }
                        .padding(10)
                        .background(Color.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(focused ? Color.accentColor : Color.line, lineWidth: focused ? 1.5 : 1)
                        )
                        HStack {
                            if count < Self.minLength {
                                Text(LF("At least %d characters", Self.minLength))
                            }
                            Spacer()
                            Text(verbatim: "\(count)/\(Self.maxLength)")
                                .monospacedDigit()
                                .foregroundStyle(count > Self.maxLength ? Color.heart : .secondary)
                        }
                        .font(.app(.caption))
                        .foregroundStyle(.secondary)
                    }

                    HStack(spacing: 10) {
                        ReviewerAvatar(name: community.displayName.isEmpty ? L("Guest") : community.displayName, size: 36)
                        Text(LF("Posting as %@", community.displayName.isEmpty ? L("Guest") : community.displayName))
                            .font(.app(.subheadline))
                            .lineLimit(1)
                        Spacer()
                        Button("Change name") {
                            newName = community.displayName
                            renaming = true
                        }
                        .font(.app(.subheadline, .semibold))
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Reviews are public. Don’t share phone numbers or personal details. By posting you agree to the community guidelines.")
                            .font(.app(.footnote))
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        Button("Community guidelines") { showGuidelines = true }
                            .font(.app(.footnote, .semibold))
                    }
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Color.canvas)
            .navigationTitle(isEditing ? L("Edit your review") : L("Write a review"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { if isDirty { confirmDiscard = true } else { dismiss() } }
                        .confirmationDialog("Discard your review?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                            Button("Discard", role: .destructive) { dismiss() }
                            Button("Keep writing", role: .cancel) {}
                        }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if posting {
                        ProgressView()
                    } else {
                        Button(isEditing ? L("Save") : L("Post")) { post() }
                            .fontWeight(.semibold)
                            .disabled(!canPost)
                    }
                }
            }
            .alert("Couldn’t post", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error ?? "")
            }
            .alert("Your name on reviews", isPresented: $renaming) {
                TextField("Your name", text: $newName)
                Button("Save") { Task { try? await community.rename(newName) } }
                Button("Cancel", role: .cancel) {}
            }
            .sheet(isPresented: $showGuidelines) { CommunityGuidelinesView() }
            .sensoryFeedback(.selection, trigger: rating)
        }
        .tint(Color.accentColor)
        .appLayoutDirection()
        .interactiveDismissDisabled(isDirty)
        .onAppear {
            if let mine = community.mine(for: hotel.id) {
                rating = mine.rating
                text = mine.body
            }
        }
    }

    private func post() {
        posting = true
        Task {
            do {
                let wasEditing = isEditing
                try await community.submit(stayId: hotel.id, rating: rating, body: text)
                posting = false
                onDone(wasEditing ? "Review updated" : "Review posted")
                dismiss()
            } catch {
                posting = false
                self.error = error.localizedDescription
            }
        }
    }
}

/// Five big stars; tap one to rate.
struct StarPicker: View {
    @Binding var rating: Int
    static let labels = ["Terrible", "Poor", "Okay", "Good", "Excellent"]

    var body: some View {
        HStack(spacing: 10) {
            ForEach(1...5, id: \.self) { n in
                Button {
                    withAnimation(.snappy) { rating = n }
                } label: {
                    Image(systemName: n <= rating ? "star.fill" : "star")
                        .font(.system(size: 34, weight: .medium))
                        .foregroundStyle(n <= rating ? Color.star : Color.secondary.opacity(0.5))
                        .scaleEffect(n == rating ? 1.12 : 1)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(LF("%d out of 5 stars", n))
                .accessibilityAddTraits(n == rating ? .isSelected : [])
            }
        }
    }
}

// MARK: - Sign in

struct SignInSheet: View {
    var onSignedIn: () -> Void = {}

    @Environment(CommunityStore.self) private var community
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @State private var nonce = ""
    @State private var working = false
    @State private var error: String?
    @State private var showGuidelines = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 22) {
                Image(systemName: "text.bubble.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(Color.accentColor)
                    .frame(width: 68, height: 68)
                    .background(Color.brandSoft, in: Circle())
                VStack(spacing: 8) {
                    Text("Sign in to write a review")
                        .font(.app(.title2, .bold))
                        .multilineTextAlignment(.center)
                    Text("Your name will appear on your reviews. We never post anything else.")
                        .font(.app(.subheadline))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                VStack(spacing: 12) {
                    SignInWithAppleButton(.signIn) { request in
                        nonce = CommunityStore.randomNonce()
                        request.requestedScopes = [.fullName]
                        request.nonce = CommunityStore.sha256(nonce)
                    } onCompletion: { result in
                        apple(result)
                    }
                    .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                    .frame(height: 50)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    Button(action: google) {
                        Text("Continue with Google")
                            .font(.app(.body, .semibold))
                            .foregroundStyle(.primary)
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(Color.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.line))
                    }
                    .buttonStyle(.plain)
                }
                .disabled(working)
                .overlay { if working { ProgressView() } }

                if let error {
                    Text(error)
                        .font(.app(.footnote, .medium))
                        .foregroundStyle(Color.heart)
                        .multilineTextAlignment(.center)
                }
                Spacer(minLength: 0)
                VStack(spacing: 4) {
                    Text("By continuing you agree to the community guidelines and privacy policy.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 16) {
                        Button("Community guidelines") { showGuidelines = true }
                        NavigationLink("Privacy policy") { PrivacyPolicyView() }
                    }
                    .fontWeight(.semibold)
                }
                .font(.app(.footnote))
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(Color.canvas)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .sheet(isPresented: $showGuidelines) { CommunityGuidelinesView() }
        }
        .tint(Color.accentColor)
        .appLayoutDirection()
        .presentationDetents([.large])
    }

    private func apple(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                  let data = credential.identityToken,
                  let token = String(data: data, encoding: .utf8) else {
                error = L("Couldn’t sign in. Please try again.")
                return
            }
            run { try await community.signInWithApple(idToken: token, nonce: nonce, fullName: credential.fullName) }
        case .failure(let failure):
            if (failure as? ASAuthorizationError)?.code == .canceled { return }
            error = L("Couldn’t sign in. Please try again.")
        }
    }

    private func google() {
        run { try await community.signInWithGoogle() }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        working = true
        error = nil
        Task {
            do {
                try await work()
                working = false
                dismiss()
                onSignedIn()
            } catch {
                working = false
                if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin { return }
                self.error = L("Couldn’t sign in. Please try again.")
            }
        }
    }
}

// MARK: - Guidelines

struct CommunityGuidelinesView: View {
    @Environment(\.dismiss) private var dismiss
    private let rules = ["guidelines.1", "guidelines.2", "guidelines.3", "guidelines.4", "guidelines.5"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("guidelines.intro")
                        .font(.app(.body))
                        .fixedSize(horizontal: false, vertical: true)
                    ForEach(rules, id: \.self) { key in
                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.accentColor)
                            Text(L(key)).font(.app(.body)).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Text("guidelines.enforcement")
                        .font(.app(.footnote))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(20)
            }
            .background(Color.canvas)
            .navigationTitle("Community guidelines")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .tint(Color.accentColor)
        .appLayoutDirection()
    }
}
