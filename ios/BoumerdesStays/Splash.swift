import SwiftUI
import UIKit

// MARK: - Opening animation
//
// Like the app icon: the launch screen is plain lime (SplashBackground). Over it the forest mark fades in
// on a soft halo, dips slightly, then turns into a window: the lime cover gets a mark-shaped hole that
// grows past the screen edges, so the app (welcome screens or Explore) is revealed through the logo.

/// Fills everything except a mark-shaped window of the given width, centred.
private struct MarkWindowCover: Shape {
    var windowWidth: CGFloat
    var animatableData: CGFloat {
        get { windowWidth }
        set { windowWidth = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path(rect.insetBy(dx: -4, dy: -4))
        guard windowWidth > 0 else { return path }
        let h = windowWidth / ZalumoMark.aspect
        path.addPath(ZalumoMark.path(fitting: CGRect(x: rect.midX - windowWidth / 2, y: rect.midY - h / 2,
                                                       width: windowWidth, height: h)))
        return path
    }
}

struct SplashOverlay: View {
    /// First launch: a slower, fuller version. Later launches keep it short.
    let unhurried: Bool
    /// Called just before the window opens, so the content can settle in step with it.
    let onReveal: () -> Void
    let onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var markWidth: CGFloat = 64
    @State private var markOpacity = 0.0
    @State private var windowWidth: CGFloat = 0
    @State private var glow = 0.0
    @State private var glowScale: CGFloat = 0.7
    @State private var coverOpacity = 1.0

    private static let restingWidth: CGFloat = 104
    /// One smooth curve for the whole reveal: slow start, long soft landing.
    private static let reveal = Animation.timingCurve(0.65, 0, 0.25, 1, duration: 0.95)

    var body: some View {
        GeometryReader { geo in
            ZStack {
                MarkWindowCover(windowWidth: windowWidth)
                    .fill(Color.splash, style: FillStyle(eoFill: true))
                    .opacity(coverOpacity)

                Circle()
                    .fill(RadialGradient(colors: [Color.white.opacity(0.75), Color.white.opacity(0.22), .clear],
                                         center: .center, startRadius: 4, endRadius: 190))
                    .frame(width: 380, height: 380)
                    .scaleEffect(glowScale)
                    .blur(radius: 26)
                    .opacity(glow)

                GrowingMark(width: markWidth)
                    .fill(Color.splashMark)
                    .opacity(markOpacity)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .task { await run(screen: geo.size) }
        }
        .ignoresSafeArea()
        .allowsHitTesting(coverOpacity > 0.5)
        .accessibilityHidden(true)
    }

    private func run(screen: CGSize) async {
        if reduceMotion {
            withAnimation(.easeOut(duration: 0.3)) { markWidth = Self.restingWidth; markOpacity = 1 }
            try? await Task.sleep(for: .seconds(0.45))
            onReveal()
            withAnimation(.easeInOut(duration: 0.35)) { coverOpacity = 0; markOpacity = 0 }
            try? await Task.sleep(for: .seconds(0.4))
            onFinish()
            return
        }

        // 1. The mark arrives on a breathing glow.
        withAnimation(.smooth(duration: unhurried ? 0.8 : 0.55)) {
            markWidth = Self.restingWidth
            markOpacity = 1
        }
        withAnimation(.easeOut(duration: unhurried ? 1.1 : 0.7)) {
            glow = 1
            glowScale = 1
        }
        try? await Task.sleep(for: .seconds(unhurried ? 0.85 : 0.5))

        // 2. A small dip before it opens, like taking a breath. The content starts moving underneath now,
        // so it is already in motion when the window shows it.
        onReveal()
        withAnimation(.smooth(duration: 0.28)) {
            markWidth = Self.restingWidth * 0.88
            glowScale = 1.15
        }
        try? await Task.sleep(for: .seconds(0.26))

        // 3. The mark becomes a window and grows until the whole screen is inside it.
        // The narrowest part of the mark is about 0.4 of its width, so it must outgrow the diagonal 2.5 times over.
        let target = hypot(screen.width, screen.height) * 2.8
        var still = Transaction()
        still.disablesAnimations = true
        withTransaction(still) { windowWidth = markWidth }
        UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.7)
        withAnimation(Self.reveal) {
            windowWidth = target
            markWidth = target
        }
        withAnimation(.easeOut(duration: 0.32)) { markOpacity = 0 }
        withAnimation(.easeOut(duration: 0.45)) { glow = 0 }
        try? await Task.sleep(for: .seconds(0.85))
        withAnimation(.easeOut(duration: 0.15)) { coverOpacity = 0 }
        try? await Task.sleep(for: .seconds(0.16))
        onFinish()
    }
}
