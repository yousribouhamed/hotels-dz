import Foundation

// MARK: - Geography

enum RegionCentre {
    struct Point {
        let lat: Double
        let lng: Double
        let label: String
    }

    static let byRegion: [String: Point] = [
        "Algiers": Point(lat: 36.7729, lng: 3.0586, label: "Grande Poste"),
        "Boumerdès": Point(lat: 36.7664, lng: 3.4772, label: "Boumerdès centre"),
        "Tipaza": Point(lat: 36.5917, lng: 2.4475, label: "Tipaza centre"),
        "Biskra": Point(lat: 34.8481, lng: 5.7281, label: "Biskra centre"),
        "Sétif": Point(lat: 36.1898, lng: 5.4108, label: "Aïn El Fouara"),
        "Annaba": Point(lat: 36.9003, lng: 7.7558, label: "Cours de la Révolution"),
        "Oran": Point(lat: 35.6971, lng: -0.6337, label: "Place du 1er Novembre"),
        "Tlemcen": Point(lat: 34.8828, lng: -1.3167, label: "Tlemcen centre"),
        "Constantine": Point(lat: 36.3650, lng: 6.6147, label: "Place du 1er Novembre"),
        "Béjaïa": Point(lat: 36.7525, lng: 5.0843, label: "Place Gueydon"),
        "Batna": Point(lat: 35.5559, lng: 6.1741, label: "Batna centre"),
        "El Oued": Point(lat: 33.3683, lng: 6.8674, label: "El Oued centre"),
        "Tamanrasset": Point(lat: 22.7850, lng: 5.5228, label: "Tamanrasset centre"),
        "Adrar": Point(lat: 27.8743, lng: -0.2939, label: "Adrar centre"),
        "Tindouf": Point(lat: 27.6711, lng: -8.1474, label: "Tindouf centre"),
        "Jijel": Point(lat: 36.8206, lng: 5.7667, label: "Jijel centre"),
        "El Tarf": Point(lat: 36.7672, lng: 8.3138, label: "El Tarf centre"),
        "Guelma": Point(lat: 36.4621, lng: 7.4261, label: "Guelma centre"),
        "Tébessa": Point(lat: 35.4042, lng: 8.1242, label: "Tébessa centre"),
        "Ouargla": Point(lat: 31.9493, lng: 5.3250, label: "Ouargla centre")
    ]
}

func haversineKm(_ lat1: Double, _ lng1: Double, _ lat2: Double, _ lng2: Double) -> Double {
    let r = 6371.0, t = Double.pi / 180
    let dLa = (lat2 - lat1) * t, dLo = (lng2 - lng1) * t
    let a = sin(dLa / 2) * sin(dLa / 2) + cos(lat1 * t) * cos(lat2 * t) * sin(dLo / 2) * sin(dLo / 2)
    return 2 * r * asin(min(1, sqrt(a)))
}

// MARK: - Amenities

enum AmenityKey: String, CaseIterable, Codable, Identifiable, Hashable {
    case wifi, parking, breakfast, aircon, restaurant, shuttle, family, pool, pets, fitness, spa

    var id: Self { self }

    var title: String { L(englishTitle) }

    private var englishTitle: String {
        switch self {
        case .wifi: return "Wi-Fi"
        case .parking: return "Parking"
        case .breakfast: return "Breakfast"
        case .aircon: return "Air con"
        case .restaurant: return "Restaurant"
        case .shuttle: return "Airport shuttle"
        case .family: return "Kid-friendly"
        case .pool: return "Pool"
        case .pets: return "Pets OK"
        case .fitness: return "Gym"
        case .spa: return "Spa"
        }
    }

    var symbol: String {
        switch self {
        case .wifi: return "wifi"
        case .parking: return "parkingsign"
        case .breakfast: return "cup.and.saucer.fill"
        case .aircon: return "snowflake"
        case .restaurant: return "fork.knife"
        case .shuttle: return "airplane"
        case .family: return "figure.2.and.child.holdinghands"
        case .pool: return "figure.pool.swim"
        case .pets: return "pawprint.fill"
        case .fitness: return "dumbbell.fill"
        case .spa: return "sparkles"
        }
    }

    /// Names as they appear in the scraped Google Maps amenities.
    var names: Set<String> {
        switch self {
        case .wifi: return ["Free Wi-Fi", "Wi-Fi"]
        case .parking: return ["Free parking", "Parking"]
        case .breakfast: return ["Breakfast included", "Breakfast", "Paid breakfast"]
        case .aircon: return ["Air conditioning"]
        case .restaurant: return ["Restaurant"]
        case .shuttle: return ["Airport shuttle"]
        case .family: return ["Kid-friendly"]
        case .pool: return ["Pool", "Outdoor pool", "Indoor pool", "Indoor & outdoor pool"]
        case .pets: return ["Pets allowed"]
        case .fitness: return ["Fitness centre"]
        case .spa: return ["Spa", "Hot tub"]
        }
    }
}

// MARK: - Precomputed traits

/// Facts derived once per stay so filtering and counting stay fast.
struct StayTraits {
    let dzd: Int?
    let km: Double?
    let centreLabel: String?
    let amenities: Set<AmenityKey>
    let seaside: Bool
    let desert: Bool
    let hostelLike: Bool

    init(_ h: Hotel) {
        dzd = h.lowestDZD
        if let lat = h.lat, let lng = h.lng, let c = RegionCentre.byRegion[h.regionName] {
            km = haversineKm(lat, lng, c.lat, c.lng)
            centreLabel = c.label
        } else {
            km = nil
            centreLabel = nil
        }
        var keys = Set<AmenityKey>()
        for a in h.am where a.y {
            for k in AmenityKey.allCases where k.names.contains(a.n) { keys.insert(k) }
        }
        amenities = keys
        let text = ([h.name, h.address, h.desc] + h.revs.map(\.t) + h.tags).joined(separator: " ").lowercased()
        let beachAmenity = h.am.contains { $0.y && $0.n == "Beach access" }
        let seaWords = "plage|beach|bord de mer|vue sur (la )?mer|sea view|seaside|corniche|البحر|بحر"
        seaside = beachAmenity || text.range(of: seaWords, options: .regularExpression) != nil
        let desertWords = "désert|desert|oasis|palmeraie|dune|sahara|صحراء|الصحراء|واحة|نخيل"
        desert = text.range(of: desertWords, options: .regularExpression) != nil
        hostelLike = h.type == "Hostel"
            || h.name.lowercased().range(of: "hostel|auberge|dortoir|مرقد", options: .regularExpression) != nil
    }
}

// MARK: - Smart presets

enum SmartPreset: String, CaseIterable, Codable, Identifiable {
    case remoteWork, crowdFavourite, hiddenGem, budget, hostel, central, seaside, desert, family

    var id: Self { self }

    var title: String { L(englishTitle) }

    private var englishTitle: String {
        switch self {
        case .remoteWork: return "Remote-work ready"
        case .crowdFavourite: return "Crowd favourites"
        case .hiddenGem: return "Hidden gems"
        case .budget: return "Budget"
        case .hostel: return "Hostels & dorms"
        case .central: return "Central"
        case .seaside: return "By the sea"
        case .desert: return "Desert & oasis"
        case .family: return "Family-friendly"
        }
    }

    var symbol: String {
        switch self {
        case .remoteWork: return "laptopcomputer"
        case .crowdFavourite: return "flame.fill"
        case .hiddenGem: return "sparkle"
        case .budget: return "banknote"
        case .hostel: return "bed.double.fill"
        case .central: return "building.columns.fill"
        case .seaside: return "beach.umbrella.fill"
        case .desert: return "sun.horizon.fill"
        case .family: return "figure.2.and.child.holdinghands"
        }
    }

    var detail: String {
        switch self {
        case .remoteWork: return "Wi-Fi listed, rated 4+"
        case .crowdFavourite: return "Rated 4.2+ by 150+ guests"
        case .hiddenGem: return "Rated 4.6+, few reviews yet"
        case .budget: return "Under \(Money.format(SmartPreset.budgetDZD)), or hostel or motel"
        case .hostel: return "Hostels, auberges, dorm beds"
        case .central: return "Within 1 km of the centre"
        case .seaside: return "Beach or sea view mentioned"
        case .desert: return "Desert, oasis or palm grove mentioned"
        case .family: return "Listed as kid-friendly"
        }
    }

    func matches(_ h: Hotel, _ t: StayTraits) -> Bool {
        let rating = h.rating ?? 0
        switch self {
        case .remoteWork: return t.amenities.contains(.wifi) && rating >= 4
        case .crowdFavourite: return rating >= 4.2 && h.reviews >= 150
        case .hiddenGem: return rating >= 4.6 && (5...60).contains(h.reviews)
        case .budget:
            if let p = h.lowestDZD, p <= SmartPreset.budgetDZD { return true }
            return ["Hostel", "Motel", "Camping"].contains(h.type)
        case .hostel: return t.hostelLike
        case .central: return (t.km ?? .infinity) <= 1
        case .seaside: return t.seaside
        case .desert: return t.desert
        case .family: return t.amenities.contains(.family)
        }
    }

    /// "Budget" means a listed rate of 7 000 DZD a night or less.
    static let budgetDZD = 7_000

    /// Presets worth showing as a badge on a card, in priority order.
    static let badges: [SmartPreset] = [.crowdFavourite, .hiddenGem, .remoteWork, .seaside, .desert]
}

// MARK: - Filters

enum Facet: Hashable {
    case presets, types, towns, rating, reviews, stars, amenities, price, distance, phone, photos
}

struct StayFilters: Codable, Equatable {
    var presets: Set<SmartPreset> = []
    var types: Set<String> = []
    var towns: Set<String> = []
    var minRating: Double = 0
    var minReviews: Int = 0
    var stars: Set<Int> = []
    var amenities: Set<AmenityKey> = []
    var priceMin: Int? = nil
    var priceMax: Int? = nil
    var includeUnpriced = true
    var maxKm: Double? = nil
    var phoneOnly = false
    var photosOnly = false

    var activeCount: Int {
        var n = presets.count + types.count + towns.count + stars.count + amenities.count
        if minRating > 0 { n += 1 }
        if minReviews > 0 { n += 1 }
        if priceMin != nil || priceMax != nil { n += 1 }
        if !includeUnpriced { n += 1 }
        if maxKm != nil { n += 1 }
        if phoneOnly { n += 1 }
        if photosOnly { n += 1 }
        return n
    }

    func matches(_ h: Hotel, _ t: StayTraits, skipping skip: Facet? = nil) -> Bool {
        if skip != .presets && !presets.allSatisfy({ $0.matches(h, t) }) { return false }
        if skip != .types && !types.isEmpty && !types.contains(h.type) { return false }
        if skip != .towns && !towns.isEmpty && !towns.contains(h.city) { return false }
        if skip != .rating && minRating > 0 && (h.rating ?? 0) < minRating { return false }
        if skip != .reviews && minReviews > 0 && h.reviews < minReviews { return false }
        if skip != .stars && !stars.isEmpty && !stars.contains(h.stars ?? 0) { return false }
        if skip != .amenities && !amenities.isSubset(of: t.amenities) { return false }
        if skip != .price {
            if let p = t.dzd {
                if let lo = priceMin, p < lo { return false }
                if let hi = priceMax, p > hi { return false }
            } else if !includeUnpriced {
                return false
            }
        }
        if skip != .distance, let maxKm, (t.km ?? .infinity) > maxKm { return false }
        if skip != .phone && phoneOnly && h.phone.isEmpty { return false }
        if skip != .photos && photosOnly && h.photos.isEmpty { return false }
        return true
    }

    private static let key = "stayFilters.v1"

    static func load() -> StayFilters {
        guard let data = UserDefaults.standard.data(forKey: key),
              let f = try? JSONDecoder().decode(StayFilters.self, from: data) else { return StayFilters() }
        return f
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }
}

/// One removable chip in the "Your filters" summary.
struct FilterChipItem: Identifiable {
    let id: String
    let label: String
    let remove: (inout StayFilters) -> Void
}

extension StayFilters {
    var chips: [FilterChipItem] {
        var out: [FilterChipItem] = []
        for p in SmartPreset.allCases where presets.contains(p) {
            out.append(FilterChipItem(id: "p-\(p.rawValue)", label: p.title) { $0.presets.remove(p) })
        }
        for t in types.sorted() {
            out.append(FilterChipItem(id: "t-\(t)", label: L(t)) { $0.types.remove(t) })
        }
        for t in towns.sorted() {
            out.append(FilterChipItem(id: "w-\(t)", label: t) { $0.towns.remove(t) })
        }
        if minRating > 0 {
            out.append(FilterChipItem(id: "rating", label: LF("Rated %@+", String(format: "%.1f", minRating))) { $0.minRating = 0 })
        }
        if minReviews > 0 {
            out.append(FilterChipItem(id: "reviews", label: LF("%d+ reviews", minReviews)) { $0.minReviews = 0 })
        }
        for s in stars.sorted() {
            out.append(FilterChipItem(id: "s-\(s)", label: LF("%d★ hotel", s)) { $0.stars.remove(s) })
        }
        for a in AmenityKey.allCases where amenities.contains(a) {
            out.append(FilterChipItem(id: "a-\(a.rawValue)", label: a.title) { $0.amenities.remove(a) })
        }
        if priceMin != nil || priceMax != nil {
            let lo = priceMin.map { Money.format($0) } ?? L("Any")
            let hi = priceMax.map { Money.format($0) } ?? L("any")
            out.append(FilterChipItem(id: "price", label: "\(lo) – \(hi)") { $0.priceMin = nil; $0.priceMax = nil })
        }
        if !includeUnpriced {
            out.append(FilterChipItem(id: "priced", label: L("Online price only")) { $0.includeUnpriced = true })
        }
        if let maxKm {
            out.append(FilterChipItem(id: "km", label: LF("Within %d km of centre", Int(maxKm))) { $0.maxKm = nil })
        }
        if phoneOnly {
            out.append(FilterChipItem(id: "phone", label: L("Has phone")) { $0.phoneOnly = false })
        }
        if photosOnly {
            out.append(FilterChipItem(id: "photos", label: L("Has photos")) { $0.photosOnly = false })
        }
        return out
    }
}
