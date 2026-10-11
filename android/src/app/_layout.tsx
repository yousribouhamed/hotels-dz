import React, { useEffect } from 'react';
import { DevSettings, I18nManager, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Updates from 'expo-updates';
import * as SystemUI from 'expo-system-ui';
import { resolveLanguage, setLanguageCode } from '../lib/i18n';
import { useStore } from '../lib/store';
import { useCommunity } from '../lib/community';
import { useTheme } from '../lib/theme';

/** Arabic needs the whole layout mirrored; on Android that takes effect after one quick restart. */
async function applyDirection(rtl: boolean) {
  if (I18nManager.isRTL === rtl) return;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}

export default function RootLayout() {
  const ready = useStore((s) => s.ready);
  const language = useStore((s) => s.language);
  const { c, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    'Thmanyah-Light': require('../../assets/fonts/thmanyahsans-Light.otf'),
    'Thmanyah-Regular': require('../../assets/fonts/thmanyahsans-Regular.otf'),
    'Thmanyah-Medium': require('../../assets/fonts/thmanyahsans-Medium.otf'),
    'Thmanyah-Bold': require('../../assets/fonts/thmanyahsans-Bold.otf'),
    'Thmanyah-Black': require('../../assets/fonts/thmanyahsans-Black.otf'),
  });

  useEffect(() => {
    useStore.getState().load();
    useCommunity.getState().init();
  }, []);

  // Resolve the language before any screen renders, so every string uses it.
  const lang = resolveLanguage(language);
  setLanguageCode(lang);

  useEffect(() => {
    if (ready) applyDirection(lang === 'ar');
  }, [ready, lang]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.canvas).catch(() => {});
  }, [c.canvas]);

  if (!ready || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: c.canvas }} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Rebuild every screen when the language changes so all text switches at once. */}
      <Stack key={lang} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.canvas } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="hotel/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="guidelines" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="login-callback" options={{ animation: 'none' }} />
        <Stack.Screen
          name="review/[id]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.94],
            sheetCornerRadius: 24,
            sheetGrabberVisible: false,
            gestureEnabled: false,
            contentStyle: { backgroundColor: c.canvas },
          }}
        />
        <Stack.Screen
          name="signin"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.94],
            sheetCornerRadius: 24,
            sheetGrabberVisible: false,
            contentStyle: { backgroundColor: c.canvas },
          }}
        />
        <Stack.Screen
          name="filters"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.94],
            sheetCornerRadius: 24,
            sheetGrabberVisible: false,
            contentStyle: { backgroundColor: c.canvas },
          }}
        />
      </Stack>
    </View>
  );
}
