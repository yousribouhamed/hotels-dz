import Foundation
import CoreLocation

struct Hotel: Identifiable, Codable, Hashable {
    struct Ad: Codable, Hashable {
        let site: String?
        let dzd: Int?
    }
    struct Amenity: Codable, Hashable {
        let n: String
        let y: Bool
    }
    struct Review: Codable, Hashable {
        let s: Int?
        let t: String
        let d: String
    }
    /// Price and guest score from one booking site (Wego, Booking.com), kept apart from the Google data.
    /// Scores are out of 10, as the site shows them.
    struct SiteListing: Codable, Hashable {
        let site: String
        let sid: Int?
        let score: Double?
        let count: Int
        let dzd: Int?
        let checked: String
    }
    /// Room prices the stay gave us itself (by phone), entered by hand; `asked` is the day we asked (yyyy-MM-dd).
    struct Rates: Codable, Hashable {
        /// `kind` is single, double, twin, triple, family, suite or apartment.
        struct Room: Codable, Hashable {
            let kind: String
            let dzd: Int
        }
        let asked: String
        let rooms: [Room]
    }
    struct Distribution: Codable, Hashable {
        let oneStar: Int?
        let twoStar: Int?
        let threeStar: Int?
        let fourStar: Int?
        let fiveStar: Int?
    }

    let id: Int
    let region: String?
    let name: String
    let type: String
    let stars: Int?
    let rating: Double?
    let reviews: Int
    let phone: String
    let address: String
    let city: String
    let lat: Double?
    let lng: Double?
    /// Nightly rate in dinars, as Google listed it (no exchange rate applied in the app).
    let dzd: Int?
    let ads: [Ad]
    /// Prices from the stay itself; only stays we called have them.
    let rates: Rates?
    let web: String
    let email: String
    let maps: String?
    let photos: [String]
    let am: [Amenity]
    let desc: String
    let revs: [Review]
    let dist: Distribution?
    let tags: [String]
    let closed: Bool
    let cin: String?
    /// Listings on booking sites; only stays added from those sites have them.
    let ota: [SiteListing]?
}

extension Hotel {
    var regionName: String { region ?? "Boumerdès" }

    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    /// Lowest nightly rate in dinars, online or from the stay itself.
    var lowestDZD: Int? {
        ([dzd] + ads.map(\.dzd) + (rates?.rooms.map(\.dzd) ?? [])).compactMap { $0 }.filter { $0 > 0 }.min()
    }

    /// Room names, bed setup and symbol for each kind of room in `rates`.
    static let roomKinds: [String: (title: String, beds: String?, symbol: String)] = [
        "single": ("Single", "1 bed", "person"),
        "double": ("Double", "1 large bed", "person.2"),
        "twin": ("Twin", "2 separate beds", "person.2"),
        "triple": ("Triple", "3 beds", "person.3"),
        "family": ("Family room", nil, "figure.2.and.child.holdinghands"),
        "suite": ("Suite", nil, "sofa"),
        "apartment": ("Apartment", nil, "building.2"),
    ]

    /// True when the lowest rate is one the stay gave us, not one listed online.
    var lowestIsFromStay: Bool {
        guard let low = lowestDZD, let fromStay = rates?.rooms.map(\.dzd).min() else { return false }
        return fromStay == low
    }

    /// Every rate listed online, cheapest first.
    var rateRows: [(site: String, dzd: Int)] {
        var rows: [(site: String, dzd: Int)] = []
        if let dzd { rows.append((site: "Online rate", dzd: dzd)) }
        for ad in ads { if let p = ad.dzd { rows.append((site: ad.site ?? "Booking site", dzd: p)) } }
        return rows.sorted { $0.dzd < $1.dzd }
    }

    /// Rating pulled toward 4.0 for places with few reviews, so a single 5-star review doesn't top the list.
    var weightedScore: Double {
        guard let rating else { return -1 }
        return (rating * Double(reviews) + 4 * 8) / Double(reviews + 8)
    }

    var ratingLabel: String {
        guard let rating else { return L("No reviews yet") }
        switch rating {
        case 4.5...: return L("Excellent")
        case 4.0..<4.5: return L("Very good")
        case 3.5..<4.0: return L("Good")
        default: return L("Mixed")
        }
    }

    var reviewCountText: String { reviews == 1 ? L("1 review") : LF("%d reviews", reviews) }

    /// The booking-site score with the most reviews, for stays without a Google rating.
    var siteRating: SiteListing? {
        guard rating == nil else { return nil }
        return (ota ?? []).filter { $0.score != nil && $0.count > 0 }.max { $0.count < $1.count }
    }

    /// "8.1/10"
    var siteScoreText: String? {
        siteRating?.score.map { String(format: "%.1f", $0) + "/10" }
    }

    /// "295 reviews on Wego"
    var siteReviewsText: String? {
        siteRating.map { LF("%d reviews on %@", $0.count, $0.site) }
    }

    var starsText: String? {
        guard let stars, stars > 0 else { return nil }
        return String(repeating: "★", count: stars)
    }

    var metaLine: String {
        [L(type), city].joined(separator: " · ")
    }

    var telURL: URL? {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        return digits.isEmpty ? nil : URL(string: "tel:\(digits)")
    }

    var websiteURL: URL? {
        guard web.hasPrefix("http") else { return nil }
        return URL(string: web)
    }

    var websiteLabel: String {
        web.replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
            .replacingOccurrences(of: "www.", with: "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    var googleMapsURL: URL? {
        guard let maps, maps.hasPrefix("http") else { return nil }
        return URL(string: maps)
    }

    var appleMapsURL: URL? {
        guard let lat, let lng else { return nil }
        let q = name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "https://maps.apple.com/?ll=\(lat),\(lng)&q=\(q)")
    }

    var searchText: String {
        [name, city, address, type, regionName].joined(separator: " ").lowercased()
    }
}

enum Money {
    /// Prices are stored in dinars exactly as listed online; the app never converts currencies.
    static func dzd(_ amount: Int) -> String {
        format(amount)
    }

    /// Formats an amount already in dinars, e.g. "7 000 DZD".
    static func format(_ dzd: Int) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.numberStyle = .decimal
        f.usesGroupingSeparator = true
        f.groupingSeparator = "\u{00A0}"
        return (f.string(from: NSNumber(value: dzd)) ?? "\(dzd)") + "\u{00A0}" + L("DZD")
    }
}

enum Fmt {
    static func day(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let p = DateFormatter()
        p.locale = Locale(identifier: "en_US_POSIX")
        p.timeZone = TimeZone(identifier: "UTC")
        p.dateFormat = "yyyy-MM-dd"
        guard let d = p.date(from: String(iso.prefix(10))) else { return iso }
        let o = DateFormatter()
        o.locale = Locale(identifier: ["fr": "fr_FR", "ar": "ar_DZ"][Bundle.languageCode] ?? "en_GB")
        o.timeZone = TimeZone(identifier: "UTC")
        o.dateFormat = "d MMM yyyy"
        return o.string(from: d)
    }

    static func distance(_ km: Double) -> String {
        km < 1 ? "\(Int((km * 1000).rounded())) \(L("m"))" : String(format: "%.1f %@", km, L("km"))
    }
}

enum StaySort: String, CaseIterable, Identifiable {
    case best = "Best match"
    case reviews = "Most reviewed"
    case price = "Lowest price"
    case nearest = "Nearest centre"
    case name = "Name A–Z"
    var id: Self { self }
    var title: String { L(rawValue) }
}

/// The quick All / Hotels / Hostels switch above the results.
enum StayKind: String, CaseIterable, Identifiable {
    case all = "All"
    case hotels = "Hotels"
    case hostels = "Hostels"
    var id: Self { self }
    var title: String { L(rawValue) }

    func includes(_ type: String) -> Bool {
        switch self {
        case .all: true
        case .hotels: ["Hotel", "Motel", "Resort", "Aparthotel"].contains(type)
        case .hostels: type == "Hostel"
        }
    }
}
