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

    var body: some View {
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
        // Rebuild every screen when the language changes so all text switches at once.
        .id(settings.language)
        .environment(\.locale, settings.language.locale)
        .environment(\.layoutDirection, settings.language.layoutDirection)
        .preferredColorScheme(settings.appearance.colorScheme)
        // Default text style; Thmanyah Sans when the app is in Arabic.
        .font(.app(.body))
    }
}
