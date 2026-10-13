import SwiftUI

struct ExploreView: View {
    @Environment(HotelStore.self) private var store
    @State private var showFilters = false

    var body: some View {
        @Bindable var store = store
        let scope = store.scoped
        let results = store.results

        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    header
                    SearchWithWilaya(query: $store.query, region: $store.region) {
                        store.filters.towns = []
                        store.persistSearch()
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 4)

                    if !store.query.trimmingCharacters(in: .whitespaces).isEmpty {
                        suggestions
                    }

                    if isBrowsing {
                        // No wilaya, search or filter yet: one row per wilaya, like Airbnb's home.
                        ForEach(wilayaRows, id: \.name) { row in
                            WilayaRow(name: row.name, total: row.total, hotels: row.top) {
                                withAnimation(.snappy) {
                                    store.region = row.name
                                    store.filters.towns = []
                                    store.persistSearch()
                                }
                            }
                        }
                    } else {
                        if !store.filters.chips.isEmpty {
                            activeFilters
                        }

                        resultHeader(count: results.count, scopeCount: scope.count)

                        StayKindSwitch(kind: $store.kind)
                            .padding(.horizontal, 16)
                            .onChange(of: store.kind) { store.persistSearch() }

                        if results.isEmpty {
                            emptyState(scope: scope)
                        }
                        ForEach(results) { hotel in
                            HotelCard(hotel: hotel)
                                .padding(.horizontal, 16)
                        }
                    }
                }
                .padding(.bottom, 24)
            }
            .scrollDismissesKeyboard(.immediately)
            .background(Color.canvas)
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showFilters) { FilterSheet() }
            .navigationDestination(for: Hotel.self) { HotelDetailView(hotel: $0) }
        }
    }

    /// Title and filter button on one line (replaces the large navigation title).
    private var header: some View {
        let active = store.filters.activeCount
        return HStack(alignment: .center) {
            // Zalumo logo (symbol + wordmark): lime on dark, forest on light (lime would vanish on the cream canvas).
            Image("Wordmark")
                .resizable()
                .scaledToFit()
                .frame(height: 35)
                .foregroundStyle(Color("WordmarkColor"))
                .accessibilityLabel(Text(verbatim: "Zalumo"))
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button { showFilters = true } label: {
                Image(systemName: "line.3.horizontal.decrease")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(active > 0 ? Color.onAccent : Color.primary)
                    .frame(width: 44, height: 44)
                    .background(active > 0 ? Color.accentColor : Color.card, in: Circle())
                    .overlay(Circle().strokeBorder(Color.line.opacity(active > 0 ? 0 : 0.6), lineWidth: 1))
                    .overlay(alignment: .topTrailing) {
                        if active > 0 {
                            Text("\(active)")
                                .font(.app(.caption2, .bold))
                                .foregroundStyle(.white)
                                .frame(minWidth: 18, minHeight: 18)
                                .background(Color.heart, in: Circle())
                                .offset(x: 4, y: -4)
                        }
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(active > 0 ? "Filters, \(active) on" : "Filters")
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    /// The home layout shows until you pick a wilaya, a stay kind, type a search or set a filter.
    private var isBrowsing: Bool {
        store.region == nil
            && store.kind == .all
            && store.query.trimmingCharacters(in: .whitespaces).isEmpty
            && store.filters.activeCount == 0
    }

    /// Each wilaya's best-rated stays with photos, wilayas in alphabetical order.
    private var wilayaRows: [(name: String, total: Int, top: [Hotel])] {
        Dictionary(grouping: store.hotels, by: \.regionName)
            .map { name, list in
                let open = list.filter { !$0.closed }.sorted { $0.weightedScore > $1.weightedScore }
                let withPhotos = open.filter { !$0.photos.isEmpty }
                let top = (withPhotos + open.filter { $0.photos.isEmpty }).prefix(12)
                return (name: name, total: list.count, top: Array(top))
            }
            .sorted { L($0.name).localizedStandardCompare(L($1.name)) == .orderedAscending }
    }

    // MARK: Search suggestions

    /// Turns what you type into filters: areas, stay types and wilayas.
    private var suggestions: some View {
        let q = store.query.trimmingCharacters(in: .whitespaces).lowercased()
        let pool = store.hotels.filter { store.region == nil || $0.regionName == store.region }
        let areas = store.towns(in: pool).filter { $0.name.lowercased().contains(q) }.prefix(4)
        let kinds = store.types(in: pool).filter { $0.name.lowercased().contains(q) || L($0.name).lowercased().contains(q) }.prefix(2)
        let wilayas = store.regions.filter { ($0.name.lowercased().contains(q) || L($0.name).lowercased().contains(q)) && $0.name != store.region }

        return Group {
            if !(areas.isEmpty && kinds.isEmpty && wilayas.isEmpty) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(wilayas, id: \.name) { w in
                            suggestion(LF("Wilaya: %@", L(w.name)), symbol: "mappin.and.ellipse", count: w.count) {
                                store.region = w.name; store.filters.towns = []
                            }
                        }
                        ForEach(Array(areas), id: \.name) { a in
                            suggestion(a.name, symbol: "mappin", count: a.count) { store.filters.towns.insert(a.name) }
                        }
                        ForEach(Array(kinds), id: \.name) { k in
                            suggestion(L(k.name), symbol: "bed.double", count: k.count) { store.filters.types.insert(k.name) }
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
    }

    private func suggestion(_ title: String, symbol: String, count: Int?, apply: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.snappy) {
                apply()
                store.query = ""
                store.persistSearch()
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: symbol)
                Text(title)
                if let count { Text("\(count)").foregroundStyle(.secondary).monospacedDigit() }
                Image(systemName: "plus.circle.fill").foregroundStyle(Color.accentColor)
            }
            .font(.app(.subheadline, .semibold))
            .padding(.horizontal, 12)
            .frame(height: 34)
            .background(Color.brandSoft, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(LF("Filter by %@", title))
    }

    // MARK: Controls

    /// Sort picker, shown on the right of the result count.
    private var sortMenu: some View {
        @Bindable var store = store
        return Menu {
            Picker("Sort by", selection: $store.sort) {
                ForEach(StaySort.allCases) { Text($0.title).tag($0) }
            }
        } label: {
            // Compact chip so it sits beside the count without crowding it.
            HStack(spacing: 4) {
                Image(systemName: "arrow.up.arrow.down").font(.app(.caption2, .bold))
                Text(store.sort.title).lineLimit(1)
                Image(systemName: "chevron.down").font(.app(.caption2, .bold))
            }
            .font(.app(.footnote, .semibold))
            .foregroundStyle(Color.primary)
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(Color.card, in: Capsule())
            .overlay(Capsule().strokeBorder(Color.line.opacity(0.6), lineWidth: 1))
        }
        .onChange(of: store.sort) { store.persistSearch() }
        .fixedSize()
    }

    private var activeFilters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(store.filters.chips) { chip in
                    Button {
                        withAnimation(.snappy) {
                            chip.remove(&store.filters)
                            store.persistSearch()
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Text(chip.label)
                            Image(systemName: "xmark").font(.app(.caption2, .bold))
                        }
                        .font(.app(.footnote, .semibold))
                        .padding(.horizontal, 11)
                        .frame(height: 30)
                        .foregroundStyle(Color.accentColor)
                        .background(Color.brandSoft, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove \(chip.label)")
                }
                Button("Clear all") {
                    withAnimation(.snappy) {
                        store.filters = StayFilters()
                        store.persistSearch()
                    }
                }
                .font(.app(.footnote, .semibold))
            }
            .padding(.horizontal, 16)
        }
    }

    private func resultHeader(count: Int, scopeCount: Int) -> some View {
        HStack(alignment: .center, spacing: 8) {
            // Count and wilaya stay on one line; the wilaya part shrinks first if space runs out.
            (Text(count == scopeCount ? LF("%d stays", count) : LF("%d of %d stays", count, scopeCount))
                .font(.app(.subheadline, .semibold))
             + Text(" ")
             + Text(store.region.map { LF("in %@", L($0)) } ?? L("in all wilayas"))
                .font(.app(.subheadline))
                .foregroundColor(.secondary))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .contentTransition(.numericText())
            Spacer(minLength: 4)
            sortMenu
        }
        .padding(.horizontal, 16)
        .animation(.snappy, value: count)
    }

    // MARK: Empty state

    /// Suggests switching back to All, or the single filter whose removal brings back the most stays.
    private func emptyState(scope: [Hotel]) -> some View {
        let otherKinds = store.kind == .all ? 0 : store.count(store.filters, in: store.searched)
        let best = store.filters.chips
            .map { chip -> (FilterChipItem, Int) in
                var trial = store.filters
                chip.remove(&trial)
                return (chip, store.count(trial, in: scope))
            }
            .max { $0.1 < $1.1 }

        return ContentUnavailableView {
            Label("No stays match", systemImage: "bed.double")
        } description: {
            if otherKinds > 0 {
                Text(LF("Switching to All would show %d stays.", otherKinds))
            } else if let best, best.1 > 0 {
                Text("Removing “\(best.0.label)” would show \(best.1) stays.")
            } else {
                Text("Try another wilaya or a shorter search.")
            }
        } actions: {
            if otherKinds > 0 {
                Button(L("Show all stays")) {
                    withAnimation(.snappy) { store.kind = .all; store.persistSearch() }
                }
                .buttonStyle(.borderedProminent)
                .foregroundStyle(Color.onAccent)
            } else if let best, best.1 > 0 {
                Button("Remove “\(best.0.label)”") {
                    withAnimation(.snappy) { best.0.remove(&store.filters); store.persistSearch() }
                }
                .buttonStyle(.borderedProminent)
                .foregroundStyle(Color.onAccent)
            }
            Button("Clear all filters") {
                withAnimation(.snappy) { store.filters = StayFilters(); store.kind = .all; store.query = ""; store.persistSearch() }
            }
            .buttonStyle(.bordered)
        }
        .padding(.top, 30)
    }
}

struct HotelCard: View {
    @Environment(HotelStore.self) private var store
    let hotel: Hotel

    var body: some View {
        let traits = store.traits(hotel)
        NavigationLink(value: hotel) {
            VStack(alignment: .leading, spacing: 10) {
                Color.clear
                    .aspectRatio(4 / 3, contentMode: .fit)
                    .overlay { CardPhotoCarousel(hotel: hotel) }
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(alignment: .topLeading) {
                        if hotel.closed {
                            Text("Closed")
                                .font(.app(.caption, .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 9).padding(.vertical, 4)
                                .background(.black.opacity(0.72), in: Capsule())
                                .padding(12)
                        }
                    }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(hotel.name)
                            .font(.app(.headline))
                            .multilineTextAlignment(.leading)
                            .lineLimit(2)
                        Spacer(minLength: 0)
                        CompactRating(hotel: hotel)
                    }
                    detailLine(traits)
                    bottomLine(traits)
                        .padding(.top, 2)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // Kept outside the link so tapping them doesn't open the stay.
        .overlay(alignment: .topTrailing) {
            SaveButton(hotel: hotel).padding(6)
        }
        .overlay(alignment: .bottomLeading) {
            if hotel.lowestDZD == nil, let tel = hotel.telURL {
                Link(destination: tel) {
                    Label("Call for price", systemImage: "phone.fill")
                        .font(.app(.subheadline, .semibold))
                        .foregroundStyle(Color.accentColor)
                }
                .accessibilityLabel("Call \(hotel.name) for a price")
            }
        }
        .padding(.bottom, 8)
    }

    /// Type, hotel class and how far it is from the centre, on one line.
    private func detailLine(_ traits: StayTraits) -> some View {
        HStack(spacing: 4) {
            Text(L(hotel.type)).layoutPriority(1)
            if let s = hotel.starsText {
                Text(s).foregroundStyle(Color.star).layoutPriority(1)
            }
            if let km = traits.km, let label = traits.centreLabel {
                Text("· \(Fmt.distance(km)) from \(label)")
            } else if hotel.city != hotel.regionName {
                Text("· \(hotel.city)")
            }
        }
        .font(.app(.subheadline))
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }

    /// The price when Google listed one; otherwise a reason to tap through.
    @ViewBuilder
    private func bottomLine(_ traits: StayTraits) -> some View {
        if let dzd = hotel.lowestDZD {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(Money.dzd(dzd))
                    .font(.app(.headline))
                    .monospacedDigit()
                Text("/ night")
                    .font(.app(.subheadline))
                    .foregroundStyle(.secondary)
            }
        } else if hotel.telURL != nil {
            // Space for the "Call for price" link drawn on top.
            Label("Call for price", systemImage: "phone.fill")
                .font(.app(.subheadline, .semibold))
                .hidden()
        } else {
            let highlights = AmenityKey.allCases.filter { traits.amenities.contains($0) }.prefix(3).map(\.title)
            Text(highlights.isEmpty ? L("Price on request") : highlights.joined(separator: " · "))
                .font(.app(.subheadline))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}

/// "★ 4.6 (299)" next to the name.
struct CompactRating: View {
    let hotel: Hotel

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "star.fill")
                .font(.app(.caption))
                .foregroundStyle(Color.star)
            if let rating = hotel.rating {
                Text(rating, format: .number.precision(.fractionLength(1)))
                    .fontWeight(.semibold)
                Text("(\(hotel.reviews))")
                    .foregroundStyle(.secondary)
            } else {
                Text("New").fontWeight(.semibold)
            }
        }
        .font(.app(.subheadline))
        .monospacedDigit()
        .lineLimit(1)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(hotel.rating.map { LF("Rated %@ from %d reviews", String(format: "%.1f", $0), hotel.reviews) } ?? L("No reviews yet"))
    }
}

/// "Hotels to stay in Algiers ›" with a sideways row of compact cards.
struct WilayaRow: View {
    let name: String
    let total: Int
    let hotels: [Hotel]
    let showAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: showAll) {
                HStack(spacing: 4) {
                    Text("Hotels to stay in \(L(name))")
                        .font(.app(.title3, .bold))
                    Image(systemName: "chevron.forward")
                        .font(.app(.subheadline, .bold))
                }
                .foregroundStyle(.primary)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
            .accessibilityLabel(LF("Hotels to stay in %@, see all %d", L(name), total))

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 12) {
                    ForEach(hotels) { CompactStayCard(hotel: $0) }
                    SeeAllTile(name: name, total: total, action: showAll)
                }
                .scrollTargetLayout()
                .padding(.horizontal, 16)
            }
            .scrollTargetBehavior(.viewAligned)
        }
        .padding(.top, 6)
        .padding(.bottom, 8)
    }
}

/// Small square-photo card for the wilaya rows.
struct CompactStayCard: View {
    let hotel: Hotel
    static let width: CGFloat = 164

    var body: some View {
        NavigationLink(value: hotel) {
            VStack(alignment: .leading, spacing: 6) {
                PhotoBox(path: hotel.photos.first, placeholderText: "No photos yet", kind: hotel.type, size: .compact)
                    .frame(width: Self.width, height: Self.width)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text(hotel.name)
                        .font(.app(.subheadline, .semibold))
                        .lineLimit(1)
                    HStack(spacing: 4) {
                        Text(L(hotel.type))
                        if let rating = hotel.rating {
                            Text("·")
                            Image(systemName: "star.fill").font(.app(.caption2)).foregroundStyle(Color.star)
                            Text(rating, format: .number.precision(.fractionLength(1)))
                        }
                    }
                    .font(.app(.footnote))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    if let dzd = hotel.lowestDZD {
                        HStack(spacing: 3) {
                            Text(Money.dzd(dzd)).fontWeight(.semibold)
                            Text("/ night").foregroundStyle(.secondary)
                        }
                        .font(.app(.footnote))
                        .lineLimit(1)
                    }
                }
            }
            .frame(width: Self.width, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(alignment: .topTrailing) {
            SaveButton(hotel: hotel)
        }
    }
}

/// Last tile in a row, opening the full list for that wilaya.
struct SeeAllTile: View {
    let name: String
    let total: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: "arrow.forward")
                    .font(.app(.title3, .semibold))
                    .frame(width: 48, height: 48)
                    .background(Color.card, in: Circle())
                Text("See all \(total)")
                    .font(.app(.subheadline, .semibold))
                Text("in \(L(name))")
                    .font(.app(.footnote))
                    .foregroundStyle(.secondary)
            }
            .frame(width: 120, height: CompactStayCard.width)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
