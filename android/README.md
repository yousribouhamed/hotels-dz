# Zalumo — Android

React Native (Expo SDK 57) version of the iOS app in [`../ios`](../ios).

Keep the repo outside iCloud-synced folders (Desktop/Documents): iCloud offloads files
during builds, which makes Gradle, npm and Xcode stall.
Same screens, data, logic, translations (English / Français / العربية in Darja) and palette.

## Keep both apps in sync

The iOS project is the source of truth for content. After changing hotels, translations,
fonts or photos there, run:

```sh
npm run sync                  # hotel data, translations, photo index, fonts, laurel
sh scripts/photos-to-webp.sh  # only when bundled photos changed (needs: brew install webp)
```

## Run on the emulator

```sh
npx expo start                # Metro bundler
npm run android               # build + install the debug app
```

## Release to Google Play

Builds and signing go through EAS (Expo's cloud). The Play signing key is kept by EAS.

```sh
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile production   # .aab for Play
npx eas-cli@latest submit -p android --profile production  # uploads to the Play "internal" track
```

Before the first release, run `npx eas-cli@latest update:configure` so the app can apply
the Arabic right-to-left switch (and receive small fixes) without a store update.

## Notes

- Map: MapLibre with free OpenFreeMap tiles (no API key).
- Bundled photos are WebP (works on every Android version); web photos are resized per screen.
- Arabic uses the Thmanyah Sans typeface (licence allows embedding in apps).
- Switching to or from Arabic restarts the app once so Android can mirror the layout.
