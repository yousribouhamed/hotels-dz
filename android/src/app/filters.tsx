import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L, LF } from '../lib/i18n';
import { Hotel, Money } from '../lib/model';
import {
  AmenityKey, Facet, StayFilters, amenityIcon, amenityKeys, amenityTitle, chips, countMatching, emptyFilters, activeCount, matches, traits,
} from '../lib/filters';
import { scopedHotels, townsIn, typesIn, useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { Chip, Flow, Icon, T } from '../components/ui';
import { PriceHistogram, RangeSlider } from '../components/range';

/**
 * Full filter sheet. Works on a draft copy so the result count on the button
 * updates live, and every option shows how many stays it would leave.
 */
export default function FilterSheet() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const region = useStore((s) => s.region);
  const query = useStore((s) => s.query);
  const kind = useStore((s) => s.kind);
  const saved = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const [draft, setDraft] = useState<StayFilters>(saved);
  const [showAllTowns, setShowAllTowns] = useState(false);

  const scope = useMemo(() => scopedHotels(region, query, kind), [region, query, kind]);
  const total = countMatching(draft, scope);
  const count = (f: StayFilters) => countMatching(f, scope);
  const toggle = <K extends 'types' | 'towns' | 'stars' | 'amenities'>(key: K, value: StayFilters[K][number]) => {
    const list = draft[key] as (typeof value)[];
    setDraft({ ...draft, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };

  return (
    <View style={[styles.sheet, { backgroundColor: c.canvas }]}>
      <View style={styles.grabberWrap}><View style={[styles.grabber, { backgroundColor: c.tertiary }]} /></View>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={[styles.headerButton, { backgroundColor: c.surface }]}>
          <T v="body" color={c.accent}>{L('Cancel')}</T>
        </Pressable>
        <T v="headline">{L('Filters')}</T>
        <Pressable
          onPress={() => setDraft(emptyFilters())}
          disabled={activeCount(draft) === 0}
          style={[styles.headerButton, { backgroundColor: c.surface, opacity: activeCount(draft) === 0 ? 0.4 : 1 }]}
        >
          <T v="body" color={c.accent}>{L('Clear all')}</T>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 28, paddingBottom: 24 }}>
        {chips(draft).length > 0 && (
          <Section title="Your filters">
            <Flow>
              {chips(draft).map((chip) => (
                <Pressable key={chip.id} onPress={() => setDraft(chip.remove(draft))} accessibilityLabel={LF('Remove %@', chip.label)}>
                  <View style={[styles.activeChip, { backgroundColor: c.brandSoft }]}>
                    <T v="subheadline" w="semibold" color={c.accent}>{chip.label}</T>
                    <Icon name="close" size={12} color={c.accent} />
                  </View>
                </Pressable>
              ))}
            </Flow>
          </Section>
        )}

        <Budget scope={scope} draft={draft} setDraft={setDraft} />

        <Section title="Guest rating">
          <Flow>
            {([[0, 'Any'], [3.5, '3.5+ Good'], [4.0, '4.0+ Very good'], [4.5, '4.5+ Excellent']] as const).map(([value, label]) => {
              const n = count({ ...draft, minRating: value });
              return (
                <Chip key={label} title={label} count={n} isOn={draft.minRating === value} disabled={n === 0}
                  onPress={() => setDraft({ ...draft, minRating: value })} />
              );
            })}
          </Flow>
        </Section>

        <Section title="Number of reviews" subtitle={L('More reviews make a rating more reliable')}>
          <Flow>
            {([[0, 'Any'], [10, '10+'], [50, '50+'], [200, '200+']] as const).map(([value, label]) => {
              const n = count({ ...draft, minReviews: value });
              return (
                <Chip key={label} title={label} count={n} isOn={draft.minReviews === value} disabled={n === 0}
                  onPress={() => setDraft({ ...draft, minReviews: value })} />
              );
            })}
          </Flow>
        </Section>

        <Section title="Distance from centre" subtitle={L('From Grande Poste in Algiers, and from the town centre in the other wilayas')}>
          <Flow>
            {([[null, 'Any'], [1, '1 km'], [3, '3 km'], [5, '5 km'], [10, '10 km']] as const).map(([value, label]) => {
              const n = count({ ...draft, maxKm: value });
              return (
                <Chip key={label} title={label} count={n} isOn={draft.maxKm === value} disabled={n === 0}
                  onPress={() => setDraft({ ...draft, maxKm: value })} />
              );
            })}
          </Flow>
        </Section>

        <Section title="Type of stay">
          <Flow>
            {typesIn(scope).map((t) => {
              const n = count({ ...draft, types: [t.name] });
              return (
                <Chip key={t.name} title={t.name} count={n} isOn={draft.types.includes(t.name)} disabled={n === 0}
                  onPress={() => toggle('types', t.name)} />
              );
            })}
          </Flow>
        </Section>

        <Section title="Hotel class" subtitle={LF('Only %d stays here have an official star rating', scope.filter((h) => (h.stars ?? 0) > 0).length)}>
          <Flow>
            {[1, 2, 3, 4, 5].map((s) => {
              const n = count({ ...draft, stars: [s] });
              return (
                <Chip key={s} title={'★'.repeat(s)} count={n} isOn={draft.stars.includes(s)} disabled={n === 0}
                  onPress={() => toggle('stars', s)} />
              );
            })}
          </Flow>
        </Section>

        <Section
          title="Amenities"
          subtitle={LF('Only %d of these stays list their amenities, so each one narrows the list a lot', scope.filter((h) => h.am.length > 0).length)}
        >
          <View style={styles.grid}>
            {amenityKeys.map((a: AmenityKey) => {
              const isOn = draft.amenities.includes(a);
              const n = count({ ...draft, amenities: [...new Set([...draft.amenities, a])] });
              const off = n === 0 && !isOn;
              return (
                <Pressable
                  key={a}
                  onPress={() => toggle('amenities', a)}
                  disabled={off}
                  style={[
                    styles.amenity,
                    {
                      backgroundColor: isOn ? c.brandSoft : c.surface,
                      borderColor: isOn ? c.accent : c.line + '80',
                      borderWidth: isOn ? 1.5 : 1,
                      opacity: off ? 0.35 : 1,
                    },
                  ]}
                  accessibilityState={{ selected: isOn }}
                >
                  <Icon name={amenityIcon[a] as never} size={22} color={isOn ? c.accent : c.text} />
                  <T v="caption" w="semibold" numberOfLines={1} color={isOn ? c.accent : c.text}>{amenityTitle(a)}</T>
                  <T v="caption2" secondary>{n}</T>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Area">
          <View>
            {(showAllTowns ? townsIn(scope) : townsIn(scope).slice(0, 6)).map((t) => {
              const n = count({ ...draft, towns: [t.name] });
              const isOn = draft.towns.includes(t.name);
              return (
                <View key={t.name}>
                  <Pressable onPress={() => toggle('towns', t.name)} style={[styles.townRow, { opacity: n === 0 && !isOn ? 0.4 : 1 }]}>
                    <Icon name={isOn ? 'check-circle' : 'circle-outline'} size={22} color={isOn ? c.accent : c.secondary} />
                    <T style={{ flex: 1 }}>{t.name}</T>
                    <T secondary>{n}</T>
                  </Pressable>
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />
                </View>
              );
            })}
            {townsIn(scope).length > 6 && (
              <Pressable onPress={() => setShowAllTowns(!showAllTowns)} style={{ paddingTop: 10 }}>
                <T v="subheadline" w="semibold" color={c.accent}>
                  {showAllTowns ? L('Show fewer areas') : LF('Show all %d areas', townsIn(scope).length)}
                </T>
              </Pressable>
            )}
          </View>
        </Section>

        <Section title="Before you call">
          <ToggleRow
            icon="phone"
            label={LF('Has a phone number · %lld', count({ ...draft, phoneOnly: true }))}
            value={draft.phoneOnly}
            onChange={(v) => setDraft({ ...draft, phoneOnly: v })}
          />
          <ToggleRow
            icon="image-multiple"
            label={LF('Has photos · %lld', count({ ...draft, photosOnly: true }))}
            value={draft.photosOnly}
            onChange={(v) => setDraft({ ...draft, photosOnly: v })}
          />
        </Section>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.bar, paddingBottom: 10 + insets.bottom }]}>
        <Pressable
          disabled={total === 0}
          onPress={() => { setFilters(draft); router.back(); }}
          style={[styles.showButton, { backgroundColor: c.accent, opacity: total === 0 ? 0.4 : 1 }]}
        >
          <T v="headline" color={c.onAccent} center>
            {total === 0 ? L('No stays match. Loosen a filter') : total === 1 ? L('Show 1 stay') : LF('Show %d stays', total)}
          </T>
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 3 }}>
        <T v="title3" w="bold">{L(title)}</T>
        {subtitle ? <T v="footnote" secondary>{subtitle}</T> : null}
      </View>
      {children}
    </View>
  );
}

function ToggleRow({ icon, label, value, onChange }: { icon: string; label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.toggleRow}>
      <Icon name={icon as never} size={20} color={c.accent} />
      <T style={{ flex: 1 }}>{label}</T>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent }} thumbColor="#FFFFFF" />
    </View>
  );
}

function Budget({ scope, draft, setDraft }: { scope: Hotel[]; draft: StayFilters; setDraft: (f: StayFilters) => void }) {
  const { c } = useTheme();
  const pool = scope.filter((h) => matches(draft, h, traits(h), 'price' as Facet));
  const prices = pool.map((h) => traits(h).dzd).filter((p): p is number => p != null);
  const unpriced = pool.length - prices.length;
  const priced = scope.filter((h) => traits(h).dzd != null).length;
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 0;
  const lower = Math.floor(lo / 1000) * 1000;
  const upper = Math.ceil(hi / 1000) * 1000;
  const selected: [number, number] = [draft.priceMin ?? lower, draft.priceMax ?? upper];
  const inBudget = prices.filter((p) => p >= selected[0] && p <= selected[1]).length;

  return (
    <Section title="Budget per night" subtitle={LF('Only %d of %d stays list an online price. Most take bookings by phone.', priced, scope.length)}>
      {prices.length > 1 && hi > lo ? (
        <View style={{ gap: 10 }}>
          <T v="subheadline" secondary>
            {inBudget === 0
              ? L('No stay in this range yet')
              : inBudget === 1
                ? L('1 stay in your budget')
                : LF('%d stays in your budget', inBudget)}
          </T>
          <PriceHistogram prices={prices} lower={lower} upper={upper} selected={selected} />
          <RangeSlider
            range={selected}
            bounds={[lower, upper]}
            step={500}
            onChange={([a, b]) => setDraft({ ...draft, priceMin: a <= lower ? null : a, priceMax: b >= upper ? null : b })}
            label={(v, isUpper) => {
              const text = Money.format(v);
              // An open top end reads "24 000+ DZD".
              if (!isUpper || v < upper) return text;
              const gap = text.lastIndexOf('\u00A0');
              return gap < 0 ? `${text}+` : `${text.slice(0, gap)}+${text.slice(gap)}`;
            }}
          />
        </View>
      ) : (
        <T v="subheadline" secondary>{L('Not enough stays with an online price to set a range here.')}</T>
      )}
      <View style={[styles.toggleRow, { paddingTop: 6 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <T>{L('Include stays without an online price')}</T>
          <T v="caption" secondary>{LF('%lld stays, call them for a price', unpriced)}</T>
        </View>
        <Switch
          value={draft.includeUnpriced}
          onValueChange={(v) => setDraft({ ...draft, includeUnpriced: v })}
          trackColor={{ true: c.accent }}
          thumbColor="#FFFFFF"
        />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  grabberWrap: { alignItems: 'center', paddingTop: 8 },
  grabber: { width: 36, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerButton: { paddingHorizontal: 16, height: 40, borderRadius: 20, justifyContent: 'center' },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenity: { width: '31.5%', minHeight: 78, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
  townRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  footer: { paddingHorizontal: 16, paddingTop: 10 },
  showButton: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
