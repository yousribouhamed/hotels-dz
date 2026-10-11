import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { L } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';

/** Explore · Saved · Settings — a native Material 3 bottom navigation bar on Android. */
export default function TabsLayout() {
  const { c } = useTheme();
  const savedCount = useStore((s) => s.saved.length);
  return (
    <NativeTabs
      tintColor={c.accent}
      backgroundColor={c.canvas}
      indicatorColor={c.brandSoft}
      iconColor={{ default: c.secondary, selected: c.accent }}
      labelStyle={{ default: { color: c.secondary }, selected: { color: c.accent } }}
      rippleColor={c.brandSoft}
      badgeBackgroundColor={c.heart}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md="search" />
        <NativeTabs.Trigger.Label>{L('Explore')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Icon md="favorite" />
        <NativeTabs.Trigger.Label>{L('Saved')}</NativeTabs.Trigger.Label>
        {savedCount > 0 ? <NativeTabs.Trigger.Badge>{String(savedCount)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon md="settings" />
        <NativeTabs.Trigger.Label>{L('Settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
