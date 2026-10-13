import React from 'react';
import { Animated, I18nManager, Image, Pressable, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isArabic, formatDecimal, L } from '../lib/i18n';
import { Hotel, Money, lowestDZD, ratingLabel, reviewCountText, siteRating, siteReviewsText, siteScoreText } from '../lib/model';
import { useIsSaved, useStore } from '../lib/store';
import { useTheme } from '../lib/theme';

// MARK: Typography (Apple text style sizes, so both apps read the same)

export type TextStyleName =
  | 'largeTitle' | 'title' | 'title2' | 'title3' | 'headline' | 'body' | 'callout' | 'subheadline' | 'footnote' | 'caption' | 'caption2';
export type Weight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';

const sizes: Record<TextStyleName, number> = {
  largeTitle: 34, title: 28, title2: 22, title3: 20, headline: 17, body: 17, callout: 16, subheadline: 15, footnote: 13, caption: 12, caption2: 11,
};
const numericWeight: Record<Weight, TextStyle['fontWeight']> = {
  light: '300', regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800', black: '900',
};
/** Thmanyah Sans faces (loaded in the root layout). */
const thmanyah: Record<Weight, string> = {
  light: 'Thmanyah-Light', regular: 'Thmanyah-Regular', medium: 'Thmanyah-Medium', semibold: 'Thmanyah-Bold',
  bold: 'Thmanyah-Bold', heavy: 'Thmanyah-Black', black: 'Thmanyah-Black',
};

/** Font for a text style: Thmanyah Sans in Arabic, the system font otherwise. */
export function font(style: TextStyleName, weight?: Weight, size?: number): TextStyle {
  const w = weight ?? (style === 'headline' ? 'semibold' : 'regular');
  const fontSize = size ?? sizes[style];
  return isArabic() ? { fontFamily: thmanyah[w], fontSize } : { fontWeight: numericWeight[w], fontSize };
}

type TProps = TextProps & {
  v?: TextStyleName;
  w?: Weight;
  size?: number;
  color?: string;
  secondary?: boolean;
  tertiary?: boolean;
  center?: boolean;
};

/** App text. Defaults to the body style; leading-aligned in both directions. */
export function T({ v = 'body', w, size, color, secondary, tertiary, center, style, ...rest }: TProps) {
  const { c } = useTheme();
  const tint = color ?? (tertiary ? c.tertiary : secondary ? c.secondary : c.text);
  return (
    <Text
      {...rest}
      style={[font(v, w, size), { color: tint, textAlign: center ? 'center' : 'left' }, style]}
    />
  );
}

// MARK: Icons (SF Symbols in iOS → Material Community Icons here)

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Icon; `directional` ones (chevrons, arrows) mirror in Arabic like SF Symbols do. */
export function Icon({ name, size = 20, color, directional, style }: {
  name: IconName; size?: number; color?: string; directional?: boolean; style?: TextStyle;
}) {
  const { c } = useTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color ?? c.text}
      style={[directional && I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : null, style]}
    />
  );
}

/** Icon for each stay type, shared by the no-photo illustration and map markers. */
export function stayTypeIcon(kind: string): IconName {
  switch (kind) {
    case 'Guest house': return 'home';
    case 'Hostel': return 'bed';
    case 'Holiday rental': return 'home-variant';
    case 'Aparthotel': return 'domain';
    case 'Resort': return 'beach';
    case 'Camping': return 'tent';
    case 'Motel': return 'car';
    default: return 'office-building';
  }
}

// MARK: Small pieces

export function Divider({ style }: { style?: ViewStyle }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }, style]} />;
}

export function SectionTitle({ title }: { title: string }) {
  return <T v="title3" w="bold">{L(title)}</T>;
}

export function ratingColor(rating: number | null | undefined, c: { good: string; accent: string }) {
  if (rating == null) return '#8E8E93';
  if (rating >= 4.5) return c.good;
  if (rating >= 4.0) return c.accent;
  return '#8E8E93';
}

export function RatingRow({ hotel }: { hotel: Hotel }) {
  const { c } = useTheme();
  if (hotel.rating == null) {
    const score = siteScoreText(hotel);
    // Booking-site score: shown out of 10 with its site, never mixed with Google stars.
    if (score == null) return <T v="subheadline" secondary>{L('No reviews yet')}</T>;
    return (
      <View style={styles.row8}>
        <View style={[styles.ratingBox, { backgroundColor: c.surface }]}>
          <T v="subheadline" w="bold">{score}</T>
        </View>
        <T v="subheadline" secondary numberOfLines={1}>{siteReviewsText(hotel)}</T>
      </View>
    );
  }
  const tint = ratingColor(hotel.rating, c);
  return (
    <View style={styles.row8}>
      <View style={[styles.ratingBox, { backgroundColor: tint + '26' }]}>
        <T v="subheadline" w="bold" color={tint}>{formatDecimal(hotel.rating)}</T>
      </View>
      <T v="subheadline" w="semibold" numberOfLines={1}>{ratingLabel(hotel)}</T>
      <T v="subheadline" secondary numberOfLines={1}>{reviewCountText(hotel)}</T>
    </View>
  );
}

export function PriceLabel({ hotel, large }: { hotel: Hotel; large?: boolean }) {
  const dzd = lowestDZD(hotel);
  if (dzd == null) return <T v="subheadline" secondary>{large ? L('No online price') : L('Price on request')}</T>;
  return (
    <View style={[styles.row4, { alignItems: 'baseline' }]}>
      <T v="caption" secondary>{L('from')}</T>
      <T v={large ? 'title3' : 'headline'} w={large ? 'bold' : undefined}>{Money.dzd(dzd)}</T>
      <T v="caption" secondary>{L('/night')}</T>
    </View>
  );
}

/** "★ 4.6 (299)" next to the name. */
export function CompactRating({ hotel }: { hotel: Hotel }) {
  const { c } = useTheme();
  const site = siteRating(hotel);
  return (
    <View
      style={styles.row3}
      accessibilityLabel={hotel.rating != null ? ratingLabel(hotel) : site ? `${siteScoreText(hotel)}, ${siteReviewsText(hotel)}` : L('No reviews yet')}
    >
      {hotel.rating != null ? (
        <>
          <Icon name="star" size={13} color={c.star} />
          <T v="subheadline" w="semibold">{formatDecimal(hotel.rating)}</T>
          <T v="subheadline" secondary>({hotel.reviews})</T>
        </>
      ) : site ? (
        // Out of 10 on a booking site: no star icon, so it never reads as a Google rating.
        <>
          <T v="subheadline" w="semibold">{siteScoreText(hotel)}</T>
          <T v="subheadline" secondary>({site.count})</T>
        </>
      ) : (
        <>
          <Icon name="star" size={13} color={c.star} />
          <T v="subheadline" w="semibold">{L('New')}</T>
        </>
      )}
    </View>
  );
}

/** Outlined heart with a soft fill, readable on any photo. */
export function SaveButton({ hotel, style }: { hotel: Hotel; style?: ViewStyle }) {
  const { c } = useTheme();
  const isSaved = useIsSaved(hotel.id);
  const toggle = useStore((s) => s.toggleSaved);
  return (
    <Pressable
      onPress={() => toggle(hotel.id)}
      hitSlop={6}
      style={[styles.heart, style]}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? L('Remove from saved') : L('Save')}
    >
      <MaterialCommunityIcons name="heart" size={24} color={isSaved ? c.heart : 'rgba(0,0,0,0.3)'} style={styles.heartLayer} />
      <MaterialCommunityIcons name="heart-outline" size={24} color="#FFFFFF" style={[styles.heartLayer, styles.heartShadow]} />
    </Pressable>
  );
}

export function ChipLabel({ title, icon, count, isOn, showsChevron }: {
  title: string; icon?: IconName; count?: number | null; isOn?: boolean; showsChevron?: boolean;
}) {
  const { c } = useTheme();
  const fg = isOn ? c.onAccent : c.text;
  return (
    <View style={[styles.chip, { backgroundColor: isOn ? c.accent : c.surface, borderColor: isOn ? 'transparent' : c.line + '99' }]}>
      {icon ? <Icon name={icon} size={15} color={fg} /> : null}
      <T v="subheadline" w="semibold" color={fg} numberOfLines={1}>{L(title)}</T>
      {count != null ? <T v="subheadline" w="semibold" color={isOn ? fg + 'BF' : c.secondary}>{count}</T> : null}
      {showsChevron ? <Icon name="chevron-down" size={14} color={fg} /> : null}
    </View>
  );
}

export function Chip({ title, icon, count, isOn, disabled, onPress }: {
  title: string; icon?: IconName; count?: number | null; isOn: boolean; disabled?: boolean; onPress: () => void;
}) {
  const off = !!disabled && !isOn;
  return (
    <Pressable onPress={onPress} disabled={off} style={{ opacity: off ? 0.4 : 1 }} accessibilityState={{ selected: isOn, disabled: off }}>
      <ChipLabel title={title} icon={icon} count={count} isOn={isOn} />
    </Pressable>
  );
}

/** Centred page dots; the selected one stretches into a pill. With many photos only five show. */
export function PageDots({ count, current, maxVisible = 5 }: { count: number; current: number; maxVisible?: number }) {
  const start = Math.min(Math.max(0, current - Math.floor(maxVisible / 2)), Math.max(0, count - maxVisible));
  const end = Math.min(count, start + maxVisible);
  const dots = [];
  for (let i = start; i < end; i++) {
    const isEdge = count > maxVisible && ((i === start && start > 0) || (i === end - 1 && end < count));
    const size = isEdge ? 4 : 6.5;
    dots.push(
      <View
        key={i}
        style={{
          width: i === current ? 18 : size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: i === current ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
        }}
      />,
    );
  }
  return <View style={styles.dots}>{dots}</View>;
}

/** Gold laurels either side of the content; one branch, mirrored for the other side. */
export function Laurels({ height, children }: { height: number; children: React.ReactNode }) {
  // Keep each branch on its own side in Arabic too.
  return (
    <View style={[styles.laurels, { gap: height * 0.1, direction: 'ltr' }]}>
      <Image source={require('../../assets/laurel.png')} style={{ height, width: height * 0.494 }} resizeMode="contain" />
      <View style={{ direction: I18nManager.isRTL ? 'rtl' : 'ltr' }}>{children}</View>
      <Image
        source={require('../../assets/laurel.png')}
        style={{ height, width: height * 0.494, transform: [{ scaleX: -1 }] }}
        resizeMode="contain"
      />
    </View>
  );
}

/** All / Hotels / Hostels switch under the result count. A green pill slides to the choice. */
export function SegmentedSwitch<V extends string>({ options, value, onChange }: {
  options: V[]; value: V; onChange: (v: V) => void;
}) {
  const { c } = useTheme();
  const [width, setWidth] = React.useState(0);
  const index = Math.max(0, options.indexOf(value));
  const x = React.useRef(new Animated.Value(index)).current;
  React.useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, speed: 22, bounciness: 3 }).start();
  }, [index, x]);
  // Track minus the 1pt border and 3pt padding on each side.
  const segment = width > 0 ? (width - 8) / options.length : 0;
  const direction = I18nManager.isRTL ? -1 : 1;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.segments, { backgroundColor: c.surface, borderColor: c.line + '99' }]}
      accessibilityRole="tablist"
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.segmentPill, {
            width: segment, backgroundColor: c.accent,
            transform: [{ translateX: Animated.multiply(x, segment * direction) }],
          }]}
        />
      ) : null}
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={styles.segment} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <T v="subheadline" w="semibold" color={on ? c.onAccent : c.text} numberOfLines={1}>{L(o)}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Wrapping row of chips (SwiftUI FlowLayout). */
export function Flow({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{children}</View>;
}

const styles = StyleSheet.create({
  row3: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  row4: { flexDirection: 'row', gap: 4 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBox: { paddingHorizontal: 7, height: 24, borderRadius: 7, justifyContent: 'center' },
  heart: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heartLayer: { position: 'absolute' },
  heartShadow: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1,
  },
  segments: { flexDirection: 'row', padding: 3, borderRadius: 999, borderWidth: 1 },
  segment: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentPill: { position: 'absolute', top: 3, bottom: 3, start: 3, borderRadius: 999 },
  dots: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2, elevation: 0,
  },
  laurels: { flexDirection: 'row', alignItems: 'center' },
});
