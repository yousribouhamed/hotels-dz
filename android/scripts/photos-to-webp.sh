#!/bin/sh
# Converts the iOS app's bundled HEIC photos (only those used in hotels.json) to WebP,
# which every Android version can decode. Needs: jq, sips (macOS), cwebp (brew install webp).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RES="${IOS_PROJECT:-$ROOT/../ios}/BoumerdesStays/Resources"
OUT="$ROOT/assets/img"
TMP="$(mktemp -d)"
mkdir -p "$OUT"

convert_one() {
  b=$(basename "$1" .heic)
  out="$OUT/$(echo "$b" | tr - _).webp"
  [ -f "$out" ] && return 0
  sips -s format png "$RES/$1" --out "$TMP/$b.png" >/dev/null 2>&1 \
    && cwebp -quiet -q 72 -m 5 "$TMP/$b.png" -o "$out" && rm -f "$TMP/$b.png" \
    || echo "FAIL $1"
}

jq -r '[.[].photos[] | select(startswith("http") | not)] | unique | .[]' "$RES/hotels.json" |
while read -r p; do convert_one "$p"; done

echo "$(ls "$OUT" | wc -l) photos, $(du -sh "$OUT" | cut -f1)"
