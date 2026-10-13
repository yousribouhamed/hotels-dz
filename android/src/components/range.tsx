import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { T } from './ui';

/** Bars of how many stays fall in each 1 000 DZD band; selected bands are highlighted. */
export function PriceHistogram({ prices, lower, upper, selected, binWidth = 1000 }: {
  prices: number[]; lower: number; upper: number; selected: [number, number]; binWidth?: number;
}) {
  const { c } = useTheme();
  const binCount = Math.max(1, Math.floor((upper - lower) / binWidth));
  const bins = Array.from({ length: binCount }, (_, i) => {
    const lo = lower + i * binWidth;
    return prices.filter((p) => (p >= lo && p < lo + binWidth) || (i === binCount - 1 && p === upper)).length;
  });
  const peak = Math.max(1, ...bins);
  return (
    // Prices read low to high from left to right in every language.
    <View style={[styles.bars, { direction: 'ltr' }]} accessibilityElementsHidden>
      {bins.map((n, i) => {
        const mid = lower + i * binWidth + binWidth / 2;
        const on = mid >= selected[0] && mid <= selected[1];
        return (
          <View
            key={i}
            style={{
              flex: 1,
              borderRadius: 2,
              height: n === 0 ? 2 : Math.max(6, (56 * n) / peak),
              backgroundColor: on ? c.accent : c.placeholder,
            }}
          />
        );
      })}
    </View>
  );
}

const THUMB = 28;
const TAG_GAP = 8;
const TAG_HEIGHT = 32;

/**
 * Two-thumb range slider (same behaviour as the iOS one), always left-to-right.
 * With `label`, a price tag rides under each knob; when the two would touch they merge into one "low – high" tag.
 */
export function RangeSlider({ range, bounds, step = 1, onChange, label }: {
  range: [number, number]; bounds: [number, number]; step?: number; onChange: (r: [number, number]) => void;
  label?: (value: number, isUpper: boolean) => string;
}) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<0 | 1 | null>(null);
  const [tagW, setTagW] = useState({ low: 0, high: 0, merged: 0 });
  const state = useRef({ range, width, start: 0 });
  state.current.range = range;
  state.current.width = width;

  const span = bounds[1] - bounds[0];
  const track = Math.max(1, width - THUMB);
  const lowX = ((range[0] - bounds[0]) / span) * track;
  const highX = ((range[1] - bounds[0]) / span) * track;

  const valueAt = (x: number) => {
    const ratio = Math.min(Math.max(0, x / Math.max(1, state.current.width - THUMB)), 1);
    const raw = bounds[0] + ratio * span;
    return Math.min(Math.max(Math.round(raw / step) * step, bounds[0]), bounds[1]);
  };

  const makeResponder = (which: 0 | 1) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const [lo, hi] = state.current.range;
        const w = Math.max(1, state.current.width - THUMB);
        state.current.start = (((which === 0 ? lo : hi) - bounds[0]) / span) * w;
        setActive(which);
      },
      onPanResponderMove: (_e, g) => {
        const v = valueAt(state.current.start + g.dx);
        const [lo, hi] = state.current.range;
        onChange(which === 0 ? [Math.min(v, hi - step), hi] : [lo, Math.max(v, lo + step)]);
      },
      onPanResponderRelease: () => setActive(null),
      onPanResponderTerminate: () => setActive(null),
    });

  const low = useRef(makeResponder(0)).current;
  const high = useRef(makeResponder(1)).current;

  // Price tags: centred under their knob, kept on screen near the ends, merged when they would touch.
  const lowCenter = lowX + THUMB / 2;
  const highCenter = highX + THUMB / 2;
  const merged = lowCenter + tagW.low / 2 + 6 > highCenter - tagW.high / 2;
  const clamp = (x: number, w: number) => Math.min(Math.max(x, w / 2), width - w / 2);
  const measure = (key: 'low' | 'high' | 'merged') => (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setTagW((t) => (Math.abs(t[key] - w) < 0.5 ? t : { ...t, [key]: w }));
  };
  const lowText = label?.(range[0], false) ?? '';
  const highText = label?.(range[1], true) ?? '';

  const knob = (which: 0 | 1, x: number) => (
    <View
      {...(which === 0 ? low : high).panHandlers}
      style={[
        styles.knob,
        { left: x, borderColor: active === which ? c.accent : c.line },
        active === which && { borderWidth: 2, transform: [{ scale: 1.12 }] },
      ]}
      accessibilityLabel={which === 0 ? 'Minimum price' : 'Maximum price'}
      accessibilityValue={label ? { text: which === 0 ? lowText : highText } : undefined}
    />
  );

  return (
    <View
      style={{ height: label ? THUMB + TAG_GAP + TAG_HEIGHT : THUMB, direction: 'ltr' }}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={[styles.track, { backgroundColor: c.placeholder, left: THUMB / 2, right: THUMB / 2 }]} />
      <View style={[styles.track, { backgroundColor: c.accent, left: lowX + THUMB / 2, width: Math.max(0, highX - lowX) }]} />
      {knob(0, lowX)}
      {knob(1, highX)}
      {label && width > 0 ? (
        <View style={styles.tags} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <PriceTag text={lowText} active={active === 0} hidden={merged} onLayout={measure('low')}
            left={clamp(lowCenter, tagW.low) - tagW.low / 2} notch={lowCenter - clamp(lowCenter, tagW.low)} />
          <PriceTag text={highText} active={active === 1} hidden={merged} onLayout={measure('high')}
            left={clamp(highCenter, tagW.high) - tagW.high / 2} notch={highCenter - clamp(highCenter, tagW.high)} />
          <PriceTag text={`${lowText} – ${highText}`} active={active !== null} hidden={!merged} onLayout={measure('merged')}
            left={clamp((lowCenter + highCenter) / 2, tagW.merged) - tagW.merged / 2} />
        </View>
      ) : null}
    </View>
  );
}

/** A small price label with a notch pointing up at its knob; fills with the accent while that knob is dragged. */
function PriceTag({ text, active, hidden, left, notch, onLayout }: {
  text: string; active: boolean; hidden: boolean; left: number; notch?: number; onLayout: (e: LayoutChangeEvent) => void;
}) {
  const { c } = useTheme();
  const fill = active ? c.accent : c.surface;
  return (
    <View onLayout={onLayout} style={[styles.tag, { left, opacity: hidden ? 0 : 1 }]}>
      {notch != null ? (
        <View style={[styles.notch, { borderBottomColor: fill, transform: [{ translateX: notch }] }]} />
      ) : null}
      <View style={[styles.tagBody, { backgroundColor: fill, borderColor: active ? fill : c.line }]}>
        <T v="footnote" w="semibold" numberOfLines={1} color={active ? c.onAccent : c.text} style={styles.tagText}>
          {text}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 56, paddingHorizontal: 14 },
  track: { position: 'absolute', top: THUMB / 2 - 2, height: 4, borderRadius: 2 },
  knob: {
    position: 'absolute', top: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth, elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  tags: { position: 'absolute', top: THUMB + TAG_GAP, left: 0, right: 0, height: TAG_HEIGHT },
  tag: { position: 'absolute', top: 0, alignItems: 'center' },
  notch: {
    width: 0, height: 0, marginBottom: -1,
    borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 5,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  tagBody: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  tagText: { fontVariant: ['tabular-nums'] },
});
