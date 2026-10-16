import SwiftUI

// MARK: - Brand

extension Color {
    /// Zalumo lime: the logo on dark backgrounds.
    static let lime = Color(red: 205 / 255, green: 1, blue: 0)
    /// The opening animation mirrors the app icon: lime behind, forest mark. The launch screen uses the
    /// same lime (SplashBackground), so tapping the icon flows straight into the animation.
    static let splash = Color(red: 191 / 255, green: 1, blue: 0)
    static let splashMark = Color(red: 54 / 255, green: 121 / 255, blue: 1 / 255)
}

/// The Zalumo symbol (the two-lobed mark of the logo) as a shape, so it stays sharp at any size,
/// including when the opening animation grows it past the edges of the screen.
struct ZalumoMark: Shape {
    /// Width ÷ height of the mark.
    static let aspect: CGFloat = 1.51269

    func path(in rect: CGRect) -> Path { Self.path(fitting: rect) }

    /// The mark, as large as fits in `rect` and centred in it.
    static func path(fitting rect: CGRect) -> Path {
        var w = rect.width, h = w / aspect
        if h > rect.height { h = rect.height; w = h * aspect }
        let x0 = rect.midX - w / 2, y0 = rect.midY - h / 2
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x0 + x * w, y: y0 + y * h) }
        var path = Path()
        path.move(to: p(0.99914, 0.66351))
        path.addCurve(to: p(0.70314, 0.43399), control1: p(1.01175, 0.53168), control2: p(0.88485, 0.43891))
        path.addCurve(to: p(0.83358, 0.22974), control1: p(0.77752, 0.37538), control2: p(0.82655, 0.30316))
        path.addCurve(to: p(0.44381, 0.00513), control1: p(0.84827, 0.0762), control2: p(0.67375, -0.02434))
        path.addCurve(to: p(0.00086, 0.33648), control1: p(0.21386, 0.0346), control2: p(0.01556, 0.18296))
        path.addCurve(to: p(0.29686, 0.56601), control1: p(-0.01175, 0.46832), control2: p(0.11515, 0.56109))
        path.addCurve(to: p(0.16642, 0.77026), control1: p(0.22248, 0.62462), control2: p(0.17344, 0.69685))
        path.addCurve(to: p(0.55619, 0.99487), control1: p(0.15173, 0.9238), control2: p(0.32625, 1.02434))
        path.addCurve(to: p(0.99914, 0.66351), control1: p(0.78614, 0.9654), control2: p(0.98444, 0.81704))
        path.closeSubpath()
        return path
    }
}

/// The mark at a given width, centred in its frame. Animating the width grows it smoothly, which the
/// opening animation and the welcome picture use as a reveal window.
struct GrowingMark: Shape {
    var width: CGFloat
    var animatableData: CGFloat {
        get { width }
        set { width = newValue }
    }

    func path(in rect: CGRect) -> Path {
        guard width > 0 else { return Path() }
        let h = width / ZalumoMark.aspect
        return ZalumoMark.path(fitting: CGRect(x: rect.midX - width / 2, y: rect.midY - h / 2, width: width, height: h))
    }
}
