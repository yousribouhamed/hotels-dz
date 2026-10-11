import SwiftUI
import ObjectiveC

// MARK: - Language

enum AppLanguage: String, CaseIterable, Identifiable {
    case system, en, fr, ar

    var id: Self { self }

    /// Each language named in itself, so people can find theirs whatever the app is showing.
    var nativeName: String {
        switch self {
        case .system: return L("Device language")
        case .en: return "English"
        case .fr: return "Français"
        case .ar: return "العربية"
        }
    }

    /// The localization actually used. "Device language" picks the first supported one in iOS settings.
    var resolved: String {
        if self != .system { return rawValue }
        for code in Locale.preferredLanguages {
            let base = String(code.prefix(2))
            if ["en", "fr", "ar"].contains(base) { return base }
        }
        return "en"
    }

    /// Algerian regional formats; Arabic in Algeria writes Latin digits.
    var locale: Locale {
        switch resolved {
        case "fr": return Locale(identifier: "fr_DZ")
        case "ar": return Locale(identifier: "ar_DZ")
        default: return Locale(identifier: "en_GB")
        }
    }

    var layoutDirection: LayoutDirection { resolved == "ar" ? .rightToLeft : .leftToRight }
}

// MARK: - Appearance

enum Appearance: String, CaseIterable, Identifiable {
    case system, light, dark

    var id: Self { self }

    var title: LocalizedStringKey {
        switch self {
        case .system: return "Automatic"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

// MARK: - Settings store

@Observable
final class AppSettings {
    var language: AppLanguage {
        didSet {
            UserDefaults.standard.set(language.rawValue, forKey: "language")
            Bundle.useLanguage(language.resolved)
        }
    }

    var appearance: Appearance {
        didSet { UserDefaults.standard.set(appearance.rawValue, forKey: "appearance") }
    }

    init() {
        language = AppLanguage(rawValue: UserDefaults.standard.string(forKey: "language") ?? "") ?? .system
        appearance = Appearance(rawValue: UserDefaults.standard.string(forKey: "appearance") ?? "") ?? .system
        Typography.registerFonts()
        Bundle.useLanguage(language.resolved)
    }
}

// MARK: - In-app language switch

/// Looks up a translation in the language chosen in Settings.
/// Use for text held in a `String`; literals in `Text("…")` are translated automatically.
func L(_ key: String) -> String {
    Bundle.main.localizedString(forKey: key, value: key, table: nil)
}

/// Translated format string, e.g. `LF("Show %d stays", 12)`.
func LF(_ key: String, _ args: CVarArg...) -> String {
    String(format: L(key), arguments: args)
}

extension View {
    /// Re-applies the app's direction (right-to-left in Arabic). Sheets don't always inherit it.
    func appLayoutDirection() -> some View {
        environment(\.layoutDirection, Bundle.languageCode == "ar" ? .rightToLeft : .leftToRight)
    }
}

private var languageBundleKey: UInt8 = 0

/// Sends every string lookup on the main bundle to the chosen language's .lproj,
/// so the language changes at once without restarting the app.
private final class LanguageBundle: Bundle, @unchecked Sendable {
    override func localizedString(forKey key: String, value: String?, table tableName: String?) -> String {
        if let bundle = objc_getAssociatedObject(self, &languageBundleKey) as? Bundle {
            return bundle.localizedString(forKey: key, value: value, table: tableName)
        }
        return super.localizedString(forKey: key, value: value, table: tableName)
    }
}

extension Bundle {
    /// The language code in use ("en", "fr" or "ar"), for date formats.
    private(set) static var languageCode = "en"

    static func useLanguage(_ code: String) {
        languageCode = code
        if !(Bundle.main is LanguageBundle) {
            object_setClass(Bundle.main, LanguageBundle.self)
        }
        let bundle = Bundle.main.path(forResource: code, ofType: "lproj").flatMap(Bundle.init(path:))
        objc_setAssociatedObject(Bundle.main, &languageBundleKey, bundle, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        Typography.applyBarAppearance()
    }
}

// MARK: - Screen

struct SettingsView: View {
    @Environment(AppSettings.self) private var settings
    @Environment(ModerationStore.self) private var moderation
    @Environment(CommunityStore.self) private var community
    @Environment(\.openURL) private var openURL
    @State private var showSignIn = false
    @State private var renaming = false
    @State private var newName = ""
    @State private var confirmDelete = false
    @State private var accountNote: String?

    var body: some View {
        @Bindable var settings = settings
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    group("Appearance") {
                        HStack(spacing: 12) {
                            ForEach(Appearance.allCases) { option in
                                AppearanceTile(option: option, isOn: settings.appearance == option) {
                                    withAnimation(.snappy) { settings.appearance = option }
                                }
                            }
                        }
                        .padding(16)
                    }

                    group("Language") {
                        VStack(spacing: 0) {
                            ForEach(Array(AppLanguage.allCases.enumerated()), id: \.element) { i, option in
                                Button {
                                    settings.language = option
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(option.nativeName).foregroundStyle(.primary)
                                            if option == .system {
                                                Text("Follows your iPhone settings")
                                                    .font(.app(.footnote)).foregroundStyle(.secondary)
                                            }
                                        }
                                        Spacer()
                                        if settings.language == option {
                                            Image(systemName: "checkmark")
                                                .font(.app(.body, .semibold))
                                                .foregroundStyle(Color.accentColor)
                                        }
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 14)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(settings.language == option ? .isSelected : [])
                                if i < AppLanguage.allCases.count - 1 {
                                    Divider().overlay(Color.line).padding(.leading, 16)
                                }
                            }
                        }
                    }

                    if community.isAvailable {
                        group("Account") { account }
                    }

                    group("Support & privacy") {
                        VStack(spacing: 0) {
                            NavigationLink { PrivacyPolicyView() } label: {
                                supportRow("Privacy policy", icon: "hand.raised.fill")
                            }
                            .buttonStyle(.plain)
                            Divider().overlay(Color.line).padding(.leading, 52)
                            Button {
                                if let url = AppInfo.mailURL(subject: "Boumerdès Stays", body: "") { openURL(url) }
                            } label: {
                                supportRow("Contact us", icon: "envelope.fill")
                            }
                            .buttonStyle(.plain)
                            if !moderation.hidden.isEmpty || community.blockedCount > 0 {
                                Divider().overlay(Color.line).padding(.leading, 52)
                                HStack(spacing: 14) {
                                    Image(systemName: "eye.slash.fill")
                                        .foregroundStyle(Color.accentColor)
                                        .frame(width: 22)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Blocked reviews")
                                        Text(LF("%d hidden", moderation.hidden.count + community.blockedCount))
                                            .font(.app(.footnote)).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Button("Unblock all") {
                                        withAnimation(.snappy) { moderation.unhideAll() }
                                        Task { await community.unblockAll() }
                                    }
                                        .font(.app(.subheadline, .semibold))
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                            }
                        }
                    }
                }
                .padding(16)
                .padding(.bottom, 24)
            }
            .background(Color.canvas)
            .navigationTitle("Settings")
            .sheet(isPresented: $showSignIn) { SignInSheet() }
            .alert("Your name on reviews", isPresented: $renaming) {
                TextField("Your name", text: $newName)
                Button("Save") { Task { try? await community.rename(newName) } }
                Button("Cancel", role: .cancel) {}
            }
            .alert("Delete your account?", isPresented: $confirmDelete) {
                Button("Delete account", role: .destructive) {
                    Task {
                        do {
                            try await community.deleteAccount()
                            accountNote = L("Account deleted")
                        } catch {
                            accountNote = L("Something went wrong. Try again.")
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your account and all your reviews will be deleted for good.")
            }
            .alert(accountNote ?? "", isPresented: Binding(get: { accountNote != nil }, set: { if !$0 { accountNote = nil } })) {
                Button("OK", role: .cancel) {}
            }
        }
    }

    /// Signed out: one row to sign in. Signed in: your name, sign out, delete account.
    @ViewBuilder
    private var account: some View {
        if community.isSignedIn {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    ReviewerAvatar(name: community.displayName.isEmpty ? L("Guest") : community.displayName, size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(community.displayName.isEmpty ? L("Guest") : community.displayName)
                            .font(.app(.body, .semibold))
                        Text("Shown on your reviews").font(.app(.footnote)).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Change name") {
                        newName = community.displayName
                        renaming = true
                    }
                    .font(.app(.subheadline, .semibold))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                Divider().overlay(Color.line).padding(.leading, 52)
                Button { Task { await community.signOut() } } label: {
                    supportRow("Sign out", icon: "rectangle.portrait.and.arrow.right")
                }
                .buttonStyle(.plain)
                Divider().overlay(Color.line).padding(.leading, 52)
                Button { confirmDelete = true } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "trash").frame(width: 22)
                        Text("Delete account")
                        Spacer()
                    }
                    .foregroundStyle(Color.heart)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        } else {
            Button { showSignIn = true } label: {
                HStack(spacing: 14) {
                    Image(systemName: "person.crop.circle.fill")
                        .foregroundStyle(Color.accentColor)
                        .frame(width: 22)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Sign in")
                        Text("Sign in to post reviews").font(.app(.footnote)).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.forward")
                        .font(.app(.footnote, .semibold))
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private func supportRow(_ title: LocalizedStringKey, icon: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .foregroundStyle(Color.accentColor)
                .frame(width: 22)
            Text(title)
            Spacer()
            Image(systemName: "chevron.forward")
                .font(.app(.footnote, .semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }

    private func group<C: View>(_ title: LocalizedStringKey, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.app(.footnote, .semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .padding(.leading, 16)
            content()
                .background(Color.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }
}

/// A small phone mock-up in each mode, like iOS Display settings.
private struct AppearanceTile: View {
    let option: Appearance
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                preview
                    .frame(width: 64, height: 110)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(isOn ? Color.accentColor : Color.line, lineWidth: isOn ? 2.5 : 1)
                    )
                Text(option.title).font(.app(.subheadline, .medium))
                Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                    .font(.app(.title3))
                    .foregroundStyle(isOn ? Color.accentColor : Color.secondary)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }

    @ViewBuilder
    private var preview: some View {
        switch option {
        case .light: mock(dark: false)
        case .dark: mock(dark: true)
        case .system:
            HStack(spacing: 0) {
                mock(dark: false).frame(width: 32, alignment: .leading).clipped()
                mock(dark: true).frame(width: 32, alignment: .trailing).clipped()
            }
        }
    }

    private func mock(dark: Bool) -> some View {
        let bg = dark ? Color(red: 0.055, green: 0.082, blue: 0.035) : Color(red: 1, green: 0.984, blue: 0.898)
        let card = dark ? Color(red: 0.10, green: 0.15, blue: 0.08) : Color(red: 0.988, green: 0.937, blue: 0.827)
        let accent = dark ? Color(red: 0.46, green: 0.77, blue: 0.34) : Color(red: 0.16, green: 0.49, blue: 0.07)
        return ZStack(alignment: .top) {
            bg
            VStack(alignment: .leading, spacing: 5) {
                RoundedRectangle(cornerRadius: 3).fill(card).frame(height: 30)
                RoundedRectangle(cornerRadius: 2).fill(accent).frame(width: 30, height: 5)
                RoundedRectangle(cornerRadius: 3).fill(card).frame(height: 30)
                RoundedRectangle(cornerRadius: 2).fill(accent.opacity(0.6)).frame(width: 22, height: 5)
            }
            .padding(7)
            .frame(width: 64)
        }
    }
}
