import React, { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L, LF } from '../../lib/i18n';
import { Hotel, Money, hotels, regionName, stayKinds, weightedScore } from '../../lib/model';
import { FilterChipItem, activeCount, chips, countMatching, emptyFilters } from '../../lib/filters';
import { regions, searchedHotels, townsIn, typesIn, useScopedAndResults, useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { HotelCard, WilayaRow } from '../../components/cards';
import { SearchWithWilaya, SortMenu } from '../../components/search';
import { Icon, SegmentedSwitch, T } from '../../components/ui';

type Row = { name: string; total: number; top: Hotel[] };

/** Each wilaya's best-rated stays with photos, wilayas in alphabetical order. */
function wilayaRows(): Row[] {
  const groups = new Map<string, Hotel[]>();
  for (const h of hotels) {
    const r = regionName(h);
    groups.set(r, [...(groups.get(r) ?? []), h]);
  }
  return [...groups.entries()]
    .map(([name, list]) => {
      const open = list.filter((h) => !h.closed).sort((a, b) => weightedScore(b) - weightedScore(a));
      const top = [...open.filter((h) => h.photos.length), ...open.filter((h) => !h.photos.length)].slice(0, 12);
      return { name, total: list.length, top };
    })
    .sort((a, b) => L(a.name).localeCompare(L(b.name)));
}

export default function ExploreScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const query = useStore((s) => s.query);
  const region = useStore((s) => s.region);
  const filters = useStore((s) => s.filters);
  const kind = useStore((s) => s.kind);
  const setKind = useStore((s) => s.setKind);
  const setRegion = useStore((s) => s.setRegion);
  const setFilters = useStore((s) => s.setFilters);
  const setQuery = useStore((s) => s.setQuery);
  const { scope, results } = useScopedAndResults();
  const rows = useMemo(wilayaRows, []);

  const active = activeCount(filters);
  // The home layout shows until you pick a wilaya, a stay kind, type a search or set a filter.
  const isBrowsing = region == null && kind === 'All' && !query.trim() && active === 0;

  const header = (
    <View style={{ gap: 14 }}>
      <T v="largeTitle" w="bold" style={{ paddingHorizontal: 16, marginTop: 4 }}>{L('Stays')}</T>
      <View style={{ paddingHorizontal: 16 }}>
        <SearchWithWilaya />
      </View>
      {query.trim() ? <Suggestions /> : null}
      {!isBrowsing ? (
        <View style={{ paddingHorizontal: 16, flexDirection: 'row' }}>
          <SortMenu />
        </View>
      ) : null}
      {!isBrowsing && chips(filters).length > 0 ? <ActiveFilters /> : null}
      {!isBrowsing ? (
        <View style={styles.resultHeader}>
          <T v="subheadline" w="semibold">
            {results.length === scope.length ? LF('%d stays', results.length) : LF('%d of %d stays', results.length, scope.length)}
          </T>
          <T v="subheadline" secondary>{region ? LF('in %@', L(region)) : L('in all wilayas')}</T>
        </View>
      ) : null}
      {!isBrowsing ? (
        <View style={{ paddingHorizontal: 16 }}>
          <SegmentedSwitch options={stayKinds} value={kind} onChange={setKind} />
        </View>
      ) : null}
      {!isBrowsing && results.length === 0 ? <EmptyState scope={scope} /> : null}
    </View>
  );

  const footnote = (
    <T v="footnote" secondary style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {L('Ratings and rates were collected in October 2026. Only a few stays list an online nightly rate, shown in dinars as listed. For any other stay, call to ask for a price.')}
    </T>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top }}>
      {/* Top bar with the filter button, like the iOS navigation bar. */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.push('/filters')}
          style={[styles.roundButton, { backgroundColor: c.surface, borderColor: c.line }]}
          accessibilityLabel={active > 0 ? LF('Filters, %lld on', active) : L('Filters')}
        >
          <Icon name={active > 0 ? 'filter-variant-plus' : 'filter-variant'} size={22} color={active > 0 ? c.accent : c.text} />
        </Pressable>
      </View>

      {isBrowsing ? (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.name}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <WilayaRow
              name={item.name}
              total={item.total}
              hotels={item.top}
              onShowAll={() => { setRegion(item.name); setFilters({ ...filters, towns: [] }); }}
            />
          )}
          ListFooterComponent={footnote}
          contentContainerStyle={{ paddingBottom: 24, gap: 14 }}
          initialNumToRender={3}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(h) => String(h.id)}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16 }}>
              <HotelCard hotel={item} />
            </View>
          )}
          ListFooterComponent={results.length ? footnote : null}
          contentContainerStyle={{ paddingBottom: 24, gap: 14 }}
          initialNumToRender={3}
          windowSize={7}
        />
      )}
    </View>
  );

  /** Turns what you type into filters: areas, stay types and wilayas. */
  function Suggestions() {
    const q = query.trim().toLowerCase();
    const pool = hotels.filter((h) => region == null || regionName(h) === region);
    const areas = townsIn(pool).filter((t) => t.name.toLowerCase().includes(q)).slice(0, 4);
    const kinds = typesIn(pool).filter((t) => t.name.toLowerCase().includes(q) || L(t.name).toLowerCase().includes(q)).slice(0, 2);
    const wilayas = regions.filter((r) => (r.name.toLowerCase().includes(q) || L(r.name).toLowerCase().includes(q)) && r.name !== region);
    if (!areas.length && !kinds.length && !wilayas.length) return null;
    const pill = (key: string, title: string, icon: string, count: number, apply: () => void) => (
      <Pressable
        key={key}
        onPress={() => { apply(); setQuery(''); }}
        style={[styles.suggestion, { backgroundColor: c.brandSoft }]}
        accessibilityLabel={LF('Filter by %@', title)}
      >
        <Icon name={icon as never} size={16} />
        <T v="subheadline" w="semibold">{title}</T>
        <T v="subheadline" w="semibold" secondary>{count}</T>
        <Icon name="plus-circle" size={16} color={c.accent} />
      </Pressable>
    );
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {wilayas.map((w) =>
          pill(`w-${w.name}`, LF('Wilaya: %@', L(w.name)), 'map-marker-radius', w.count, () => {
            setRegion(w.name);
            setFilters({ ...filters, towns: [] });
          }),
        )}
        {areas.map((a) =>
          pill(`a-${a.name}`, a.name, 'map-marker', a.count, () => setFilters({ ...filters, towns: [...new Set([...filters.towns, a.name])] })),
        )}
        {kinds.map((k) =>
          pill(`k-${k.name}`, L(k.name), 'bed-outline', k.count, () => setFilters({ ...filters, types: [...new Set([...filters.types, k.name])] })),
        )}
      </ScrollView>
    );
  }

  function ActiveFilters() {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
        {chips(filters).map((chip) => (
          <Pressable
            key={chip.id}
            onPress={() => setFilters(chip.remove(filters))}
            style={[styles.activeChip, { backgroundColor: c.brandSoft }]}
            accessibilityLabel={LF('Remove %@', chip.label)}
          >
            <T v="footnote" w="semibold" color={c.accent}>{chip.label}</T>
            <Icon name="close" size={11} color={c.accent} />
          </Pressable>
        ))}
        <Pressable onPress={() => setFilters(emptyFilters())}>
          <T v="footnote" w="semibold" color={c.accent}>{L('Clear all')}</T>
        </Pressable>
      </ScrollView>
    );
  }

  /** Suggests switching back to All, or the single filter whose removal brings back the most stays. */
  function EmptyState({ scope }: { scope: Hotel[] }) {
    const otherKinds = kind === 'All' ? 0 : countMatching(filters, searchedHotels(region, query));
    let best: [FilterChipItem, number] | null = null;
    for (const chip of chips(filters)) {
      const n = countMatching(chip.remove(filters), scope);
      if (!best || n > best[1]) best = [chip, n];
    }
    return (
      <View style={styles.empty}>
        <Icon name="bed-outline" size={44} color={c.secondary} />
        <T v="title2" w="bold" center>{L('No stays match')}</T>
        <T secondary center>
          {otherKinds > 0
            ? LF('Switching to All would show %d stays.', otherKinds)
            : best && best[1] > 0 ? LF('Removing “%@” would show %lld stays.', best[0].label, best[1]) : L('Try another wilaya or a shorter search.')}
        </T>
        {otherKinds > 0 ? (
          <Pressable onPress={() => setKind('All')} style={[styles.primary, { backgroundColor: c.accent }]}>
            <T v="body" w="semibold" color={c.onAccent}>{L('Show all stays')}</T>
          </Pressable>
        ) : best && best[1] > 0 ? (
          <Pressable onPress={() => setFilters(best![0].remove(filters))} style={[styles.primary, { backgroundColor: c.accent }]}>
            <T v="body" w="semibold" color={c.onAccent}>{LF('Remove “%@”', best[0].label)}</T>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => { setFilters(emptyFilters()); setKind('All'); setQuery(''); }}
          style={[styles.secondaryButton, { backgroundColor: c.surface }]}
        >
          <T v="body" w="semibold" color={c.accent}>{L('Clear all filters')}</T>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  topBar: { height: 52, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16 },
  roundButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  resultHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 16 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 30, borderRadius: 15 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 30, paddingHorizontal: 32 },
  primary: { paddingHorizontal: 18, height: 44, borderRadius: 22, justifyContent: 'center', marginTop: 6 },
  secondaryButton: { paddingHorizontal: 18, height: 44, borderRadius: 22, justifyContent: 'center' },
});
