import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { create } from 'zustand';
import { L, LF, Lang, resolveLanguage } from '../lib/i18n';
import { hotels } from '../lib/model';
import { regions, useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { coverWithMarkHole, markPath } from '../lib/mark';
import { ease, phase, useClock } from '../lib/motion';
import { illustrations } from './illustrations';
import { Icon, IconName, T } from './ui';
import { Wordmark } from './wordmark';

// Welcome screen, as in the iOS app (Onboarding.swift). Shown once, on first launch, right after the opening
// animation: what the app is, the app language (Arabic, French, English) and one button that opens Explore
// with no filters set. Picture: illustrations.ts (OnboardingWelcome).

/** Whether the opening animation has started uncovering the screen (the welcome screen animates in from then). */
export const useOnboarding = create<{ revealed: boolean; reveal: () => void }>((set) => ({
  revealed: false,
  reveal: () => set({ revealed: true }),
}));

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { c } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.canvas }]}>
      <Welcome onFinish={onFinish} />
    </View>
  );
}

// MARK: Welcome

function Welcome({ onFinish }: { onFinish: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const shown = useOnboarding((s) => s.revealed);
  // The picture is square with content up to its edges, so the slot stays square (as large as fits, centred).
  const [box, setBox] = useState({ w: 0, h: 0 });
  const side = Math.min(box.w, box.h);

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingHorizontal: 20 }}>
      <Rise shown={shown} delay={50}><Wordmark height={30} /></Rise>

      {/* The picture opens through the logo, like the app did a moment ago. */}
      <View
        style={{ flex: 1, minHeight: 150, marginTop: 20, alignItems: 'center', justifyContent: 'center' }}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <IllustrationSlot
          slot="OnboardingWelcome"
          icon="office-building-outline"
          radius={32}
          backdrop="#CDFA0B"
          style={side > 0 ? { width: side, height: side } : { flex: 1, alignSelf: 'stretch' }}
        />
        <MarkReveal shown={shown} color={c.canvas} delay={100} />
      </View>

      <Rise shown={shown} delay={250} style={{ marginTop: 24 }}>
        <T v="largeTitle" w="bold">{L('Find your stay, then call to book.')}</T>
      </Rise>
      <Rise shown={shown} delay={330} style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
        <StatChip icon="bed" text={LF('%d stays', hotels.length)} />
        <StatChip icon="map" text={LF('%d wilayas', regions.length)} />
      </Rise>
      <Rise shown={shown} delay={400} style={{ marginTop: 14 }}>
        <T secondary>{L('Free, and no account needed.')}</T>
      </Rise>
      <Rise shown={shown} delay={480} style={{ marginTop: 22 }}>
        <LanguagePills />
      </Rise>
      <Rise shown={shown} delay={550} style={{ marginTop: 16 }}>
        <CTA title={L('Let’s go')} onPress={onFinish} />
      </Rise>
    </View>
  );
}

function StatChip({ icon, text }: { icon: IconName; text: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: c.brandSoft }]}>
      <Icon name={icon} size={14} color={c.good} />
      <T v="subheadline" w="semibold" color={c.good}>{text}</T>
    </View>
  );
}

/** The three app languages, each named in itself. Picking one switches the whole app. */
function LanguagePills() {
  const { c } = useTheme();
  const language = useStore((s) => s.language);
  const setLanguage = useStore((s) => s.setLanguage);
  const current = resolveLanguage(language);
  const options: [Lang, string][] = [['ar', 'العربية'], ['fr', 'Français'], ['en', 'English']];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel={L('Language')}>
      {options.map(([code, name]) => {
        const on = current === code;
        return (
          <Pressable
            key={code}
            onPress={() => { if (!on) setLanguage(code); }}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: on ? c.accent : c.surface, borderColor: on ? 'transparent' : c.line, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <T v="subheadline" w={on ? 'semibold' : 'regular'} color={on ? c.onAccent : c.text}>{name}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

// MARK: Shared pieces

/**
 * Where an illustration goes. Until an image is set for `slot` in illustrations.ts, a branded placeholder
 * (soft brand colour, a large faint mark and an icon) holds the space, so the layout already looks finished.
 */
export function IllustrationSlot({ slot, icon, radius = 28, compact, backdrop, style }: {
  slot: string; icon: IconName; radius?: number; compact?: boolean;
  /** The picture's own background colour. When set, the whole picture is shown (fitted, never cropped) on it. */
  backdrop?: string;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const source = illustrations[slot];
  return (
    <View
      style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: c.brandSoft }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {source ? (
        <Image
          source={source}
          style={[StyleSheet.absoluteFill, backdrop ? { backgroundColor: backdrop } : null]}
          contentFit={backdrop ? 'contain' : 'cover'}
        />
      ) : (
        <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
          <LinearGradient colors={[c.brandSoft, c.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {size.w > 0 ? (
            <Svg style={StyleSheet.absoluteFill}>
              <Path
                d={markPath(size.w * 0.78, size.h * 0.72, Math.max(size.w, size.h) * 1.1)}
                fill={c.good}
                opacity={0.09}
                transform={`rotate(-14 ${size.w * 0.78} ${size.h * 0.72})`}
              />
            </Svg>
          ) : null}
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name={icon} size={compact ? 26 : 46} color={c.good + '8C'} />
          </View>
          {__DEV__ && !compact ? (
            <View style={[styles.devLabel, { backgroundColor: c.canvas + 'B3' }]}>
              <T v="caption2" secondary>{slot}</T>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Covers its parent and opens a growing mark-shaped window onto it, the way the opening animation does. */
function MarkReveal({ shown, color, delay = 0 }: { shown: boolean; color: string; delay?: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const t = useClock(shown && size.w > 0, delay + 1100);
  const p = phase(t, delay, 1100, ease.reveal);
  if (p >= 1) return null;
  const hole = p * Math.hypot(size.w, size.h) * 2.8;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Path d={coverWithMarkHole(size.w, size.h, hole)} fill={color} fillRule="evenodd" />
        </Svg>
      ) : (
        <View style={{ flex: 1, backgroundColor: color }} />
      )}
    </View>
  );
}

function CTA({ title, onPress }: { title: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.cta, { backgroundColor: c.accent, opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      accessibilityRole="button"
    >
      <T v="headline" w="semibold" color={c.onAccent}>{title}</T>
      <Icon name="arrow-right" size={18} color={c.onAccent} directional />
    </Pressable>
  );
}

/** Rises a little and fades in, after `delay` ms, once `shown` is true. */
function Rise({ shown, delay = 0, style, children }: { shown: boolean; delay?: number; style?: ViewStyle; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (shown) Animated.timing(v, { toValue: 1, duration: 700, delay, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [shown, delay, v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16 },
  pill: { flex: 1, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cta: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  devLabel: { position: 'absolute', bottom: 14, start: 14, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
});
