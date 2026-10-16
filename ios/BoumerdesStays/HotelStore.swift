import Foundation
import Observation

@Observable
final class HotelStore {
    let hotels: [Hotel]
    private(set) var saved: Set<Int>
    private let byId: [Int: Hotel]
    private let traitsById: [Int: StayTraits]

    // Search state shared by the Explore and Map tabs.
    var query = ""
    var region: String?
    var filters: StayFilters
    var sort: StaySort
    var kind: StayKind

    init() {
        var list: [Hotel] = []
        if let url = Bundle.main.url(forResource: "hotels", withExtension: "json") {
            do {
                list = try JSONDecoder().decode([Hotel].self, from: Data(contentsOf: url))
            } catch {
                print("Could not read hotels.json: \(error)")
            }
        }
        hotels = list
        byId = Dictionary(uniqueKeysWithValues: list.map { ($0.id, $0) })
        traitsById = Dictionary(uniqueKeysWithValues: list.map { ($0.id, StayTraits($0)) })
        // Stays removed from the data since they were saved are dropped, so the tab badge matches the list.
        let stored = Set(UserDefaults.standard.array(forKey: "savedStays") as? [Int] ?? [])
        let kept = stored.intersection(list.map(\.id))
        saved = kept
        if kept != stored { UserDefaults.standard.set(Array(kept), forKey: "savedStays") }
        region = UserDefaults.standard.string(forKey: "region")
        sort = StaySort(rawValue: UserDefaults.standard.string(forKey: "sort") ?? "") ?? .best
        kind = StayKind(rawValue: UserDefaults.standard.string(forKey: "kind") ?? "") ?? .all
        filters = StayFilters.load()
        // Shortcut presets are no longer offered in the UI, so drop any saved ones.
        filters.presets = []
    }

    func hotel(_ id: Int) -> Hotel? { byId[id] }

    func traits(_ h: Hotel) -> StayTraits { traitsById[h.id] ?? StayTraits(h) }

    // MARK: Saved

    func isSaved(_ hotel: Hotel) -> Bool { saved.contains(hotel.id) }

    func toggleSaved(_ hotel: Hotel) {
        if saved.contains(hotel.id) { saved.remove(hotel.id) } else { saved.insert(hotel.id) }
        UserDefaults.standard.set(Array(saved), forKey: "savedStays")
    }

    var savedHotels: [Hotel] {
        hotels.filter { saved.contains($0.id) }.sorted { $0.weightedScore > $1.weightedScore }
    }

    func persistSearch() {
        filters.save()
        UserDefaults.standard.set(region, forKey: "region")
        UserDefaults.standard.set(sort.rawValue, forKey: "sort")
        UserDefaults.standard.set(kind.rawValue, forKey: "kind")
    }

    // MARK: Results

    /// Stays in the chosen wilaya that match the search text, before the kind switch and filters.
    var searched: [Hotel] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return hotels.filter { h in
            if let region, h.regionName != region { return false }
            return q.isEmpty || h.searchText.contains(q)
        }
    }

    /// The searched stays narrowed by the All / Hotels / Hostels switch, before filters.
    var scoped: [Hotel] {
        kind == .all ? searched : searched.filter { kind.includes($0.type) }
    }

    var results: [Hotel] {
        let f = filters
        return scoped.filter { f.matches($0, traits($0)) }.sorted { isOrderedBefore($0, $1) }
    }

    func count(_ f: StayFilters, in list: [Hotel], skipping facet: Facet? = nil) -> Int {
        list.reduce(0) { $0 + (f.matches($1, traits($1), skipping: facet) ? 1 : 0) }
    }

    func badge(for h: Hotel) -> SmartPreset? {
        let t = traits(h)
        return SmartPreset.badges.first { $0.matches(h, t) }
    }

    private func isOrderedBefore(_ a: Hotel, _ b: Hotel) -> Bool {
        let aPhotos = !a.photos.isEmpty, bPhotos = !b.photos.isEmpty
        switch sort {
        case .best, .reviews:
            // Ranking sorts: stays with photos always come first, then the usual order.
            if aPhotos != bPhotos { return aPhotos }
            if sort == .reviews, a.reviews != b.reviews { return a.reviews > b.reviews }
            if a.weightedScore != b.weightedScore { return a.weightedScore > b.weightedScore }
            return a.reviews > b.reviews
        case .price:
            switch (traits(a).dzd, traits(b).dzd) {
            case let (x?, y?): return x != y ? x < y : aPhotos && !bPhotos
            case (.some, .none): return true
            case (.none, .some): return false
            case (.none, .none):
                if aPhotos != bPhotos { return aPhotos }
                return a.weightedScore > b.weightedScore
            }
        case .nearest:
            // Distance is what was asked for; photos only break ties.
            let ka = traits(a).km ?? .infinity, kb = traits(b).km ?? .infinity
            if ka != kb { return ka < kb }
            return aPhotos && !bPhotos
        case .name:
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }

    // MARK: Facets for menus

    /// Wilayas in the data, largest first.
    var regions: [(name: String, count: Int)] {
        counts(hotels.map(\.regionName))
    }

    func types(in list: [Hotel]) -> [(name: String, count: Int)] { counts(list.map(\.type)) }

    func towns(in list: [Hotel]) -> [(name: String, count: Int)] { counts(list.map(\.city)) }

    func nearby(_ hotel: Hotel, limit: Int = 4) -> [(hotel: Hotel, km: Double)] {
        guard let lat = hotel.lat, let lng = hotel.lng else { return [] }
        return hotels.compactMap { other -> (hotel: Hotel, km: Double)? in
            guard other.id != hotel.id, let la = other.lat, let lo = other.lng else { return nil }
            return (hotel: other, km: haversineKm(lat, lng, la, lo))
        }
        .sorted { $0.km < $1.km }
        .prefix(limit)
        .map { $0 }
    }

    private func counts(_ values: [String]) -> [(name: String, count: Int)] {
        Dictionary(values.map { ($0, 1) }, uniquingKeysWith: +)
            .map { (name: $0.key, count: $0.value) }
            .sorted { $0.count != $1.count ? $0.count > $1.count : $0.name < $1.name }
    }
}
