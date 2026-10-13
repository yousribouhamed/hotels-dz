import SwiftUI
import UIKit

// MARK: - Colors
//
// Palette: forest #2A7C13 · leaf #76C457 · cream #FFF8CF · sand #FBE6C2.
// Light mode sits on cream with sand surfaces and forest for actions.
// Dark mode sits on a deep forest-black with leaf for actions, so text keeps its contrast.

private func dynamic(light: UInt32, dark: UInt32) -> Color {
    func ui(_ hex: UInt32) -> UIColor {
        UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
    return Color(UIColor { $0.userInterfaceStyle == .dark ? ui(dark) : ui(light) })
}

extension Color {
    /// Page background: cream softened toward white / deep forest-black.
    static let canvas = dynamic(light: 0xFFFBE5, dark: 0x0E1509)
    /// Fields, chips and tiles: sand / raised forest.
    static let surface = dynamic(light: 0xFCEFD3, dark: 0x1A2614)
    /// Selected or suggested items: a wash of leaf.
    static let brandSoft = dynamic(light: 0xDDEFC9, dark: 0x22371A)
    /// Hairlines and borders.
    static let line = dynamic(light: 0xE8D5AE, dark: 0x2F3F27)
    /// Behind photos while they load and in empty chart bars.
    static let placeholder = dynamic(light: 0xF3E3C2, dark: 0x202C1A)
    /// Text and icons on an accent-filled background.
    static let onAccent = dynamic(light: 0xFFFFFF, dark: 0x0E1509)
    /// Leaf green that stays readable: leaf on dark, forest on light.
    static let good = dynamic(light: 0x2A7C13, dark: 0x76C457)
    static let pinGood = Color(red: 42 / 255, green: 124 / 255, blue: 19 / 255)
    static let star = dynamic(light: 0xB5760F, dark: 0xF2C14E)
    static let heart = Color(red: 0.86, green: 0.25, blue: 0.37)
    static let card = surface
}

func ratingColor(_ rating: Double?) -> Color {
    guard let rating else { return .gray }
    if rating >= 4.5 { return .good }
    if rating >= 4.0 { return .accentColor }
    return .gray
}

// MARK: - Photos

/// Shows a photo bundled with the app ("img/…") or, for newer wilayas, one loaded
/// from the web. Loading, resizing and caching live in `ImagePipeline`.
struct BundlePhoto: View {
    let path: String
    var size: PhotoSize = .full
    @State private var image: UIImage?
    @State private var failed = false

    init(path: String, size: PhotoSize = .full) {
        self.path = path
        self.size = size
        // Photos seen before show immediately, with no placeholder flash.
        _image = State(initialValue: ImagePipeline.shared.cached(path, size: size))
    }

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity.animation(.easeOut(duration: 0.2)))
            } else if failed {
                Image(systemName: "photo")
                    .font(.app(.title2))
                    .foregroundStyle(.tertiary)
            }
        }
        .task(id: path) {
            guard image == nil else { return }
            failed = false
            let loaded = await ImagePipeline.shared.image(path, size: size)
            if Task.isCancelled { return }
            image = loaded
            failed = loaded == nil
        }
    }
}

/// A photo that fills its frame, or an illustration when the stay has no photos.
struct PhotoBox: View {
    let path: String?
    var placeholderText = "No photos yet"
    /// Stay type, so the illustration shows a hotel, a house, a bed or a tent.
    var kind = "Hotel"
    var size: PhotoSize = .full

    var body: some View {
        Rectangle()
            .fill(Color.placeholder)
            .overlay {
                if let path {
                    BundlePhoto(path: path, size: size)
                } else {
                    NoPhoto(text: placeholderText, kind: kind)
                }
            }
            .clipped()
    }
}

/// Empty state for stays without photos: a small landscape in the app palette
/// (sand sky, leaf-green hills, a soft sun) with the stay type in a badge.
/// Captions show only where there's room; thumbnails get the badge alone.
struct NoPhoto: View {
    var text = "No photos yet"
    var kind = "Hotel"

    static func symbol(for kind: String) -> String {
        switch kind {
        case "Guest house": return "house.fill"
        case "Hostel": return "bed.double.fill"
        case "Holiday rental": return "house.lodge.fill"
        case "Aparthotel": return "building.fill"
        case "Resort": return "beach.umbrella.fill"
        case "Camping": return "tent.fill"
        case "Motel": return "car.fill"
        default: return "building.2.fill"
        }
    }

    var body: some View {
        GeometryReader { geo in
            let h = geo.size.height
            let badge = min(max(h * 0.26, 34), 76)
            let showsText = !text.isEmpty && h >= 120
            ZStack {
                LinearGradient(colors: [Color.surface, Color.placeholder], startPoint: .top, endPoint: .bottom)

                // A soft sun, top-left so it never sits under the heart button.
                Circle()
                    .fill(RadialGradient(colors: [Color.star.opacity(0.45), Color.star.opacity(0)],
                                         center: .center, startRadius: 0, endRadius: h * 0.16))
                    .frame(width: h * 0.32, height: h * 0.32)
                    .position(x: geo.size.width * 0.16, y: h * 0.2)

                Hills(phase: 0.35, height: 0.30)
                    .fill(Color.good.opacity(0.18))
                Hills(phase: 0, height: 0.20)
                    .fill(Color.good.opacity(0.30))

                VStack(spacing: max(6, h * 0.03)) {
                    Image(systemName: Self.symbol(for: kind))
                        .font(.system(size: badge * 0.42, weight: .semibold))
                        .foregroundStyle(Color.accentColor)
                        .frame(width: badge, height: badge)
                        .background(Color.canvas, in: Circle())
                        .overlay(Circle().strokeBorder(Color.accentColor.opacity(0.25), lineWidth: 1.5))
                        .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
                    if showsText {
                        Text(L(text))
                            .font(.app(.footnote, .semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                .offset(y: -h * 0.06)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text.isEmpty ? L("No photos") : L(text))
    }
}

/// Rolling hills along the bottom of the no-photo illustration.
private struct Hills: Shape {
    var phase: CGFloat
    var height: CGFloat

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let base = rect.maxY - rect.height * height
        let amp = rect.height * 0.06
        p.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: base))
        let steps = 48
        for i in 0...steps {
            let x = rect.minX + rect.width * CGFloat(i) / CGFloat(steps)
            let t = CGFloat(i) / CGFloat(steps) * .pi * 2.2 + phase * .pi * 2
            p.addLine(to: CGPoint(x: x, y: base - sin(t) * amp))
        }
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

// MARK: - Small pieces

struct RatingRow: View {
    let hotel: Hotel

    var body: some View {
        HStack(spacing: 8) {
            if let rating = hotel.rating {
                Text(rating, format: .number.precision(.fractionLength(1)))
                    .font(.app(.subheadline, .bold))
                    .monospacedDigit()
                    .foregroundStyle(ratingColor(rating))
                    .padding(.horizontal, 7)
                    .frame(height: 24)
                    .background(ratingColor(rating).opacity(0.15), in: RoundedRectangle(cornerRadius: 7))
                Text(hotel.ratingLabel)
                    .font(.app(.subheadline, .semibold))
                Text(hotel.reviewCountText)
                    .font(.app(.subheadline))
                    .foregroundStyle(.secondary)
            } else if let score = hotel.siteScoreText, let count = hotel.siteReviewsText {
                // Booking-site score: shown out of 10 with its site, never mixed with Google stars.
                Text(score)
                    .font(.app(.subheadline, .bold))
                    .monospacedDigit()
                    .padding(.horizontal, 7)
                    .frame(height: 24)
                    .background(Color.surface, in: RoundedRectangle(cornerRadius: 7))
                Text(count)
                    .font(.app(.subheadline))
                    .foregroundStyle(.secondary)
            } else {
                Text("No reviews yet")
                    .font(.app(.subheadline))
                    .foregroundStyle(.secondary)
            }
        }
        .lineLimit(1)
    }
}

struct PriceLabel: View {
    let hotel: Hotel
    var large = false

    var body: some View {
        if let dzd = hotel.lowestDZD {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("from").font(.app(.caption)).foregroundStyle(.secondary)
                Text(Money.dzd(dzd))
                    .font(large ? .app(.title3, .bold) : .app(.headline))
                    .monospacedDigit()
                Text("/night").font(.app(.caption)).foregroundStyle(.secondary)
            }
        } else {
            Text(large ? L("No online price") : L("Price on request"))
                .font(.app(.subheadline))
                .foregroundStyle(.secondary)
        }
    }
}

struct SaveButton: View {
    @Environment(HotelStore.self) private var store
    let hotel: Hotel

    var body: some View {
        let isSaved = store.isSaved(hotel)
        Button {
            withAnimation(.snappy) { store.toggleSaved(hotel) }
        } label: {
            // Outlined heart with a soft fill, so it stays readable on any photo without a white disc.
            ZStack {
                Image(systemName: "heart.fill")
                    .foregroundStyle(isSaved ? Color.heart : .black.opacity(0.3))
                Image(systemName: "heart")
                    .foregroundStyle(.white)
            }
            .font(.system(size: 22, weight: .semibold))
            .shadow(color: .black.opacity(0.35), radius: 3, y: 1)
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
            .contentTransition(.symbolEffect(.replace))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isSaved ? "Remove \(hotel.name) from saved" : "Save \(hotel.name)")
    }
}

struct Chip: View {
    let title: String
    var symbol: String? = nil
    var count: Int? = nil
    let isOn: Bool
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ChipLabel(title: title, symbol: symbol, count: count, isOn: isOn)
                .opacity(isDisabled && !isOn ? 0.4 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled && !isOn)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

struct ChipLabel: View {
    let title: String
    var symbol: String? = nil
    var count: Int? = nil
    var isOn = false
    var showsChevron = false

    var body: some View {
        HStack(spacing: 5) {
            if let symbol {
                Image(systemName: symbol).font(.app(.footnote, .semibold))
            }
            Text(L(title))
            if let count {
                Text("\(count)")
                    .monospacedDigit()
                    .foregroundStyle(isOn ? Color.onAccent.opacity(0.75) : Color.secondary)
            }
            if showsChevron {
                Image(systemName: "chevron.down").font(.app(.caption2, .bold))
            }
        }
        .font(.app(.subheadline, .semibold))
        .lineLimit(1)
        .padding(.horizontal, 14)
        .frame(height: 34)
        .foregroundStyle(isOn ? Color.onAccent : Color.primary)
        .background(isOn ? Color.accentColor : Color.card, in: Capsule())
        .overlay(Capsule().strokeBorder(Color.line.opacity(isOn ? 0 : 0.6), lineWidth: 1))
        .contentShape(Capsule())
    }
}

/// All / Hotels / Hostels switch under the result count. A green pill slides to the choice.
struct StayKindSwitch: View {
    @Binding var kind: StayKind
    @Namespace private var pill

    var body: some View {
        HStack(spacing: 0) {
            ForEach(StayKind.allCases) { option in
                let isOn = option == kind
                Button {
                    withAnimation(.snappy(duration: 0.28)) { kind = option }
                } label: {
                    Text(option.title)
                        .font(.app(.subheadline, .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .foregroundStyle(isOn ? Color.onAccent : Color.primary)
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .background {
                            if isOn {
                                Capsule()
                                    .fill(Color.accentColor)
                                    .matchedGeometryEffect(id: "pill", in: pill)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(3)
        .background(Color.card, in: Capsule())
        .overlay(Capsule().strokeBorder(Color.line.opacity(0.6), lineWidth: 1))
        .sensoryFeedback(.selection, trigger: kind)
    }
}

extension View {
    /// Long-press a review card to read the whole review in a lifted preview, with Copy.
    /// Cards in the carousel cut long reviews short.
    func fullReviewOnLongPress<Header: View>(_ text: String, @ViewBuilder header: @escaping () -> Header) -> some View {
        modifier(FullReviewPreview(text: text, header: header))
    }
}

private struct FullReviewPreview<Header: View>: ViewModifier {
    let text: String
    let header: () -> Header

    func body(content: Content) -> some View {
        content
            .contentShape(.contextMenuPreview, RoundedRectangle(cornerRadius: 16, style: .continuous))
            .contextMenu {
                Button {
                    UIPasteboard.general.string = text
                } label: {
                    Label(L("Copy review"), systemImage: "doc.on.doc")
                }
            } preview: {
                VStack(alignment: .leading, spacing: 12) {
                    header()
                    Text(text)
                        .font(.app(.body))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(20)
                .frame(width: 340, alignment: .topLeading)
                .background(Color.surface)
                .appLayoutDirection()
            }
    }
}

/// Swipeable photos on a list card. Swiping changes the photo; tapping opens the stay.
struct CardPhotoCarousel: View {
    let hotel: Hotel
    @State private var pageID: Int? = 0

    private var page: Int { pageID ?? 0 }

    var body: some View {
        if hotel.photos.count <= 1 {
            PhotoBox(path: hotel.photos.first, kind: hotel.type)
        } else {
            ZStack(alignment: .bottom) {
                // A lazy paging scroll view: only the visible photo (and its neighbour)
                // exists, unlike a page TabView that builds every page up front.
                ScrollView(.horizontal) {
                    LazyHStack(spacing: 0) {
                        ForEach(Array(hotel.photos.enumerated()), id: \.offset) { i, path in
                            PhotoBox(path: path)
                                .containerRelativeFrame([.horizontal, .vertical])
                                .id(i)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.paging)
                .scrollIndicators(.hidden)
                .scrollPosition(id: $pageID)
                .onAppear { prefetch(after: 0) }
                .onChange(of: page) { _, new in prefetch(after: new) }

                LinearGradient(colors: [.clear, .black.opacity(0.35)], startPoint: .top, endPoint: .bottom)
                    .frame(height: 44)
                    .allowsHitTesting(false)

                PageDots(count: hotel.photos.count, current: page)
                    .padding(.bottom, 10)
                    .allowsHitTesting(false)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Photo \(page + 1) of \(hotel.photos.count)")
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: withAnimation { pageID = min(page + 1, hotel.photos.count - 1) }
                case .decrement: withAnimation { pageID = max(page - 1, 0) }
                @unknown default: break
                }
            }
        }
    }

    /// Loads the next photo in the background so the swipe never shows a blank page.
    private func prefetch(after index: Int) {
        let next = hotel.photos.dropFirst(index + 1).prefix(1)
        ImagePipeline.shared.prefetch(Array(next), size: .full)
    }
}

/// Centred page dots. With many photos only five show, and the outer ones shrink.
struct PageDots: View {
    let count: Int
    let current: Int
    var maxVisible = 5

    var body: some View {
        let start = min(max(0, current - maxVisible / 2), max(0, count - maxVisible))
        let end = min(count, start + maxVisible)
        HStack(spacing: 5) {
            ForEach(start..<end, id: \.self) { i in
                let isEdge = count > maxVisible && ((i == start && start > 0) || (i == end - 1 && end < count))
                let size: CGFloat = isEdge ? 4 : 6.5
                // The selected dot stretches into a pill so it stands out.
                Capsule()
                    .fill(.white.opacity(i == current ? 1 : 0.55))
                    .frame(width: i == current ? 18 : size, height: size)
            }
        }
        .shadow(color: .black.opacity(0.3), radius: 2)
        .animation(.snappy, value: current)
    }
}

/// Wilaya picker shown inside the search field and on the map.
struct WilayaMenu: View {
    @Environment(HotelStore.self) private var store
    @Binding var region: String?
    var onChange: () -> Void = {}

    var body: some View {
        Menu {
            Picker("Wilaya", selection: Binding(
                get: { region ?? "" },
                set: { region = $0.isEmpty ? nil : $0; onChange() })) {
                Text("All wilayas").tag("")
                ForEach(store.regions.map(\.name).sorted { L($0).localizedStandardCompare(L($1)) == .orderedAscending }, id: \.self) { name in
                    Text(L(name)).tag(name)
                }
            }
        } label: {
            HStack(spacing: 4) {
                Text(region.map(L) ?? L("All wilayas")).lineLimit(1)
                Image(systemName: "chevron.down").font(.app(.caption2, .bold))
            }
            .font(.app(.subheadline, .semibold))
            .foregroundStyle(Color.accentColor)
            .fixedSize()
            .contentShape(Rectangle())
        }
        .accessibilityLabel(LF("Wilaya, %@", region.map(L) ?? L("all wilayas")))
    }
}

/// Search field with the wilaya picker merged into its trailing edge.
struct SearchWithWilaya: View {
    @Binding var query: String
    @Binding var region: String?
    var onRegionChange: () -> Void = {}
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            // The system placeholder follows the phone's language, not the in-app one,
            // so it's drawn here to sit on the reading side in Arabic too.
            TextField("", text: $query)
                .focused($focused)
                .overlay(alignment: .leading) {
                    if query.isEmpty {
                        Text("Hotel, town or street")
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                            .allowsHitTesting(false)
                    }
                }
                .submitLabel(.search)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
            Rectangle()
                .fill(Color.line)
                .frame(width: 1, height: 22)
            WilayaMenu(region: $region, onChange: onRegionChange)
        }
        .padding(.leading, 14)
        .padding(.trailing, 16)
        .frame(height: 50)
        .background(Color.card, in: Capsule())
        .overlay(Capsule().strokeBorder(focused ? Color.accentColor : Color.line.opacity(0.5), lineWidth: focused ? 1.5 : 1))
        .onTapGesture { focused = true }
    }
}

struct SectionTitle: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(L(text)).font(.app(.title3, .bold))
    }
}

/// Gold laurels either side of the content, for stays rated 4.8 and above.
/// The artwork is one left-hand branch ("Laurel" in the asset catalog), mirrored for the right.
struct Laurels<Content: View>: View {
    var height: CGFloat
    @ViewBuilder var content: Content

    var body: some View {
        HStack(spacing: height * 0.1) {
            branch
            content.environment(\.layoutDirection, direction)
            branch.scaleEffect(x: -1)
        }
        // Keep each branch on its own side in Arabic too.
        .environment(\.layoutDirection, .leftToRight)
    }

    @Environment(\.layoutDirection) private var direction

    private var branch: some View {
        Image("Laurel")
            .resizable()
            .scaledToFit()
            .frame(height: height)
            .accessibilityHidden(true)
    }
}

extension Hotel {
    /// Top-rated on Google: 4.8 or higher.
    var isGuestFavourite: Bool { (rating ?? 0) >= 4.8 }
}
