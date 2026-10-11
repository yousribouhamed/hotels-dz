import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { Icon, T } from '../components/ui';

const rules = ['guidelines.1', 'guidelines.2', 'guidelines.3', 'guidelines.4', 'guidelines.5'];

export default function CommunityGuidelines() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top }}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" style={styles.back}>
          <Icon name="arrow-left" size={24} directional />
        </Pressable>
        <T v="headline">{L('Community guidelines')}</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 + insets.bottom }}>
        <T>{L('guidelines.intro')}</T>
        {rules.map((key) => (
          <View key={key} style={styles.rule}>
            <Icon name="check-circle" size={20} color={c.accent} />
            <T style={{ flex: 1 }}>{L(key)}</T>
          </View>
        ))}
        <T v="footnote" secondary>{L('guidelines.enforcement')}</T>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
