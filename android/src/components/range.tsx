import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { useTheme } from '../lib/theme';

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

/** Two-thumb range slider (same behaviour as the iOS one), always left-to-right. */
export function RangeSlider({ range, bounds, step = 1, onChange }: {
  range: [number, number]; bounds: [number, number]; step?: number; onChange: (r: [number, number]) => void;
}) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
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
      },
      onPanResponderMove: (_e, g) => {
        const v = valueAt(state.current.start + g.dx);
        const [lo, hi] = state.current.range;
        onChange(which === 0 ? [Math.min(v, hi - step), hi] : [lo, Math.max(v, lo + step)]);
      },
    });

  const low = useRef(makeResponder(0)).current;
  const high = useRef(makeResponder(1)).current;

  return (
    <View style={{ height: THUMB, direction: 'ltr' }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.track, { backgroundColor: c.placeholder, left: THUMB / 2, right: THUMB / 2 }]} />
      <View style={[styles.track, { backgroundColor: c.accent, left: lowX + THUMB / 2, width: Math.max(0, highX - lowX) }]} />
      <View {...low.panHandlers} style={[styles.knob, { left: lowX, borderColor: c.line }]} accessibilityLabel="Minimum price" />
      <View {...high.panHandlers} style={[styles.knob, { left: highX, borderColor: c.line }]} accessibilityLabel="Maximum price" />
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
});
