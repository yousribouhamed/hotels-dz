import React, { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L } from '../../lib/i18n';
import { hotels, weightedScore } from '../../lib/model';
import { useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { HotelCard } from '../../components/cards';
import { Icon, T } from '../../components/ui';

export default function SavedScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const saved = useStore((s) => s.saved);
  const list = useMemo(
    () => hotels.filter((h) => saved.includes(h.id)).sort((a, b) => weightedScore(b) - weightedScore(a)),
    [saved],
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top }}>
      <FlatList
        data={list}
        keyExtractor={(h) => String(h.id)}
        ListHeaderComponent={<T v="largeTitle" w="bold" style={styles.title}>{L('Saved')}</T>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="heart-outline" size={44} color={c.secondary} />
            <T v="title2" w="bold" center>{L('No saved stays yet')}</T>
            <T secondary center>{L('Tap the heart on any stay to keep it here.')}</T>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <HotelCard hotel={item} />
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 4 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 32 },
});
