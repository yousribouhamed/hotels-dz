import Foundation

/// Every collected Google review for a stay, newest first, from `Resources/reviews/<id>.json`.
/// Each file holds only that stay's own reviews. Stays without a file keep the few reviews
/// in hotels.json.
enum CollectedReviews {
    private static var cache: [Int: [Hotel.Review]] = [:]
    private static let lock = NSLock()

    static func all(for hotel: Hotel) -> [Hotel.Review] {
        lock.lock()
        defer { lock.unlock() }
        if let cached = cache[hotel.id] { return cached }
        var list = hotel.revs
        if let url = Bundle.main.url(forResource: String(hotel.id), withExtension: "json", subdirectory: "reviews"),
           let data = try? Data(contentsOf: url),
           let decoded = try? JSONDecoder().decode([Hotel.Review].self, from: data),
           !decoded.isEmpty {
            list = decoded
        }
        cache[hotel.id] = list
        return list
    }
}
