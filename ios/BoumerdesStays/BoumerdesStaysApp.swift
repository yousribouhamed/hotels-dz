import SwiftUI

@main
struct BoumerdesStaysApp: App {
    @State private var store = HotelStore()
    @State private var settings = AppSettings()
    @State private var moderation = ModerationStore()
    @State private var community = CommunityStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(settings)
                .environment(moderation)
                .environment(community)
        }
    }
}

struct RootView: View {
    @Environment(HotelStore.self) private var store
    @Environment(AppSettings.self) private var settings

    enum Tab: Hashable { case explore, saved, settings }
    @State private var tab: Tab = .explore
    @State private var onboarding = OnboardingModel()
    @State private var splashDone = false
    /// The app sits slightly enlarged under the opening animation and settles as it is revealed.
    @State private var settled = false

    var body: some View {
        ZStack {
            Group {
                if onboarding.finished {
                    tabs.transition(.asymmetric(insertion: .opacity.combined(with: .scale(scale: 1.04)), removal: .opacity))
                } else {
                    OnboardingView(model: onboarding)
                        .transition(.asymmetric(insertion: .opacity, removal: .opacity.combined(with: .scale(scale: 0.96))))
                }
            }
            // Rebuild every screen when the language changes so all text switches at once.
            .id(settings.language)
            .environment(\.locale, settings.language.locale)
            .environment(\.layoutDirection, settings.language.layoutDirection)
            // Default text style; Thmanyah Sans when the app is in Arabic.
            .font(.app(.body))
            .scaleEffect(settled ? 1 : 1.06)

            if !splashDone {
                SplashOverlay(unhurried: !onboarding.finished) {
                    onboarding.revealed = true
                    withAnimation(.timingCurve(0.65, 0, 0.25, 1, duration: 0.95)) { settled = true }
                } onFinish: {
                    splashDone = true
                }
                .zIndex(1)
            }
        }
        .preferredColorScheme(settings.appearance.colorScheme)
    }

    private var tabs: some View {
        TabView(selection: $tab) {
            ExploreView()
                .tabItem { Label("Explore", systemImage: "magnifyingglass") }
                .tag(Tab.explore)
            SavedView()
                .tabItem { Label("Saved", systemImage: "heart") }
                .badge(store.saved.count)
                .tag(Tab.saved)
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(Tab.settings)
        }
    }
}
