import { useEffect, useState } from 'react';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';

/** Free OpenFreeMap styles (no API key). Points of interest are hidden, like the iOS map. */
const urls = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const cache: Partial<Record<'light' | 'dark', StyleSpecification>> = {};

export function useMapStyle(dark: boolean): StyleSpecification | string {
  const key = dark ? 'dark' : 'light';
  const [style, setStyle] = useState<StyleSpecification | string>(cache[key] ?? urls[key]);
  useEffect(() => {
    if (cache[key]) {
      setStyle(cache[key]!);
      return;
    }
    let cancelled = false;
    fetch(urls[key])
      .then((r) => r.json())
      .then((json: StyleSpecification) => {
        const clean = { ...json, layers: json.layers.filter((l) => !l.id.startsWith('poi')) };
        cache[key] = clean;
        if (!cancelled) setStyle(clean);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);
  return style;
}
