import React, { useState } from 'react';
import { I18nManager, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import { L, LF } from '../lib/i18n';
import { StaySort, staySorts } from '../lib/model';
import { sortedRegionNames, useStore } from '../lib/store';
import { emptyFilters } from '../lib/filters';
import { useTheme } from '../lib/theme';
import { ChipLabel, Icon, T, font } from './ui';

const ALL = '__all__';

/** Wilaya picker shown inside the search field and on the map (native drop-down menu). */
export function WilayaMenu({ onChange }: { onChange?: () => void }) {
  const { c, isDark } = useTheme();
  const region = useStore((s) => s.region);
  const setRegion = useStore((s) => s.setRegion);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);

  const actions = [
    { id: ALL, title: L('All wilayas'), state: region == null ? ('on' as const) : ('off' as const) },
    ...sortedRegionNames().map((name) => ({
      id: name,
      title: L(name),
      state: region === name ? ('on' as const) : ('off' as const),
    })),
  ];

  return (
    <MenuView
      actions={actions}
      themeVariant={isDark ? 'dark' : 'light'}
      onPressAction={({ nativeEvent }) => {
        setRegion(nativeEvent.event === ALL ? null : nativeEvent.event);
        setFilters({ ...filters, towns: [] });
        onChange?.();
      }}
    >
      <View
        style={styles.wilaya}
        accessibilityRole="button"
        accessibilityLabel={LF('Wilaya, %@', region ? L(region) : L('all wilayas'))}
      >
        <T v="subheadline" w="semibold" color={c.accent} numberOfLines={1}>
          {region ? L(region) : L('All wilayas')}
        </T>
        <Icon name="chevron-down" size={14} color={c.accent} />
      </View>
    </MenuView>
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
  const { isDark } = useTheme();
  const sort = useStore((s) => s.sort);
  const setSort = useStore((s) => s.setSort);
  return (
    <MenuView
      title={L('Sort by')}
      themeVariant={isDark ? 'dark' : 'light'}
      actions={staySorts.map((s) => ({ id: s, title: L(s), state: s === sort ? ('on' as const) : ('off' as const) }))}
      onPressAction={({ nativeEvent }) => setSort(nativeEvent.event as StaySort)}
    >
      <ChipLabel title={sort} icon="swap-vertical" showsChevron />
    </MenuView>
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
