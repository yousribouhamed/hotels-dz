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
}

extension Hotel {
    var regionName: String { region ?? "Boumerdès" }

    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    /// Lowest nightly rate listed online, in dinars.
    var lowestDZD: Int? {
        ([dzd] + ads.map(\.dzd)).compactMap { $0 }.filter { $0 > 0 }.min()
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
