#!/bin/sh
# Builds the signed Android App Bundle (.aab) for Google Play on this Mac, without EAS.
# Signs with the upload key in ~/Developer/zalumo-signing (override with SIGNING_PROPS=…).
# Bump "versionCode" in app.json before every new upload: Play rejects a code it has seen.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROPS="${SIGNING_PROPS:-$HOME/Developer/zalumo-signing/keystore.properties}"
export JAVA_HOME="${JAVA_HOME:-$HOME/.jdks/jdk-17.0.20.1+1/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/sdk}"

prop() { sed -n "s/^$1=//p" "$PROPS"; }
[ -f "$PROPS" ] || { echo "Missing $PROPS"; exit 1; }

cd "$ROOT"
CI=1 npx expo prebuild -p android --clean --no-install
cd android
# The default 512 MB metaspace runs out compiling expo-updates (KSP) in release.
./gradlew :app:bundleRelease \
  -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g" \
  -Pkotlin.daemon.jvmargs="-Xmx2g -XX:MaxMetaspaceSize=1g" \
  -Pandroid.injected.signing.store.file="$(prop storeFile)" \
  -Pandroid.injected.signing.store.password="$(prop storePassword)" \
  -Pandroid.injected.signing.key.alias="$(prop keyAlias)" \
  -Pandroid.injected.signing.key.password="$(prop keyPassword)"

VERSION=$(node -p "require('$ROOT/app.json').expo.version")
CODE=$(node -p "require('$ROOT/app.json').expo.android.versionCode")
OUT="$ROOT/Zalumo-$VERSION-$CODE.aab"
cp app/build/outputs/bundle/release/app-release.aab "$OUT"
echo "Bundle ready: $OUT"
