import raw from '../../assets/data/hotels.json';
import { L, LF, formatDecimal } from './i18n';

export type Ad = { site?: string | null; dzd?: number | null };
export type Amenity = { n: string; y: boolean };
export type Review = { s?: number | null; t: string; d: string };
export type Distribution = {
  oneStar?: number | null;
  twoStar?: number | null;
  threeStar?: number | null;
  fourStar?: number | null;
  fiveStar?: number | null;
};

export type Hotel = {
  id: number;
  region?: string | null;
  name: string;
  type: string;
  stars?: number | null;
  rating?: number | null;
  reviews: number;
  phone: string;
  address: string;
  city: string;
  lat?: number | null;
  lng?: number | null;
  /** Nightly rate in dinars, as listed online (the app never converts currencies). */
  dzd?: number | null;
  ads: Ad[];
  web: string;
  email: string;
  maps?: string | null;
  photos: string[];
  am: Amenity[];
  desc: string;
  revs: Review[];
  dist?: Distribution | null;
  tags: string[];
  closed: boolean;
  cin?: string | null;
  /** Listings on booking sites; only stays added from those sites have them. */
  ota?: SiteListing[] | null;
};

/** Price and guest score from one booking site (Wego, Booking.com), kept apart from the Google data. Scores are out of 10. */
export type SiteListing = { site: string; sid?: number | null; score?: number | null; count: number; dzd?: number | null; checked: string };

export const hotels: Hotel[] = raw as Hotel[];
export const hotelById = new Map(hotels.map((h) => [h.id, h]));

export const regionName = (h: Hotel) => h.region ?? 'Boumerdès';

/** Lowest nightly rate listed online, in dinars. */
export function lowestDZD(h: Hotel): number | null {
  const all = [h.dzd, ...h.ads.map((a) => a.dzd)].filter((p): p is number => typeof p === 'number' && p > 0);
  return all.length ? Math.min(...all) : null;
}

/** Every rate listed, cheapest first. */
export function rateRows(h: Hotel): { site: string; dzd: number }[] {
  const rows: { site: string; dzd: number }[] = [];
  if (h.dzd != null) rows.push({ site: 'Online rate', dzd: h.dzd });
  for (const ad of h.ads) if (ad.dzd != null) rows.push({ site: ad.site ?? 'Booking site', dzd: ad.dzd });
  return rows.sort((a, b) => a.dzd - b.dzd);
}

/** Rating pulled toward 4.0 for places with few reviews, so a single 5-star review doesn't top the list. */
export function weightedScore(h: Hotel) {
  if (h.rating == null) return -1;
  return (h.rating * h.reviews + 4 * 8) / (h.reviews + 8);
}

export function ratingLabel(h: Hotel) {
  const r = h.rating;
  if (r == null) return L('No reviews yet');
  if (r >= 4.5) return L('Excellent');
  if (r >= 4.0) return L('Very good');
  if (r >= 3.5) return L('Good');
  return L('Mixed');
}

export const reviewCountText = (h: Hotel) => (h.reviews === 1 ? L('1 review') : LF('%d reviews', h.reviews));

/** The booking-site score with the most reviews, for stays without a Google rating. */
export function siteRating(h: Hotel): SiteListing | null {
  if (h.rating != null) return null;
  const rated = (h.ota ?? []).filter((o) => o.score != null && o.count > 0);
  return rated.length ? rated.reduce((a, b) => (b.count > a.count ? b : a)) : null;
}

/** "8.1/10" */
export const siteScoreText = (h: Hotel) => {
  const s = siteRating(h);
  return s?.score != null ? `${formatDecimal(s.score)}/10` : null;
};

/** "295 reviews on Wego" */
export const siteReviewsText = (h: Hotel) => {
  const s = siteRating(h);
  return s ? LF('%d reviews on %@', s.count, s.site) : null;
};

export const starsText = (h: Hotel) => (h.stars && h.stars > 0 ? '★'.repeat(h.stars) : null);

export const metaLine = (h: Hotel) => [L(h.type), h.city].join(' · ');

/** Top-rated: 4.8 or higher. */
export const isGuestFavourite = (h: Hotel) => (h.rating ?? 0) >= 4.8;

export function telURL(h: Hotel) {
  const digits = h.phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

export const websiteURL = (h: Hotel) => (h.web.startsWith('http') ? h.web : null);

export const websiteLabel = (h: Hotel) =>
  h.web.replace('https://', '').replace('http://', '').replace('www.', '').replace(/^\/+|\/+$/g, '');

export const googleMapsURL = (h: Hotel) => (h.maps && h.maps.startsWith('http') ? h.maps : null);

/** Opens the phone's maps app at the stay (Android's equivalent of the Apple Maps link). */
export const mapsAppURL = (h: Hotel) =>
  h.lat != null && h.lng != null ? `geo:${h.lat},${h.lng}?q=${h.lat},${h.lng}(${encodeURIComponent(h.name)})` : null;

export const searchText = (h: Hotel) => [h.name, h.city, h.address, h.type, regionName(h)].join(' ').toLowerCase();

export const Money = {
  /** Prices are stored in dinars exactly as listed online. */
  dzd: (amount: number) => Money.format(amount),
  /** "7 000 DZD" with non-breaking spaces. */
  format: (dzd: number) => `${String(dzd).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${L('DZD')}`,
};

export type StaySort = 'Best match' | 'Most reviewed' | 'Lowest price' | 'Nearest centre' | 'Name A–Z';
export const staySorts: StaySort[] = ['Best match', 'Most reviewed', 'Lowest price', 'Nearest centre', 'Name A–Z'];

/** The quick All / Hotels / Hostels switch above the results. */
export type StayKind = 'All' | 'Hotels' | 'Hostels';
export const stayKinds: StayKind[] = ['All', 'Hotels', 'Hostels'];
const hotelTypes = ['Hotel', 'Motel', 'Resort', 'Aparthotel'];
export function kindIncludes(kind: StayKind, type: string) {
  if (kind === 'Hotels') return hotelTypes.includes(type);
  if (kind === 'Hostels') return type === 'Hostel';
  return true;
}
