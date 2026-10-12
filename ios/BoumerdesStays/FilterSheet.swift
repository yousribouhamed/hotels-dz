import SwiftUI

/// Full filter sheet. Works on a draft copy so the result count on the button
/// updates live, and every option shows how many stays it would leave.
struct FilterSheet: View {
    @Environment(HotelStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var draft = StayFilters()
    @State private var didLoad = false
    @State private var showAllTowns = false

    var body: some View {
        let scope = store.scoped
        let total = store.count(draft, in: scope)

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    if !draft.chips.isEmpty { yourFilters }
                    budget(scope)
                    rating(scope)
                    reviewCount(scope)
                    distance(scope)
                    types(scope)
                    stars(scope)
                    amenities(scope)
                    towns(scope)
                    contact(scope)
                }
                .padding(16)
                .padding(.bottom, 12)
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Clear all") { withAnimation(.snappy) { draft = StayFilters() } }
                        .disabled(draft.activeCount == 0)
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    store.filters = draft
                    store.persistSearch()
                    dismiss()
                } label: {
                    Text(total == 0 ? L("No stays match. Loosen a filter") : (total == 1 ? L("Show 1 stay") : LF("Show %d stays", total)))
                        .font(.app(.headline))
                        .frame(maxWidth: .infinity)
                        .contentTransition(.numericText())
                }
                .buttonStyle(.borderedProminent)
                .foregroundStyle(Color.onAccent)
                .controlSize(.large)
                .disabled(total == 0)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.bar)
                .animation(.snappy, value: total)
            }
        }
        .onAppear {
            if !didLoad { draft = store.filters; didLoad = true }
        }
        .presentationDragIndicator(.visible)
        .presentationBackground(Color.canvas)
        .tint(Color.accentColor)
    }

    // MARK: Sections

    private var yourFilters: some View {
        section("Your filters") {
            FlowLayout(spacing: 8) {
                ForEach(draft.chips) { chip in
                    Button {
                        withAnimation(.snappy) { chip.remove(&draft) }
                    } label: {
                        HStack(spacing: 5) {
                            Text(chip.label)
                            Image(systemName: "xmark").font(.app(.caption2, .bold))
                        }
                        .font(.app(.subheadline, .semibold))
                        .padding(.horizontal, 12)
                        .frame(height: 32)
                        .foregroundStyle(Color.accentColor)
                        .background(Color.brandSoft, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove \(chip.label)")
                }
            }
        }
    }

    @ViewBuilder
    private func budget(_ scope: [Hotel]) -> some View {
        let pool = scope.filter { draft.matches($0, store.traits($0), skipping: .price) }
        let prices = pool.compactMap { store.traits($0).dzd }
        let unpriced = pool.count - prices.count
        section("Budget per night",
                subtitle: LF("Only %d of %d stays list an online price. Most take bookings by phone.", scope.compactMap { store.traits($0).dzd }.count, scope.count)) {
            if let lo = prices.min(), let hi = prices.max(), hi > lo {
                let lower = lo / 1000 * 1000
                let upper = (hi + 999) / 1000 * 1000
                let selected = Double(draft.priceMin ?? lower)...Double(draft.priceMax ?? upper)
                let inBudget = prices.filter { selected.contains(Double($0)) }.count
                VStack(alignment: .leading, spacing: 10) {
                    Group {
                        switch inBudget {
                        case 0: Text("No stay in this range yet")
                        case 1: Text("1 stay in your budget")
                        default: Text(LF("%d stays in your budget", inBudget))
                        }
                    }
                    .font(.app(.subheadline))
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText(value: Double(inBudget)))
                    .animation(.snappy, value: inBudget)
                    PriceHistogram(prices: prices, bounds: lower...upper, selected: selected)
                        .frame(height: 56)
                        .environment(\.layoutDirection, .leftToRight)
                    RangeSlider(range: Binding(
                        get: { selected },
                        set: { r in
                            draft.priceMin = Int(r.lowerBound) <= lower ? nil : Int(r.lowerBound)
                            draft.priceMax = Int(r.upperBound) >= upper ? nil : Int(r.upperBound)
                        }),
                        bounds: Double(lower)...Double(upper),
                        step: 500,
                        label: { value, isUpper in
                            let text = Money.format(Int(value))
                            // An open top end reads "24 000+ DZD".
                            guard isUpper, Int(value) >= upper, let gap = text.lastIndex(of: "\u{00A0}") else { return text }
                            return text.replacingCharacters(in: gap...gap, with: "+\u{00A0}")
                        })
                    // Prices read low to high from left to right in every language.
                    .environment(\.layoutDirection, .leftToRight)
                }
            } else {
                Text("Not enough stays with an online price to set a range here.")
                    .font(.app(.subheadline)).foregroundStyle(.secondary)
            }
            Toggle(isOn: $draft.includeUnpriced) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Include stays without an online price")
                    Text("\(unpriced) stays, call them for a price").font(.app(.caption)).foregroundStyle(.secondary)
                }
            }
            .padding(.top, 6)
        }
    }

    private func rating(_ scope: [Hotel]) -> some View {
        let options: [(Double, String)] = [(0, "Any"), (3.5, "3.5+ Good"), (4.0, "4.0+ Very good"), (4.5, "4.5+ Excellent")]
        return section("Guest rating") {
            FlowLayout(spacing: 8) {
                ForEach(options, id: \.0) { value, label in
                    var trial = draft
                    let _ = trial.minRating = value
                    let n = store.count(trial, in: scope)
                    Chip(title: label, count: n, isOn: draft.minRating == value, isDisabled: n == 0) {
                        withAnimation(.snappy) { draft.minRating = value }
                    }
                }
            }
        }
    }

    private func reviewCount(_ scope: [Hotel]) -> some View {
        let options: [(Int, String)] = [(0, "Any"), (10, "10+"), (50, "50+"), (200, "200+")]
        return section("Number of reviews", subtitle: "More reviews make a rating more reliable") {
            FlowLayout(spacing: 8) {
                ForEach(options, id: \.0) { value, label in
                    var trial = draft
                    let _ = trial.minReviews = value
                    let n = store.count(trial, in: scope)
                    Chip(title: label, count: n, isOn: draft.minReviews == value, isDisabled: n == 0) {
                        withAnimation(.snappy) { draft.minReviews = value }
                    }
                }
            }
        }
    }

    private func distance(_ scope: [Hotel]) -> some View {
        let options: [(Double?, String)] = [(nil, "Any"), (1, "1 km"), (3, "3 km"), (5, "5 km"), (10, "10 km")]
        return section("Distance from centre", subtitle: "From Grande Poste in Algiers, and from the town centre in the other wilayas") {
            FlowLayout(spacing: 8) {
                ForEach(options, id: \.1) { value, label in
                    var trial = draft
                    let _ = trial.maxKm = value
                    let n = store.count(trial, in: scope)
                    Chip(title: label, count: n, isOn: draft.maxKm == value, isDisabled: n == 0) {
                        withAnimation(.snappy) { draft.maxKm = value }
                    }
                }
            }
        }
    }

    private func types(_ scope: [Hotel]) -> some View {
        section("Type of stay") {
            FlowLayout(spacing: 8) {
                ForEach(store.types(in: scope), id: \.name) { t in
                    var trial = draft
                    let _ = trial.types = [t.name]
                    let n = store.count(trial, in: scope)
                    let isOn = draft.types.contains(t.name)
                    Chip(title: t.name, count: n, isOn: isOn, isDisabled: n == 0) {
                        withAnimation(.snappy) { toggle(&draft.types, t.name) }
                    }
                }
            }
        }
    }

    private func stars(_ scope: [Hotel]) -> some View {
        let rated = scope.filter { ($0.stars ?? 0) > 0 }.count
        return section("Hotel class", subtitle: LF("Only %d stays here have an official star rating", rated)) {
            FlowLayout(spacing: 8) {
                ForEach(1...5, id: \.self) { s in
                    var trial = draft
                    let _ = trial.stars = [s]
                    let n = store.count(trial, in: scope)
                    Chip(title: String(repeating: "★", count: s), count: n, isOn: draft.stars.contains(s), isDisabled: n == 0) {
                        withAnimation(.snappy) { toggle(&draft.stars, s) }
                    }
                }
            }
        }
    }

    private func amenities(_ scope: [Hotel]) -> some View {
        let listed = scope.filter { !$0.am.isEmpty }.count
        return section("Amenities", subtitle: LF("Only %d of these stays list their amenities, so each one narrows the list a lot", listed)) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(AmenityKey.allCases) { a in
                    let isOn = draft.amenities.contains(a)
                    var trial = draft
                    let _ = trial.amenities.insert(a)
                    let n = store.count(trial, in: scope)
                    Button {
                        withAnimation(.snappy) { toggle(&draft.amenities, a) }
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: a.symbol).font(.app(.title3))
                            Text(a.title).font(.app(.caption, .semibold)).lineLimit(1).minimumScaleFactor(0.8)
                            Text("\(n)").font(.app(.caption2)).monospacedDigit().foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, minHeight: 78)
                        .foregroundStyle(isOn ? Color.accentColor : Color.primary)
                        .background(isOn ? Color.brandSoft : Color.card,
                                    in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(isOn ? Color.accentColor : Color.line.opacity(0.5), lineWidth: isOn ? 1.5 : 1))
                        .opacity(n == 0 && !isOn ? 0.35 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(n == 0 && !isOn)
                    .accessibilityAddTraits(isOn ? .isSelected : [])
                }
            }
        }
    }

    private func towns(_ scope: [Hotel]) -> some View {
        let all = store.towns(in: scope)
        let shown = showAllTowns ? all : Array(all.prefix(6))
        return section("Area") {
            VStack(spacing: 0) {
                ForEach(shown, id: \.name) { t in
                    var trial = draft
                    let _ = trial.towns = [t.name]
                    let n = store.count(trial, in: scope)
                    let isOn = draft.towns.contains(t.name)
                    Button {
                        withAnimation(.snappy) { toggle(&draft.towns, t.name) }
                    } label: {
                        HStack {
                            Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(isOn ? Color.accentColor : Color.secondary)
                            Text(t.name)
                            Spacer()
                            Text("\(n)").monospacedDigit().foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 11)
                        .contentShape(Rectangle())
                        .opacity(n == 0 && !isOn ? 0.4 : 1)
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isOn ? .isSelected : [])
                    Divider()
                }
                if all.count > 6 {
                    Button(showAllTowns ? L("Show fewer areas") : LF("Show all %d areas", all.count)) {
                        withAnimation(.snappy) { showAllTowns.toggle() }
                    }
                    .font(.app(.subheadline, .semibold))
                    .padding(.top, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func contact(_ scope: [Hotel]) -> some View {
        var phoneTrial = draft
        phoneTrial.phoneOnly = true
        var photoTrial = draft
        photoTrial.photosOnly = true
        let phoneCount = store.count(phoneTrial, in: scope)
        let photoCount = store.count(photoTrial, in: scope)
        return section("Before you call") {
            Toggle(isOn: $draft.phoneOnly) {
                Label("Has a phone number · \(phoneCount)", systemImage: "phone.fill")
            }
            Toggle(isOn: $draft.photosOnly) {
                Label("Has photos · \(photoCount)", systemImage: "photo.on.rectangle")
            }
        }
    }

    // MARK: Helpers

    private func section<Content: View>(_ title: String, subtitle: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(L(title)).font(.app(.title3, .bold))
                if let subtitle {
                    Text(L(subtitle)).font(.app(.footnote)).foregroundStyle(.secondary)
                }
            }
            content()
        }
    }

    private func toggle<T: Hashable>(_ set: inout Set<T>, _ value: T) {
        if set.contains(value) { set.remove(value) } else { set.insert(value) }
    }
}

// MARK: - Price histogram and range slider

struct PriceHistogram: View {
    let prices: [Int]
    let bounds: ClosedRange<Int>
    let selected: ClosedRange<Double>
    var binWidth = 1000

    var body: some View {
        let binCount = max(1, (bounds.upperBound - bounds.lowerBound) / binWidth)
        let bins: [Int] = (0..<binCount).map { i in
            let lo = bounds.lowerBound + i * binWidth
            return prices.filter { $0 >= lo && $0 < lo + binWidth || (i == binCount - 1 && $0 == bounds.upperBound) }.count
        }
        let peak = max(1, bins.max() ?? 1)
        HStack(alignment: .bottom, spacing: 2) {
            ForEach(Array(bins.enumerated()), id: \.offset) { i, n in
                let mid = Double(bounds.lowerBound + i * binWidth + binWidth / 2)
                RoundedRectangle(cornerRadius: 2)
                    .fill(selected.contains(mid) ? Color.accentColor : Color.placeholder)
                    .frame(height: n == 0 ? 2 : max(6, 56 * CGFloat(n) / CGFloat(peak)))
            }
        }
        .padding(.horizontal, 14)
        .accessibilityHidden(true)
    }
}

struct RangeSlider: View {
    @Binding var range: ClosedRange<Double>
    let bounds: ClosedRange<Double>
    var step: Double = 1
    /// Text for the price tag under each knob (value, isUpper). Without it the slider has no tags.
    var label: ((Double, Bool) -> String)? = nil

    private let thumb: CGFloat = 28
    private let tagHeight: CGFloat = 30
    /// Which knob is being dragged: 0 = low, 1 = high.
    @State private var active: Int?
    @State private var lowTagWidth: CGFloat = 0
    @State private var highTagWidth: CGFloat = 0
    @State private var mergedTagWidth: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            let width = max(1, geo.size.width - thumb)
            let span = bounds.upperBound - bounds.lowerBound
            let lowX = CGFloat((range.lowerBound - bounds.lowerBound) / span) * width
            let highX = CGFloat((range.upperBound - bounds.lowerBound) / span) * width

            ZStack(alignment: .topLeading) {
                Capsule().fill(Color.placeholder).frame(height: 4).padding(.horizontal, thumb / 2)
                    .offset(y: thumb / 2 - 2)
                Capsule().fill(Color.accentColor).frame(width: max(0, highX - lowX), height: 4)
                    .offset(x: lowX + thumb / 2, y: thumb / 2 - 2)
                knob(isActive: active == 0).offset(x: lowX)
                    .gesture(drag(0, width: width) { v in range = min(v, range.upperBound - step)...range.upperBound })
                    .accessibilityLabel("Minimum price")
                    .accessibilityValue(label?(range.lowerBound, false) ?? "")
                knob(isActive: active == 1).offset(x: highX)
                    .gesture(drag(1, width: width) { v in range = range.lowerBound...max(v, range.lowerBound + step) })
                    .accessibilityLabel("Maximum price")
                    .accessibilityValue(label?(range.upperBound, true) ?? "")
                if let label {
                    tags(label, lowCenter: lowX + thumb / 2, highCenter: highX + thumb / 2, width: geo.size.width)
                        .offset(y: thumb + 8)
                        .accessibilityHidden(true)
                }
            }
            .coordinateSpace(name: "range")
        }
        .frame(height: label == nil ? thumb : thumb + 8 + tagHeight)
        .sensoryFeedback(.selection, trigger: range)
    }

    /// Price tags that ride under the knobs. When they would touch, they merge into one "low – high" tag.
    @ViewBuilder
    private func tags(_ label: (Double, Bool) -> String, lowCenter: CGFloat, highCenter: CGFloat, width: CGFloat) -> some View {
        let low = label(range.lowerBound, false)
        let high = label(range.upperBound, true)
        let merged = lowCenter + lowTagWidth / 2 + 6 > highCenter - highTagWidth / 2
        // Keep a tag fully on screen near the ends of the track.
        let clamp = { (x: CGFloat, w: CGFloat) in min(max(x, w / 2), width - w / 2) }
        ZStack(alignment: .topLeading) {
            PriceTag(text: low, isActive: active == 0, notchOffset: lowCenter - clamp(lowCenter, lowTagWidth))
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { lowTagWidth = $0 }
                .position(x: clamp(lowCenter, lowTagWidth), y: tagHeight / 2)
                .opacity(merged ? 0 : 1)
            PriceTag(text: high, isActive: active == 1, notchOffset: highCenter - clamp(highCenter, highTagWidth))
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { highTagWidth = $0 }
                .position(x: clamp(highCenter, highTagWidth), y: tagHeight / 2)
                .opacity(merged ? 0 : 1)
            PriceTag(text: "\(low) – \(high)", isActive: active != nil, notchOffset: nil)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { mergedTagWidth = $0 }
                .position(x: clamp((lowCenter + highCenter) / 2, mergedTagWidth), y: tagHeight / 2)
                .opacity(merged ? 1 : 0)
        }
        .frame(width: width, height: tagHeight)
        .animation(.snappy(duration: 0.2), value: merged)
    }

    private func drag(_ which: Int, width: CGFloat, update: @escaping (Double) -> Void) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("range"))
            .onChanged { g in
                if active != which { withAnimation(.snappy(duration: 0.15)) { active = which } }
                update(value(at: g.location.x - thumb / 2, width: width))
            }
            .onEnded { _ in withAnimation(.snappy(duration: 0.2)) { active = nil } }
    }

    private func knob(isActive: Bool) -> some View {
        Circle()
            .fill(.white)
            .frame(width: thumb, height: thumb)
            .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
            .overlay(Circle().strokeBorder(isActive ? Color.accentColor : Color.line, lineWidth: isActive ? 2 : 0.5))
            .scaleEffect(isActive ? 1.12 : 1)
    }

    private func value(at x: CGFloat, width: CGFloat) -> Double {
        let ratio = min(max(0, Double(x / width)), 1)
        let raw = bounds.lowerBound + ratio * (bounds.upperBound - bounds.lowerBound)
        return min(max((raw / step).rounded() * step, bounds.lowerBound), bounds.upperBound)
    }
}

/// A small price label with a notch pointing up at its knob; fills with the accent while that knob is dragged.
private struct PriceTag: View {
    let text: String
    let isActive: Bool
    /// Where the notch sits relative to the tag's centre, so it still points at a knob near the edge.
    let notchOffset: CGFloat?

    var body: some View {
        Text(text)
            .font(.app(.footnote, .semibold))
            .monospacedDigit()
            .lineLimit(1)
            .fixedSize()
            .foregroundStyle(isActive ? Color.onAccent : Color.primary)
            .padding(.horizontal, 10)
            .frame(height: 26)
            .background(Capsule().fill(isActive ? Color.accentColor : Color.surface))
            .overlay(Capsule().strokeBorder(isActive ? Color.clear : Color.line, lineWidth: 0.5))
            .overlay(alignment: .top) {
                if let notchOffset {
                    Notch().fill(isActive ? Color.accentColor : Color.surface)
                        .frame(width: 10, height: 5)
                        .offset(x: notchOffset, y: -4)
                }
            }
    }
}

private struct Notch: Shape {
    func path(in rect: CGRect) -> Path {
        Path { p in
            p.move(to: CGPoint(x: rect.midX, y: rect.minY))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            p.closeSubpath()
        }
    }
}

// MARK: - Wrapping layout for chips

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, widest: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > maxWidth {
                x = 0; y += rowHeight + spacing; rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: proposal.width ?? widest, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX {
                x = bounds.minX; y += rowHeight + spacing; rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
