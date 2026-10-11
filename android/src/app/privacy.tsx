import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L, LF, formatDay } from '../lib/i18n';
import { POLICY_UPDATED, SUPPORT_EMAIL } from '../lib/moderation';
import { useTheme } from '../lib/theme';
import { Icon, T } from '../components/ui';

const sections = ['summary', 'account', 'device', 'content', 'apps', 'reports', 'listings', 'children', 'changes'];

export default function PrivacyPolicy() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top }}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" style={styles.back}>
          <Icon name="arrow-left" size={24} directional />
        </Pressable>
        <T v="headline">{L('Privacy policy')}</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40 + insets.bottom }}>
        <T v="footnote" secondary>{LF('Last updated %@', formatDay(POLICY_UPDATED) ?? POLICY_UPDATED)}</T>
        {sections.map((s) => (
          <View key={s} style={{ gap: 6 }}>
            <T v="headline">{L(`privacy.${s}.title`)}</T>
            <T>{L(`privacy.${s}.body`)}</T>
          </View>
        ))}
        <View style={{ gap: 6 }}>
          <T v="headline">{L('privacy.contact.title')}</T>
          <T>{L('privacy.contact.body')}</T>
          <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <T w="semibold" color={c.accent}>{SUPPORT_EMAIL}</T>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
