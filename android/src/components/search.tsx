import React, { useState } from 'react';
import { I18nManager, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { L, LF } from '../lib/i18n';
import { StaySort, staySorts } from '../lib/model';
import { regions, sortedRegionNames, useStore } from '../lib/store';
import { emptyFilters } from '../lib/filters';
import { useTheme } from '../lib/theme';
import { Menu } from './menu';
import { ChipLabel, Icon, T, font } from './ui';

const ALL = '__all__';

/** Wilaya picker shown inside the search field and on the map. */
export function WilayaMenu({ onChange }: { onChange?: () => void }) {
  const { c } = useTheme();
  const region = useStore((s) => s.region);
  const setRegion = useStore((s) => s.setRegion);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const count = (name: string) => regions.find((r) => r.name === name)?.count ?? 0;
  const total = regions.reduce((sum, r) => sum + r.count, 0);

  return (
    <Menu
      title={L('Wilaya')}
      items={[
        { id: ALL, title: L('All wilayas'), detail: String(total), icon: 'map-outline', selected: region == null },
        ...sortedRegionNames().map((name) => ({ id: name, title: L(name), detail: String(count(name)), selected: region === name })),
      ]}
      onSelect={(id) => {
        setRegion(id === ALL ? null : id);
        setFilters({ ...filters, towns: [] });
        onChange?.();
      }}
    >
      {(open) => (
        <Pressable
          onPress={open}
          hitSlop={6}
          style={styles.wilaya}
          accessibilityRole="button"
          accessibilityLabel={LF('Wilaya, %@', region ? L(region) : L('all wilayas'))}
        >
          <T v="subheadline" w="semibold" color={c.accent} numberOfLines={1}>
            {region ? L(region) : L('All wilayas')}
          </T>
          <Icon name="chevron-down" size={14} color={c.accent} />
        </Pressable>
      )}
    </Menu>
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

/** "↑↓ Best match ⌄" chip that opens the sort menu. */
export function SortMenu() {
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
          <ChipLabel title={sort} icon="swap-vertical" showsChevron />
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
});
