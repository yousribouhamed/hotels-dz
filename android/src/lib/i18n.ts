import { getLocales } from 'expo-localization';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import ar from '../i18n/ar.json';

export type Lang = 'en' | 'fr' | 'ar';
export type LanguageSetting = 'system' | Lang;

/** Wording that differs on Android (the iOS strings mention the iPhone). */
const android: Record<Lang, Record<string, string>> = {
  en: { 'Follows your iPhone settings': 'Follows your phone settings' },
  fr: { 'Follows your iPhone settings': 'Suit les réglages de votre téléphone', 'Continue with Apple': 'Continuer avec Apple' },
  ar: { 'Follows your iPhone settings': 'كيما راهو التيليفون تاعك', 'Continue with Apple': 'كمّل بـ Apple' },
};

const tables: Record<Lang, Record<string, string>> = {
  en: { ...en, ...android.en },
  fr: { ...fr, ...android.fr },
  ar: { ...ar, ...android.ar },
};

let current: Lang = 'en';

/** The language in use ("en", "fr" or "ar"). */
export const languageCode = () => current;
export const isArabic = () => current === 'ar';

export function setLanguageCode(lang: Lang) {
  current = lang;
}

/** "Device language" picks the first supported language in the phone's settings. */
export function resolveLanguage(setting: LanguageSetting): Lang {
  if (setting !== 'system') return setting;
  for (const l of getLocales()) {
    const code = (l.languageCode ?? '').toLowerCase();
    if (code === 'en' || code === 'fr' || code === 'ar') return code;
  }
  return 'en';
}

/** Algerian regional formats; Arabic in Algeria writes Latin digits. */
export function intlLocale(lang: Lang = current) {
  return lang === 'fr' ? 'fr-DZ' : lang === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-GB';
}

/** Translation of a key (keys are the English text, as in the iOS app). */
export function L(key: string): string {
  return tables[current][key] ?? key;
}

/**
 * Translated format string using the iOS placeholders: %@ %d %lld and positional %1$@ / %2$d.
 * Example: LF('Show %d stays', 12)
 */
export function LF(key: string, ...args: (string | number)[]): string {
  let next = 0;
  return L(key).replace(/%(?:(\d+)\$)?(@|lld|ld|d|\.1f)/g, (_m, pos: string | undefined, kind: string) => {
    const i = pos ? Number(pos) - 1 : next++;
    const v = args[i];
    if (v === undefined) return '';
    if (kind === '.1f') return formatDecimal(Number(v));
    return String(v);
  });
}

/** One decimal, in the regional style ("4.8" / "4,8"). */
export function formatDecimal(n: number) {
  return new Intl.NumberFormat(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
}

export function formatInt(n: number) {
  return new Intl.NumberFormat(intlLocale(), { useGrouping: false }).format(n);
}

/** "29 Sep 2026" in the current language. */
export function formatDay(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(current === 'fr' ? 'fr-FR' : current === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** "92 m" / "2.8 km" */
export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} ${L('m')}` : `${formatDecimal(km)} ${L('km')}`;
}
