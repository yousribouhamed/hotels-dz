import { L, LF } from './i18n';
import { Hotel, Money, hotels, lowestDZD, regionName } from './model';

// MARK: Geography

export const RegionCentre: Record<string, { lat: number; lng: number; label: string }> = {
  Algiers: { lat: 36.7729, lng: 3.0586, label: 'Grande Poste' },
  'Boumerdès': { lat: 36.7664, lng: 3.4772, label: 'Boumerdès centre' },
  Tipaza: { lat: 36.5917, lng: 2.4475, label: 'Tipaza centre' },
  Biskra: { lat: 34.8481, lng: 5.7281, label: 'Biskra centre' },
  'Sétif': { lat: 36.1898, lng: 5.4108, label: 'Aïn El Fouara' },
  Annaba: { lat: 36.9003, lng: 7.7558, label: 'Cours de la Révolution' },
  Oran: { lat: 35.6971, lng: -0.6337, label: 'Place du 1er Novembre' },
  Tlemcen: { lat: 34.8828, lng: -1.3167, label: 'Tlemcen centre' },
  Constantine: { lat: 36.365, lng: 6.6147, label: 'Place du 1er Novembre' },
  'Béjaïa': { lat: 36.7525, lng: 5.0843, label: 'Place Gueydon' },
  Batna: { lat: 35.5559, lng: 6.1741, label: 'Batna centre' },
  'El Oued': { lat: 33.3683, lng: 6.8674, label: 'El Oued centre' },
  Tamanrasset: { lat: 22.785, lng: 5.5228, label: 'Tamanrasset centre' },
  Adrar: { lat: 27.8743, lng: -0.2939, label: 'Adrar centre' },
  Tindouf: { lat: 27.6711, lng: -8.1474, label: 'Tindouf centre' },
  Jijel: { lat: 36.8206, lng: 5.7667, label: 'Jijel centre' },
  'El Tarf': { lat: 36.7672, lng: 8.3138, label: 'El Tarf centre' },
  Guelma: { lat: 36.4621, lng: 7.4261, label: 'Guelma centre' },
  Tébessa: { lat: 35.4042, lng: 8.1242, label: 'Tébessa centre' },
  Ouargla: { lat: 31.9493, lng: 5.325, label: 'Ouargla centre' },
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6371, t = Math.PI / 180;
  const dLa = (lat2 - lat1) * t, dLo = (lng2 - lng1) * t;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(dLo / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

// MARK: Amenities

export type AmenityKey =
  | 'wifi' | 'parking' | 'breakfast' | 'aircon' | 'restaurant' | 'shuttle' | 'family' | 'pool' | 'pets' | 'fitness' | 'spa';

export const amenityKeys: AmenityKey[] = [
  'wifi', 'parking', 'breakfast', 'aircon', 'restaurant', 'shuttle', 'family', 'pool', 'pets', 'fitness', 'spa',
];

const amenityTitles: Record<AmenityKey, string> = {
  wifi: 'Wi-Fi', parking: 'Parking', breakfast: 'Breakfast', aircon: 'Air con', restaurant: 'Restaurant',
  shuttle: 'Airport shuttle', family: 'Kid-friendly', pool: 'Pool', pets: 'Pets OK', fitness: 'Gym', spa: 'Spa',
};
export const amenityTitle = (k: AmenityKey) => L(amenityTitles[k]);

/** Material Community Icons names for each amenity filter. */
export const amenityIcon: Record<AmenityKey, string> = {
  wifi: 'wifi', parking: 'parking', breakfast: 'coffee', aircon: 'snowflake', restaurant: 'silverware-fork-knife',
  shuttle: 'airplane', family: 'human-male-female-child', pool: 'pool', pets: 'paw', fitness: 'dumbbell', spa: 'spa',
};

/** Names as they appear in the listing amenities. */
const amenityNames: Record<AmenityKey, string[]> = {
  wifi: ['Free Wi-Fi', 'Wi-Fi'],
  parking: ['Free parking', 'Parking'],
  breakfast: ['Breakfast included', 'Breakfast', 'Paid breakfast'],
  aircon: ['Air conditioning'],
  restaurant: ['Restaurant'],
  shuttle: ['Airport shuttle'],
  family: ['Kid-friendly'],
  pool: ['Pool', 'Outdoor pool', 'Indoor pool', 'Indoor & outdoor pool'],
  pets: ['Pets allowed'],
  fitness: ['Fitness centre'],
  spa: ['Spa', 'Hot tub'],
};

// MARK: Precomputed traits

/** Facts derived once per stay so filtering and counting stay fast. */
export type StayTraits = {
  dzd: number | null;
  km: number | null;
  centreLabel: string | null;
  amenities: Set<AmenityKey>;
};

function makeTraits(h: Hotel): StayTraits {
  const dzd = lowestDZD(h);
  const c = RegionCentre[regionName(h)];
  const km = h.lat != null && h.lng != null && c ? haversineKm(h.lat, h.lng, c.lat, c.lng) : null;
  const keys = new Set<AmenityKey>();
  for (const a of h.am) {
    if (!a.y) continue;
    for (const k of amenityKeys) if (amenityNames[k].includes(a.n)) keys.add(k);
  }
  return { dzd, km, centreLabel: km != null ? c.label : null, amenities: keys };
}

const traitsById = new Map(hotels.map((h) => [h.id, makeTraits(h)]));
export const traits = (h: Hotel) => traitsById.get(h.id) ?? makeTraits(h);

// MARK: Filters

export type Facet = 'types' | 'towns' | 'rating' | 'reviews' | 'stars' | 'amenities' | 'price' | 'distance' | 'phone' | 'photos';

export type StayFilters = {
  types: string[];
  towns: string[];
  minRating: number;
  minReviews: number;
  stars: number[];
  amenities: AmenityKey[];
  priceMin: number | null;
  priceMax: number | null;
  includeUnpriced: boolean;
  maxKm: number | null;
  phoneOnly: boolean;
  photosOnly: boolean;
};

export const emptyFilters = (): StayFilters => ({
  types: [], towns: [], minRating: 0, minReviews: 0, stars: [], amenities: [],
  priceMin: null, priceMax: null, includeUnpriced: true, maxKm: null, phoneOnly: false, photosOnly: false,
});

export function activeCount(f: StayFilters) {
  let n = f.types.length + f.towns.length + f.stars.length + f.amenities.length;
  if (f.minRating > 0) n++;
  if (f.minReviews > 0) n++;
  if (f.priceMin != null || f.priceMax != null) n++;
  if (!f.includeUnpriced) n++;
  if (f.maxKm != null) n++;
  if (f.phoneOnly) n++;
  if (f.photosOnly) n++;
  return n;
}

export function matches(f: StayFilters, h: Hotel, t: StayTraits, skip?: Facet) {
  if (skip !== 'types' && f.types.length && !f.types.includes(h.type)) return false;
  if (skip !== 'towns' && f.towns.length && !f.towns.includes(h.city)) return false;
  if (skip !== 'rating' && f.minRating > 0 && (h.rating ?? 0) < f.minRating) return false;
  if (skip !== 'reviews' && f.minReviews > 0 && h.reviews < f.minReviews) return false;
  if (skip !== 'stars' && f.stars.length && !f.stars.includes(h.stars ?? 0)) return false;
  if (skip !== 'amenities' && !f.amenities.every((a) => t.amenities.has(a))) return false;
  if (skip !== 'price') {
    if (t.dzd != null) {
      if (f.priceMin != null && t.dzd < f.priceMin) return false;
      if (f.priceMax != null && t.dzd > f.priceMax) return false;
    } else if (!f.includeUnpriced) return false;
  }
  if (skip !== 'distance' && f.maxKm != null && (t.km ?? Infinity) > f.maxKm) return false;
  if (skip !== 'phone' && f.phoneOnly && !h.phone) return false;
  if (skip !== 'photos' && f.photosOnly && !h.photos.length) return false;
  return true;
}

export const countMatching = (f: StayFilters, list: Hotel[], skip?: Facet) =>
  list.reduce((n, h) => n + (matches(f, h, traits(h), skip) ? 1 : 0), 0);

/** One removable chip in the "Your filters" summary. */
export type FilterChipItem = { id: string; label: string; remove: (f: StayFilters) => StayFilters };

export function chips(f: StayFilters): FilterChipItem[] {
  const out: FilterChipItem[] = [];
  for (const t of [...f.types].sort())
    out.push({ id: `t-${t}`, label: L(t), remove: (x) => ({ ...x, types: x.types.filter((v) => v !== t) }) });
  for (const t of [...f.towns].sort())
    out.push({ id: `w-${t}`, label: t, remove: (x) => ({ ...x, towns: x.towns.filter((v) => v !== t) }) });
  if (f.minRating > 0)
    out.push({ id: 'rating', label: LF('Rated %@+', f.minRating.toFixed(1)), remove: (x) => ({ ...x, minRating: 0 }) });
  if (f.minReviews > 0)
    out.push({ id: 'reviews', label: LF('%d+ reviews', f.minReviews), remove: (x) => ({ ...x, minReviews: 0 }) });
  for (const s of [...f.stars].sort())
    out.push({ id: `s-${s}`, label: LF('%d★ hotel', s), remove: (x) => ({ ...x, stars: x.stars.filter((v) => v !== s) }) });
  for (const a of amenityKeys.filter((k) => f.amenities.includes(k)))
    out.push({ id: `a-${a}`, label: amenityTitle(a), remove: (x) => ({ ...x, amenities: x.amenities.filter((v) => v !== a) }) });
  if (f.priceMin != null || f.priceMax != null) {
    const lo = f.priceMin != null ? Money.format(f.priceMin) : L('Any');
    const hi = f.priceMax != null ? Money.format(f.priceMax) : L('any');
    out.push({ id: 'price', label: `${lo} – ${hi}`, remove: (x) => ({ ...x, priceMin: null, priceMax: null }) });
  }
  if (!f.includeUnpriced)
    out.push({ id: 'priced', label: L('Online price only'), remove: (x) => ({ ...x, includeUnpriced: true }) });
  if (f.maxKm != null)
    out.push({ id: 'km', label: LF('Within %d km of centre', f.maxKm), remove: (x) => ({ ...x, maxKm: null }) });
  if (f.phoneOnly) out.push({ id: 'phone', label: L('Has phone'), remove: (x) => ({ ...x, phoneOnly: false }) });
  if (f.photosOnly) out.push({ id: 'photos', label: L('Has photos'), remove: (x) => ({ ...x, photosOnly: false }) });
  return out;
}
