import SwiftUI
import UIKit

// MARK: - Welcome screen
//
// Shown once, on first launch, right after the opening animation: what the app is, the app language
// (Arabic, French, English) and one button that opens Explore with no filters set.
//
// Picture: OnboardingWelcome in Assets.xcassets. `IllustrationSlot` shows a branded placeholder for any
// picture that isn't there.

@Observable
final class OnboardingModel {
    static let key = "onboarded"

    var finished: Bool
    /// The opening animation has started uncovering the screen; the welcome screen animates in from then.
    var revealed = false

    init() {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: Self.key) != nil {
            finished = defaults.bool(forKey: Self.key)
        } else {
            // People who used the app before the welcome screen existed go straight to Explore.
            finished = ["region", "sort", "kind", "savedStays", "language", "stayFilters.v1"]
                .contains { defaults.object(forKey: $0) != nil }
            defaults.set(finished, forKey: Self.key)
        }
    }

    /// Opens Explore with no filters set (every wilaya, every kind of stay) and leaves the welcome screen for good.
    func finish(store: HotelStore) {
        store.region = nil
        store.filters.towns = []
        store.kind = .all
        store.persistSearch()
        UserDefaults.standard.set(true, forKey: Self.key)
        withAnimation(.smooth(duration: 0.7)) { finished = true }
    }
}

struct OnboardingView: View {
    @Bindable var model: OnboardingModel
    @Environment(HotelStore.self) private var store
    @State private var shown = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Image("Wordmark")
                .resizable()
                .scaledToFit()
                .frame(height: 30)
                .foregroundStyle(Color("WordmarkColor"))
                .accessibilityLabel("Zalumo")
                .rise(shown, delay: 0.05)
                .padding(.top, 8)

            // The picture opens through the logo, like the app did a moment ago.
            // The picture is square with content up to its edges, so the slot stays square (as large as fits,
            // centred): the whole picture shows, with no bars and nothing cropped, on any screen height.
            GeometryReader { geo in
                let side = min(geo.size.width, geo.size.height)
                IllustrationSlot(name: "OnboardingWelcome", symbol: "building.2", cornerRadius: 32,
                                 backdrop: Color(red: 205 / 255, green: 250 / 255, blue: 11 / 255))
                    .frame(width: side, height: side)
                    .mask {
                        GrowingMark(width: shown ? hypot(side, side) * 2.8 : 0)
                    }
                    .animation(.timingCurve(0.65, 0, 0.25, 1, duration: 1.1).delay(0.1), value: shown)
                    .frame(width: geo.size.width, height: geo.size.height)
            }
            .frame(minHeight: 150, maxHeight: .infinity)
            .padding(.top, 20)

            Text(L("Find your stay, then call to book."))
                .font(.app(.largeTitle, .bold))
                .fixedSize(horizontal: false, vertical: true)
                .rise(shown, delay: 0.25)
                .padding(.top, 24)

            HStack(spacing: 8) {
                StatChip(symbol: "bed.double.fill", text: LF("%d stays", store.hotels.count))
                StatChip(symbol: "map.fill", text: LF("%d wilayas", store.regions.count))
            }
            .rise(shown, delay: 0.33)
            .padding(.top, 14)

            Text(L("Free, and no account needed."))
                .font(.app(.body))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .rise(shown, delay: 0.4)
                .padding(.top, 14)

            LanguagePills()
                .rise(shown, delay: 0.48)
                .padding(.top, 22)

            Button { model.finish(store: store) } label: {
                Label(L("Let’s go"), systemImage: "arrow.forward")
                    .labelStyle(TrailingIconLabel())
            }
            .buttonStyle(CTAButtonStyle())
            .rise(shown, delay: 0.55)
            .padding(.top, 16)
            .padding(.bottom, 8)
        }
        .padding(.horizontal, 20)
        .background(Color.canvas.ignoresSafeArea())
        .onAppear { if model.revealed { shown = true } }
        .onChange(of: model.revealed) { _, revealed in if revealed { shown = true } }
    }
}

private struct StatChip: View {
    let symbol: String
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: symbol).font(.system(size: 12, weight: .semibold))
            Text(text).font(.app(.subheadline, .semibold))
        }
        .foregroundStyle(Color.good)
        .padding(.horizontal, 12)
        .frame(height: 32)
        .background(Color.brandSoft, in: Capsule())
    }
}

/// The three app languages, each named in itself. Picking one switches the whole app at once.
private struct LanguagePills: View {
    @Environment(AppSettings.self) private var settings

    var body: some View {
        HStack(spacing: 8) {
            ForEach([AppLanguage.ar, .fr, .en]) { lang in
                let on = settings.language.resolved == lang.rawValue
                Button {
                    guard !on else { return }
                    settings.language = lang
                } label: {
                    Text(lang.nativeName)
                        .font(.app(.subheadline, on ? .semibold : .regular))
                        .foregroundStyle(on ? Color.onAccent : Color.primary)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(on ? Color.accentColor : Color.surface, in: Capsule())
                        .overlay(Capsule().strokeBorder(on ? Color.clear : Color.line, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .sensoryFeedback(.selection, trigger: settings.language)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(L("Language"))
    }
}

// MARK: - Shared pieces

/// Where an illustration goes. Until an image named `name` is in Assets.xcassets, a branded placeholder
/// (soft brand colour, a large faint mark and an icon) holds the space, so the layout already looks finished.
struct IllustrationSlot: View {
    let name: String
    let symbol: String
    var cornerRadius: CGFloat = 28
    /// Smaller icon, for small pictures.
    var compact = false
    /// The picture's own background colour. When set, the whole picture is shown (fitted, never cropped) on it.
    var backdrop: Color? = nil

    var body: some View {
        Group {
            if let image = UIImage(named: name) {
                if let backdrop {
                    Image(uiImage: image).resizable().scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(backdrop)
                } else {
                    Image(uiImage: image).resizable().scaledToFill()
                }
            } else {
                placeholder
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }

    private var placeholder: some View {
        GeometryReader { geo in
            ZStack {
                LinearGradient(colors: [Color.brandSoft, Color.surface], startPoint: .topLeading, endPoint: .bottomTrailing)
                ZalumoMark()
                    .fill(Color.good.opacity(0.09))
                    .frame(width: max(geo.size.width, geo.size.height) * 1.1)
                    .rotationEffect(.degrees(-14))
                    .offset(x: geo.size.width * 0.28, y: geo.size.height * 0.22)
                Image(systemName: symbol)
                    .font(.system(size: compact ? 24 : 44, weight: .light))
                    .foregroundStyle(Color.good.opacity(0.55))
                #if DEBUG
                if !compact {
                    Text(verbatim: name)
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .lineLimit(1)
                        .fixedSize()
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.ultraThinMaterial, in: Capsule())
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                        .padding(14)
                }
                #endif
            }
        }
        .accessibilityHidden(true)
    }
}

struct CTAButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.app(.headline, .semibold))
            .foregroundStyle(Color.onAccent)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Color.accentColor, in: Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.92 : 1)
            .animation(.smooth(duration: 0.2), value: configuration.isPressed)
    }
}

/// Title first, icon after it (the arrow points the reading way, also in Arabic).
private struct TrailingIconLabel: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) {
            configuration.title
            configuration.icon.font(.system(size: 15, weight: .bold))
        }
    }
}

private extension View {
    /// Rises a little, sharpens and fades in, after `delay`, once `shown` turns true.
    func rise(_ shown: Bool, delay: Double = 0) -> some View {
        self
            .offset(y: shown ? 0 : 22)
            .opacity(shown ? 1 : 0)
            .blur(radius: shown ? 0 : 6)
            .animation(.smooth(duration: 0.7).delay(delay), value: shown)
    }
}
