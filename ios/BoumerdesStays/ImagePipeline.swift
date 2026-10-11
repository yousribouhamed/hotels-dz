import UIKit
import ImageIO

/// How big a photo is shown. Each size decodes (and, for web photos, downloads)
/// only the pixels it needs, so small thumbnails stay cheap.
enum PhotoSize {
    /// Map preview and "nearby" rows (about 60–100 pt).
    case thumb
    /// Square cards in the wilaya rows (about 164 pt).
    case compact
    /// Full-width list cards and the detail gallery.
    case full

    /// Longest side in pixels to decode.
    var maxPixels: Int {
        switch self {
        case .thumb: return 300
        case .compact: return 540
        case .full: return 1100
        }
    }

    /// Size requested from the Google photo server for web photos.
    var remoteSuffix: String {
        switch self {
        case .thumb: return "=w300-h300-k-no"
        case .compact: return "=w540-h540-k-no"
        case .full: return "=w720-h480-k-no"
        }
    }
}

/// Loads stay photos without slowing scrolling:
/// - decodes off the main thread with ImageIO, straight to the display size (no full-size decode);
/// - keeps decoded photos in a memory cache with a byte budget;
/// - shares one download/decode between every view that asks for the same photo at once;
/// - keeps web photos on disk (URLCache) so they open offline after the first view.
final class ImagePipeline: @unchecked Sendable {
    static let shared = ImagePipeline()

    private let memory: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.totalCostLimit = 120 * 1024 * 1024   // ~120 MB of decoded pixels
        cache.countLimit = 600
        return cache
    }()

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 20 * 1024 * 1024, diskCapacity: 400 * 1024 * 1024)
        config.requestCachePolicy = .returnCacheDataElseLoad
        config.timeoutIntervalForRequest = 20
        config.httpMaximumConnectionsPerHost = 6
        return URLSession(configuration: config)
    }()

    private let lock = NSLock()
    private var inFlight: [String: Task<UIImage?, Never>] = [:]

    private init() {
        // Drop decoded photos when iOS asks for memory; they reload quickly from disk.
        NotificationCenter.default.addObserver(forName: UIApplication.didReceiveMemoryWarningNotification,
                                               object: nil, queue: nil) { [memory] _ in
            memory.removeAllObjects()
        }
    }

    private func key(_ path: String, _ size: PhotoSize) -> String { "\(path)#\(size.maxPixels)" }

    /// Instant lookup for views that were on screen before (no fade, no flicker).
    func cached(_ path: String, size: PhotoSize) -> UIImage? {
        memory.object(forKey: key(path, size) as NSString)
    }

    func image(_ path: String, size: PhotoSize) async -> UIImage? {
        let k = key(path, size)
        if let hit = memory.object(forKey: k as NSString) { return hit }

        let task: Task<UIImage?, Never> = lock.withLock {
            if let running = inFlight[k] { return running }
            let t = Task.detached(priority: .userInitiated) { [self] in
                await self.load(path, size: size)
            }
            inFlight[k] = t
            return t
        }
        let image = await task.value
        lock.withLock { inFlight[k] = nil }
        if let image {
            let cost = Int(image.size.width * image.size.height * image.scale * image.scale * 4)
            memory.setObject(image, forKey: k as NSString, cost: cost)
        }
        return image
    }

    /// Warm up photos that are about to appear (next carousel page, next cards).
    func prefetch(_ paths: [String], size: PhotoSize) {
        for path in paths where cached(path, size: size) == nil {
            Task.detached(priority: .utility) { [self] in _ = await self.image(path, size: size) }
        }
    }

    // MARK: Loading

    private func load(_ path: String, size: PhotoSize) async -> UIImage? {
        if path.hasPrefix("http") {
            guard let url = URL(string: Self.resized(path, size)),
                  let (data, response) = try? await session.data(from: url),
                  (response as? HTTPURLResponse)?.statusCode ?? 200 < 400 else { return nil }
            guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else { return nil }
            return Self.downsample(source, maxPixels: size.maxPixels)
        }
        guard let url = Self.bundleURL(path),
              let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary) else { return nil }
        return Self.downsample(source, maxPixels: size.maxPixels)
    }

    /// Decodes straight to the target size, ready to draw (no work left for the main thread).
    private static func downsample(_ source: CGImageSource, maxPixels: Int) -> UIImage? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: cg)
    }

    /// Asks Google's photo server for only the size we show.
    private static func resized(_ path: String, _ size: PhotoSize) -> String {
        guard path.contains("googleusercontent.com"), let range = path.range(of: "=w", options: .backwards) else { return path }
        return String(path[..<range.lowerBound]) + size.remoteSuffix
    }

    private static let imageFolder = Bundle.main.resourceURL?.appendingPathComponent("img", isDirectory: true)

    private static func bundleURL(_ path: String) -> URL? {
        // Paths look like "img/a012-0.heic"; the folder is copied as-is into the app.
        let name = (path as NSString).lastPathComponent
        guard let url = imageFolder?.appendingPathComponent(name) else { return nil }
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }
}
