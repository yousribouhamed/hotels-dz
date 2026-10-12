# Zalumo

Browse hotels, hostels and guest houses across Algeria's wilayas, in English, French and
Arabic (Algerian Darja, right-to-left). Prices are shown in dinars at the parallel rate.

| Folder | App | Stack |
| --- | --- | --- |
| [`ios/`](ios) | iPhone | SwiftUI, iOS 17+, project generated with XcodeGen |
| [`android/`](android) | Android | React Native (Expo SDK 57), expo-router, MapLibre |

Both apps share the same screens, data and translations. The iOS app is the source of truth
for content (`ios/BoumerdesStays/Resources`); `android/scripts/sync-from-ios.mjs` copies the
hotel data, translations, fonts and artwork across.

## iOS

```sh
cd ios
xcodegen generate   # after adding files or resources
open BoumerdesStays.xcodeproj
```

## Android

```sh
cd android
npm install
npm run sync        # pull content from ../ios
npx expo run:android
```

See [`android/README.md`](android/README.md) for release builds (APK / App Bundle).

Keep the repo outside iCloud-synced folders (Desktop, Documents): iCloud offloads files
during builds, which makes Xcode, Gradle and npm stall.
