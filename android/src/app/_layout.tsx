import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, DevSettings, Easing, I18nManager, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Updates from 'expo-updates';
import * as SystemUI from 'expo-system-ui';
import { resolveLanguage, setLanguageCode } from '../lib/i18n';
import { SKIP_SPLASH_KEY, useStore } from '../lib/store';
import { SPLASH_LIME } from '../lib/mark';
import { SplashOverlay } from '../components/splash';
import { Onboarding, useOnboarding } from '../components/onboarding';
import { useCommunity } from '../lib/community';
import { useTheme } from '../lib/theme';

/**
 * Arabic needs the whole layout mirrored; on Android that takes effect after one quick restart. When the
 * person switches language after the opening animation, the app comes straight back without playing it again.
 */
async function applyDirection(rtl: boolean, skipSplashAfter: boolean) {
  if (I18nManager.isRTL === rtl) return;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  if (skipSplashAfter) await AsyncStorage.setItem(SKIP_SPLASH_KEY, '1').catch(() => {});
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}

export default function RootLayout() {
  const ready = useStore((s) => s.ready);
  const language = useStore((s) => s.language);
  const onboarded = useStore((s) => s.onboarded);
  const skipSplash = useStore((s) => s.skipSplash);
  const [splashDone, setSplashDone] = useState(false);
  // The app sits slightly enlarged under the opening animation and settles as it is revealed.
  const settle = useRef(new Animated.Value(1.06)).current;
  // The welcome screen fades away over Explore, which is already behind it.
  const welcome = useRef(new Animated.Value(1)).current;
  const [leaving, setLeaving] = useState(false);
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

  // The layout direction doesn't match the language yet (first launch in Arabic): restart before animating.
  const needsFlip = I18nManager.isRTL !== (lang === 'ar');
  useEffect(() => {
    if (ready) applyDirection(lang === 'ar', splashDone || skipSplash);
  }, [ready, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.canvas).catch(() => {});
  }, [c.canvas]);

  useEffect(() => {
    if (ready && skipSplash) useOnboarding.getState().reveal();
  }, [ready, skipSplash]);

  const reveal = useCallback(() => {
    useOnboarding.getState().reveal();
    Animated.timing(settle, { toValue: 1, duration: 950, easing: Easing.bezier(0.65, 0, 0.25, 1), useNativeDriver: true }).start();
  }, [settle]);

  const finishOnboarding = useCallback(() => {
    if (leaving) return;
    // Explore with no filters set: every wilaya, every kind of stay.
    const store = useStore.getState();
    store.setRegion(null);
    store.setKind('All');
    setLeaving(true);
    Animated.timing(welcome, { toValue: 0, duration: 550, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: true }).start(() => {
      useStore.getState().finishOnboarding(null, 'All');
    });
  }, [leaving, welcome]);

  // Same lime as the native splash (app.json), so the hand-over is seamless.
  const holding = !ready || !fontsLoaded || (needsFlip && !splashDone && !skipSplash);
  if (holding) return <View style={{ flex: 1, backgroundColor: skipSplash ? c.canvas : SPLASH_LIME }} />;

  const showSplash = !splashDone && !skipSplash;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar style={showSplash ? 'dark' : isDark ? 'light' : 'dark'} />
      <Animated.View style={{ flex: 1, transform: [{ scale: showSplash ? settle : 1 }] }}>
      {/* Rebuild every screen when the language changes so all text switches at once. */}
      <Stack key={lang} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.canvas } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="hotel/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="reviews/[id]" options={{ animation: 'slide_from_right' }} />
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
      {!onboarded ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: welcome, transform: [{ scale: welcome.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}
          pointerEvents={leaving ? 'none' : 'auto'}
        >
          <Onboarding key={lang} onFinish={finishOnboarding} />
        </Animated.View>
      ) : null}
      </Animated.View>
      {showSplash ? <SplashOverlay unhurried={!onboarded} onReveal={reveal} onFinish={() => setSplashDone(true)} /> : null}
    </View>
  );
}
