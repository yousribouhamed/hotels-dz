import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, I18nManager, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { L, LF } from '../lib/i18n';
import { StaySort, hotels, staySorts } from '../lib/model';
import { regions, sortedRegionNames, useStore } from '../lib/store';
import { emptyFilters } from '../lib/filters';
import { useTheme } from '../lib/theme';
import { BottomSheet } from './sheet';
import { Menu } from './menu';
import { Icon, T, font } from './ui';

const ALL = '__all__';

/** Wilaya picker shown inside the search field: opens the wilaya sheet. */
export function WilayaMenu({ onChange }: { onChange?: () => void }) {
  const { c } = useTheme();
  const region = useStore((s) => s.region);
  const setRegion = useStore((s) => s.setRegion);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.wilaya}
        accessibilityRole="button"
        accessibilityLabel={LF('Wilaya, %@', region ? L(region) : L('all wilayas'))}
      >
        <T v="subheadline" w="semibold" color={c.accent} numberOfLines={1}>
          {region ? L(region) : L('All wilayas')}
        </T>
        <Icon name="chevron-down" size={14} color={c.accent} />
      </Pressable>
      <WilayaSheet
        visible={open}
        onClose={() => setOpen(false)}
        onPick={(id) => {
          setOpen(false);
          setRegion(id === ALL ? null : id);
          setFilters({ ...filters, towns: [] });
          onChange?.();
        }}
      />
    </>
  );
}

const ROW = 54;
/** Lower-case without accents, so "setif" finds Sétif and "bejaia" finds Béjaïa. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Every wilaya with its number of stays, a search field on top and the current one checked. */
function WilayaSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const { c } = useTheme();
  const region = useStore((s) => s.region);
  const [query, setQuery] = useState('');
  useEffect(() => { if (visible) setQuery(''); }, [visible]);

  const rows = useMemo(() => {
    const q = fold(query.trim());
    const list = sortedRegionNames()
      .map((name) => ({ id: name, title: L(name), count: regions.find((r) => r.name === name)?.count ?? 0 }))
      .filter((r) => !q || fold(r.title).includes(q) || fold(r.id).includes(q));
    return q ? list : [{ id: ALL, title: L('All wilayas'), count: hotels.length }, ...list];
  }, [query]);

  const current = region ?? ALL;
  const index = rows.findIndex((r) => r.id === current);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={L('Choose a wilaya')}>
      <View style={[styles.search, styles.sheetSearch, { backgroundColor: c.surface, borderColor: c.line + '80', borderWidth: 1 }]}>
        <Icon name="magnify" size={20} color={c.secondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={L('Search wilayas')}
          placeholderTextColor={c.tertiary}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={[font('body'), styles.input, { color: c.text, textAlign: I18nManager.isRTL ? 'right' : 'left' }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={L('Clear search')}>
            <Icon name="close-circle" size={18} color={c.tertiary} />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
        // Opens on the current wilaya, with a couple of rows above it for context.
        initialScrollIndex={!query && index > 3 ? index - 2 : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 16 }}
        renderItem={({ item }) => {
          const on = item.id === current;
          return (
            <Pressable
              onPress={() => onPick(item.id)}
              style={({ pressed }) => [styles.option, { backgroundColor: on ? c.brandSoft : pressed ? c.surface : 'transparent' }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${item.title}, ${LF('%d stays', item.count)}`}
            >
              <Icon name={item.id === ALL ? 'map-outline' : 'map-marker-outline'} size={20} color={on ? c.accent : c.secondary} />
              <T w={on ? 'semibold' : undefined} color={on ? c.accent : c.text} numberOfLines={1} style={{ flex: 1 }}>{item.title}</T>
              <T v="subheadline" color={on ? c.accent : c.secondary}>{item.count}</T>
              <View style={{ width: 22, alignItems: 'center' }}>
                {on ? <Icon name="check" size={20} color={c.accent} /> : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="map-search-outline" size={36} color={c.tertiary} />
            <T secondary center>{L('No wilaya matches')}</T>
          </View>
        }
      />
    </BottomSheet>
  );
}

/** Search field with the wilaya picker merged into its trailing edge. */
export function SearchWithWilaya() {
  const { c } = useTheme();
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.search,
        { backgroundColor: c.surface, borderColor: focused ? c.accent : c.line + '80', borderWidth: focused ? 1.5 : 1 },
      ]}
    >
      <Icon name="magnify" size={20} color={c.secondary} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={L('Hotel, town or street')}
        placeholderTextColor={c.tertiary}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[font('body'), styles.input, { color: c.text, textAlign: I18nManager.isRTL ? 'right' : 'left' }]}
      />
      {query ? (
        <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={L('Clear search')}>
          <Icon name="close-circle" size={18} color={c.tertiary} />
        </Pressable>
      ) : null}
      <View style={[styles.separator, { backgroundColor: c.line }]} />
      <WilayaMenu />
    </View>
  );
}

/** Sort picker: a compact "↑↓ Best match ⌄" chip on the right of the result count. */
export function SortMenu() {
  const { c } = useTheme();
  const sort = useStore((s) => s.sort);
  const setSort = useStore((s) => s.setSort);
  return (
    <Menu
      title={L('Sort by')}
      width={240}
      items={staySorts.map((s) => ({ id: s, title: L(s), selected: s === sort }))}
      onSelect={(id) => setSort(id as StaySort)}
    >
      {(open) => (
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={LF('%@, %@', L('Sort by'), L(sort))}>
          {/* Compact chip so it sits beside the count without crowding it. */}
          <View style={[styles.sort, { backgroundColor: c.surface, borderColor: c.line + '99' }]}>
            <Icon name="swap-vertical" size={13} />
            <T v="footnote" w="semibold" numberOfLines={1}>{L(sort)}</T>
            <Icon name="chevron-down" size={13} />
          </View>
        </Pressable>
      )}
    </Menu>
  );
}

export const clearAll = () => {
  const s = useStore.getState();
  s.setFilters(emptyFilters());
};

const styles = StyleSheet.create({
  wilaya: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderRadius: 25,
    paddingStart: 14, paddingEnd: 16,
  },
  input: { flex: 1, paddingVertical: 0 },
  separator: { width: 1, height: 22 },
  sheetSearch: { height: 46, borderRadius: 23, marginHorizontal: 16, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, height: ROW, paddingHorizontal: 12, borderRadius: 14 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 40 },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: 15, borderWidth: 1 },
});
