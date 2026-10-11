import SwiftUI
import UIKit
import CoreText

/// Arabic text uses the Thmanyah Sans typeface (ثمانية); English and French keep the
/// system font. Every text style goes through `Font.app(_:_:)` so the switch is in one place.
enum Typography {
    /// Font files bundled in Resources/Fonts, by weight.
    private static let faces: [(Font.Weight, String)] = [
        (.light, "thmanyahsans-Light"),
        (.regular, "thmanyahsans-Regular"),
        (.medium, "thmanyahsans-Medium"),
        (.semibold, "thmanyahsans-Bold"),
        (.bold, "thmanyahsans-Bold"),
        (.heavy, "thmanyahsans-Black"),
        (.black, "thmanyahsans-Black"),
    ]

    private static var registered = false

    /// Registers the bundled fonts once, without needing an Info.plist entry.
    static func registerFonts() {
        guard !registered else { return }
        registered = true
        let urls = Bundle.main.urls(forResourcesWithExtension: "otf", subdirectory: nil) ?? []
        for url in urls where url.lastPathComponent.hasPrefix("thmanyah") {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }

    static var usesThmanyah: Bool { Bundle.languageCode == "ar" }

    static func faceName(_ weight: Font.Weight) -> String {
        faces.first { $0.0 == weight }?.1 ?? "thmanyahsans-Regular"
    }

    /// Point sizes of Apple's text styles at the default Dynamic Type size.
    static func baseSize(_ style: Font.TextStyle) -> CGFloat {
        switch style {
        case .largeTitle: return 34
        case .title: return 28
        case .title2: return 22
        case .title3: return 20
        case .headline: return 17
        case .body: return 17
        case .callout: return 16
        case .subheadline: return 15
        case .footnote: return 13
        case .caption: return 12
        case .caption2: return 11
        @unknown default: return 17
        }
    }

    static func defaultWeight(_ style: Font.TextStyle) -> Font.Weight {
        style == .headline ? .semibold : .regular
    }

    /// Navigation and tab bar titles are drawn by UIKit, so they're styled through appearance.
    static func applyBarAppearance() {
        // Text fields and other UIKit controls lay out right-to-left in Arabic even when the phone is in English.
        let direction: UISemanticContentAttribute = usesThmanyah ? .forceRightToLeft : .unspecified
        UITextField.appearance().semanticContentAttribute = direction
        UITextField.appearance().textAlignment = usesThmanyah ? .right : .natural
        let nav = UINavigationBar.appearance()
        let tab = UITabBarItem.appearance()
        if usesThmanyah,
           let large = UIFont(name: "thmanyahsans-Bold", size: 34),
           let inline = UIFont(name: "thmanyahsans-Bold", size: 17),
           let item = UIFont(name: "thmanyahsans-Medium", size: 11) {
            nav.largeTitleTextAttributes = [.font: UIFontMetrics(forTextStyle: .largeTitle).scaledFont(for: large)]
            nav.titleTextAttributes = [.font: UIFontMetrics(forTextStyle: .headline).scaledFont(for: inline)]
            tab.setTitleTextAttributes([.font: item], for: .normal)
            tab.setTitleTextAttributes([.font: item], for: .selected)
        } else {
            nav.largeTitleTextAttributes = nil
            nav.titleTextAttributes = nil
            tab.setTitleTextAttributes(nil, for: .normal)
            tab.setTitleTextAttributes(nil, for: .selected)
        }
    }
}

extension Font {
    /// A text style in the app's typeface: Thmanyah Sans in Arabic, the system font otherwise.
    /// Scales with Dynamic Type either way.
    static func app(_ style: Font.TextStyle, _ weight: Font.Weight? = nil) -> Font {
        if Typography.usesThmanyah {
            let w = weight ?? Typography.defaultWeight(style)
            return .custom(Typography.faceName(w), size: Typography.baseSize(style), relativeTo: style)
        }
        let base = Font.system(style)
        return weight.map { base.weight($0) } ?? base
    }

    /// A fixed size in the app's typeface (for the large rating numbers).
    static func appFixed(size: CGFloat, weight: Font.Weight, design: Font.Design = .default) -> Font {
        if Typography.usesThmanyah {
            return .custom(Typography.faceName(weight), fixedSize: size)
        }
        return .system(size: size, weight: weight, design: design)
    }
}
