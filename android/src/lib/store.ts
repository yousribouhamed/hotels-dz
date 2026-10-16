import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { L } from './i18n';
import type { LanguageSetting } from './i18n';
import { StayFilters, emptyFilters, matches, traits } from './filters';
import { Hotel, StayKind, StaySort, hotels, kindIncludes, regionName, searchText, weightedScore } from './model';

export type Appearance = 'system' | 'light' | 'dark';

type State = {
  ready: boolean;
  // Search state shared by the Explore and Map tabs.
  query: string;
  region: string | null;
  filters: StayFilters;
  sort: StaySort;
  kind: StayKind;
  saved: number[];
  /** Reviews hidden on this phone after a report or block. */
  hiddenReviews: string[];
  language: LanguageSetting;
  appearance: Appearance;

  setQuery: (q: string) => void;
  setRegion: (r: string | null) => void;
  setFilters: (f: StayFilters) => void;
  setSort: (s: StaySort) => void;
  setKind: (k: StayKind) => void;
  toggleSaved: (id: number) => void;
  hideReview: (key: string) => void;
  unhideAllReviews: () => void;
  setLanguage: (l: LanguageSetting) => void;
  setAppearance: (a: Appearance) => void;
  load: () => Promise<void>;
};

const KEY = 'stays.v1';

export const useStore = create<State>((set, get) => {
  const persist = () => {
    const { region, filters, sort, kind, saved, hiddenReviews, language, appearance } = get();
    AsyncStorage.setItem(KEY, JSON.stringify({ region, filters, sort, kind, saved, hiddenReviews, language, appearance })).catch(() => {});
  };
  return {
    ready: false,
    query: '',
    region: null,
    filters: emptyFilters(),
    sort: 'Best match',
    kind: 'All',
    saved: [],
    hiddenReviews: [],
    language: 'system',
    appearance: 'system',

    setQuery: (query) => set({ query }),
    setRegion: (region) => { set({ region }); persist(); },
    setFilters: (filters) => { set({ filters }); persist(); },
    setSort: (sort) => { set({ sort }); persist(); },
    setKind: (kind) => { set({ kind }); persist(); },
    toggleSaved: (id) => {
      const saved = get().saved;
      set({ saved: saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id] });
      persist();
    },
    hideReview: (key) => {
      if (!get().hiddenReviews.includes(key)) set({ hiddenReviews: [...get().hiddenReviews, key] });
      persist();
    },
    unhideAllReviews: () => { set({ hiddenReviews: [] }); persist(); },
    setLanguage: (language) => { set({ language }); persist(); },
    setAppearance: (appearance) => { set({ appearance }); persist(); },

    load: async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          const known = new Set(hotels.map((h) => h.id));
          set({
            region: s.region ?? null,
            filters: { ...emptyFilters(), ...(s.filters ?? {}) },
            sort: s.sort ?? 'Best match',
            kind: s.kind ?? 'All',
            // Stays removed from the data since they were saved are dropped, so the tab badge matches the list.
            saved: Array.isArray(s.saved) ? s.saved.filter((id: number) => known.has(id)) : [],
            hiddenReviews: Array.isArray(s.hiddenReviews) ? s.hiddenReviews : [],
            language: s.language ?? 'system',
            appearance: s.appearance ?? 'system',
          });
        }
      } finally {
        set({ ready: true });
      }
    },
  };
});

// MARK: Derived lists

/** Stays in the chosen wilaya that match the search text, before the kind switch and filters. */
export function searchedHotels(region: string | null, query: string): Hotel[] {
  const q = query.trim().toLowerCase();
  return hotels.filter((h) => (!region || regionName(h) === region) && (!q || searchText(h).includes(q)));
}

/** The searched stays narrowed by the All / Hotels / Hostels switch, before filters. */
export function scopedHotels(region: string | null, query: string, kind: StayKind = 'All'): Hotel[] {
  const list = searchedHotels(region, query);
  return kind === 'All' ? list : list.filter((h) => kindIncludes(kind, h.type));
}

function isOrderedBefore(sort: StaySort, a: Hotel, b: Hotel): number {
  switch (sort) {
    case 'Best match':
      return weightedScore(b) - weightedScore(a) || b.reviews - a.reviews;
    case 'Most reviewed':
      return b.reviews - a.reviews || weightedScore(b) - weightedScore(a);
    case 'Lowest price': {
      const x = traits(a).dzd, y = traits(b).dzd;
      if (x != null && y != null) return x - y;
      if (x != null) return -1;
      if (y != null) return 1;
      return weightedScore(b) - weightedScore(a);
    }
    case 'Nearest centre':
      return (traits(a).km ?? Infinity) - (traits(b).km ?? Infinity);
    case 'Name A–Z':
      return a.name.localeCompare(b.name);
  }
}

export function useScopedAndResults() {
  const region = useStore((s) => s.region);
  const query = useStore((s) => s.query);
  const filters = useStore((s) => s.filters);
  const sort = useStore((s) => s.sort);
  const kind = useStore((s) => s.kind);
  return useMemo(() => {
    const scope = scopedHotels(region, query, kind);
    const results = scope.filter((h) => matches(filters, h, traits(h))).sort((a, b) => isOrderedBefore(sort, a, b));
    return { scope, results };
  }, [region, query, filters, sort, kind]);
}

function counts(values: string[]) {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Wilayas in the data, largest first. */
export const regions = counts(hotels.map(regionName));
export const typesIn = (list: Hotel[]) => counts(list.map((h) => h.type));
export const townsIn = (list: Hotel[]) => counts(list.map((h) => h.city));

/** Wilaya names sorted alphabetically in the current language. */
export const sortedRegionNames = () => regions.map((r) => r.name).sort((a, b) => L(a).localeCompare(L(b)));

export function nearby(hotel: Hotel, limit = 4) {
  if (hotel.lat == null || hotel.lng == null) return [];
  const R = 6371, t = Math.PI / 180;
  return hotels
    .filter((o) => o.id !== hotel.id && o.lat != null && o.lng != null)
    .map((o) => {
      const dLa = (o.lat! - hotel.lat!) * t, dLo = (o.lng! - hotel.lng!) * t;
      const a = Math.sin(dLa / 2) ** 2 + Math.cos(hotel.lat! * t) * Math.cos(o.lat! * t) * Math.sin(dLo / 2) ** 2;
      return { hotel: o, km: 2 * R * Math.asin(Math.min(1, Math.sqrt(a))) };
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

export const useIsSaved = (id: number) => useStore((s) => s.saved.includes(id));
