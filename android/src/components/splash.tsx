import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { SPLASH_FOREST, SPLASH_LIME, coverWithMarkHole, markPath } from '../lib/mark';
import { ease, mix, phase, useClock } from '../lib/motion';

// Opening animation, as in the iOS app (Splash.swift). Like the app icon: the native splash is plain lime
// (app.json), then the forest mark fades in on a soft halo, dips slightly and turns into a window: the lime
// cover gets a mark-shaped hole that grows past the screen edges, revealing the app through the logo.

const RESTING = 104;

/** Timeline in ms. The first launch takes its time; later launches are quicker. */
function timeline(unhurried: boolean) {
  const arrive = unhurried ? 800 : 550;
  const dipAt = unhurried ? 850 : 500;
  const openAt = dipAt + 260;
  const open = 950;
  return { arrive, glowIn: unhurried ? 1100 : 700, dipAt, openAt, open, fadeAt: openAt + 850, total: openAt + 1010 };
}

export function SplashOverlay({ unhurried, onReveal, onFinish }: {
  unhurried: boolean;
  /** Called just before the window opens, so the content can settle in step with it. */
  onReveal: () => void;
  onFinish: () => void;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => setReduceMotion(false));
  }, []);

  const tl = timeline(unhurried);
  const total = reduceMotion ? 800 : tl.total;
  const revealed = useRef(false);
  const t = useClock(size != null && reduceMotion != null, total, () => {
    // Whatever happened to the frames, the screen underneath is always told to show itself.
    if (!revealed.current) {
      revealed.current = true;
      onReveal();
    }
    onFinish();
  });

  const revealAt = reduceMotion ? 450 : tl.dipAt;
  useEffect(() => {
    if (!revealed.current && size && reduceMotion != null && t >= revealAt) {
      revealed.current = true;
      onReveal();
    }
  }, [t, size, reduceMotion, revealAt, onReveal]);

  let markWidth = RESTING, markOpacity = 1, holeWidth = 0, glow = 0, glowScale = 1, cover = 1;
  if (size && reduceMotion) {
    markOpacity = phase(t, 0, 300) * (1 - phase(t, 450, 350));
    cover = 1 - phase(t, 450, 350, ease.inOut);
  } else if (size) {
    const target = Math.hypot(size.w, size.h) * 2.8;
    const arrive = phase(t, 0, tl.arrive);
    const dip = phase(t, tl.dipAt, 280, ease.inOut);
    const open = phase(t, tl.openAt, tl.open, ease.reveal);
    const width = mix(mix(64, RESTING, arrive), RESTING * 0.88, dip);
    markWidth = t < tl.openAt ? width : mix(RESTING * 0.88, target, open);
    holeWidth = t < tl.openAt ? 0 : markWidth;
    markOpacity = phase(t, 0, tl.arrive * 0.7) * (1 - phase(t, tl.openAt, 320));
    glow = phase(t, 0, tl.glowIn) * (1 - phase(t, tl.openAt, 450));
    glowScale = mix(mix(0.7, 1, phase(t, 0, tl.glowIn)), 1.15, dip);
    cover = 1 - phase(t, tl.fadeAt, 150);
  }

  return (
    <View
      pointerEvents={cover > 0.5 ? 'auto' : 'none'}
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {size ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.75} />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Path d={coverWithMarkHole(size.w, size.h, holeWidth)} fill={SPLASH_LIME} fillRule="evenodd" opacity={cover} />
          {glow > 0.001 ? (
            <Circle cx={size.w / 2} cy={size.h / 2} r={190 * glowScale} fill="url(#halo)" opacity={glow} />
          ) : null}
          {markOpacity > 0.001 ? (
            <Path d={markPath(size.w / 2, size.h / 2, markWidth)} fill={SPLASH_FOREST} opacity={markOpacity} />
          ) : null}
        </Svg>
      ) : (
        <View style={{ flex: 1, backgroundColor: SPLASH_LIME }} />
      )}
    </View>
  );
}
