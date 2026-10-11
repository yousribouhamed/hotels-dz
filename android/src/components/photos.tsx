import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Path, RadialGradient, Rect, Stop, LinearGradient as SvgLinear, Circle } from 'react-native-svg';
import { bundledPhotos } from '../lib/bundledPhotos';
import { L, LF } from '../lib/i18n';
import { Hotel } from '../lib/model';
import { useTheme } from '../lib/theme';
import { Icon, PageDots, T, stayTypeIcon } from './ui';

/** How big a photo is shown; web photos download only the pixels they need. */
export type PhotoSize = 'thumb' | 'compact' | 'full';

const remoteSuffix: Record<PhotoSize, string> = {
  thumb: '=w300-h300-k-no',
  compact: '=w540-h540-k-no',
  full: '=w720-h480-k-no',
};

/** Image source for a photo path: a bundled WebP, or a resized web URL. */
export function photoSource(path: string, size: PhotoSize = 'full') {
  if (!path.startsWith('http')) return bundledPhotos[path] ?? null;
  if (path.includes('googleusercontent.com')) {
    const i = path.lastIndexOf('=w');
    if (i > 0) return { uri: path.slice(0, i) + remoteSuffix[size] };
  }
  return { uri: path };
}

/** A photo that fills its frame, or an illustration when the stay has no photos. */
export function PhotoBox({ path, kind = 'Hotel', placeholderText = 'No photos yet', size = 'full', style }: {
  path?: string | null; kind?: string; placeholderText?: string; size?: PhotoSize; style?: ViewStyle;
}) {
  const { c } = useTheme();
  const source = path ? photoSource(path, size) : null;
  return (
    <View style={[{ backgroundColor: c.placeholder, overflow: 'hidden' }, style]}>
      {source ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={path ?? undefined}
        />
      ) : (
        <NoPhoto text={placeholderText} kind={kind} />
      )}
    </View>
  );
}

/**
 * Empty state for stays without photos: a small landscape in the app palette
 * (sand sky, leaf-green hills, a soft sun) with the stay type in a badge.
 */
export function NoPhoto({ text = 'No photos yet', kind = 'Hotel' }: { text?: string; kind?: string }) {
  const { c } = useTheme();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const { w, h } = box;
  const badge = Math.min(Math.max(h * 0.26, 34), 76);
  const showsText = !!text && h >= 120;

  const hills = (phase: number, height: number) => {
    const base = h - h * height, amp = h * 0.06, steps = 48;
    let d = `M0 ${h} L0 ${base}`;
    for (let i = 0; i <= steps; i++) {
      const x = (w * i) / steps;
      const t = (i / steps) * Math.PI * 2.2 + phase * Math.PI * 2;
      d += ` L${x.toFixed(1)} ${(base - Math.sin(t) * amp).toFixed(1)}`;
    }
    return d + ` L${w} ${h} Z`;
  };

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} accessibilityLabel={text ? L(text) : L('No photos')}>
      {w > 0 && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinear id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.surface} />
              <Stop offset="1" stopColor={c.placeholder} />
            </SvgLinear>
            <RadialGradient id="sun" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c.star} stopOpacity={0.45} />
              <Stop offset="1" stopColor={c.star} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#sky)" />
          {/* A soft sun, top-start so it never sits under the heart button. */}
          <Circle cx={w * 0.16} cy={h * 0.2} r={h * 0.16} fill="url(#sun)" />
          <Path d={hills(0.35, 0.3)} fill={c.good} fillOpacity={0.18} />
          <Path d={hills(0, 0.2)} fill={c.good} fillOpacity={0.3} />
        </Svg>
      )}
      <View style={[StyleSheet.absoluteFill, styles.center, { transform: [{ translateY: -h * 0.06 }], gap: Math.max(6, h * 0.03) }]}>
        <View
          style={[
            styles.badge,
            { width: badge, height: badge, borderRadius: badge / 2, backgroundColor: c.canvas, borderColor: c.accent + '40' },
          ]}
        >
          <Icon name={stayTypeIcon(kind)} size={badge * 0.46} color={c.accent} />
        </View>
        {showsText ? <T v="footnote" w="semibold" secondary>{L(text)}</T> : null}
      </View>
    </View>
  );
}

/** Swipeable photos on a list card. Swiping changes the photo; tapping opens the stay. */
export function CardPhotoCarousel({ hotel }: { hotel: Hotel }) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const photos = hotel.photos;

  const onScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (width > 0) setPage(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width));
    },
    [width],
  );

  // Warm up the next photo so the swipe never shows a blank page.
  const next = photos[page + 1];
  useEffect(() => {
    const src = next ? photoSource(next, 'full') : null;
    if (src && typeof src === 'object' && 'uri' in src) Image.prefetch(src.uri);
  }, [next]);

  if (photos.length <= 1) {
    return <PhotoBox path={photos[0]} kind={hotel.type} style={StyleSheet.absoluteFill} />;
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={LF('Photo %lld of %lld', page + 1, photos.length)}
    >
      {width > 0 && (
        <FlatList
          data={photos}
          keyExtractor={(p, i) => `${i}-${p}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          initialNumToRender={1}
          windowSize={3}
          renderItem={({ item }) => <PhotoBox path={item} kind={hotel.type} style={{ width, height: '100%' }} />}
        />
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.35)']} style={styles.fade} pointerEvents="none" />
      <View style={styles.dots} pointerEvents="none">
        <PageDots count={photos.length} current={page} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44 },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' },
});
