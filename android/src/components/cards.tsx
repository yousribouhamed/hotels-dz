import React from 'react';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { L, LF, formatDecimal, formatDistance } from '../lib/i18n';
import { Hotel, Money, lowestDZD, regionName, starsText, telURL } from '../lib/model';
import { amenityKeys, amenityTitle, traits } from '../lib/filters';
import { useTheme } from '../lib/theme';
import { CardPhotoCarousel, PhotoBox } from './photos';
import { CompactRating, Icon, SaveButton, T } from './ui';

export const openHotel = (h: Hotel) => router.push(`/hotel/${h.id}`);

/** Full-width card: rounded photo carousel, then name + rating, one detail line, price or call. */
export function HotelCard({ hotel }: { hotel: Hotel }) {
  const { c } = useTheme();
  const t = traits(hotel);
  const dzd = lowestDZD(hotel);
  const tel = telURL(hotel);
  const stars = starsText(hotel);

  return (
    <View style={styles.card}>
      <Pressable onPress={() => openHotel(hotel)} accessibilityRole="button" accessibilityLabel={hotel.name}>
        <View style={styles.photo}>
          <CardPhotoCarousel hotel={hotel} />
          {hotel.closed ? (
            <View style={styles.closed}>
              <T v="caption" w="bold" color="#FFFFFF">{L('Closed')}</T>
            </View>
          ) : null}
        </View>

        <View style={{ gap: 3, marginTop: 10 }}>
          <View style={styles.titleRow}>
            <T v="headline" numberOfLines={2} style={{ flex: 1 }}>{hotel.name}</T>
            <CompactRating hotel={hotel} />
          </View>
          {/* Type, hotel class and how far it is from the centre, on one line. */}
          <View style={styles.detailRow}>
            <T v="subheadline" secondary>{L(hotel.type)}</T>
            {stars ? <T v="subheadline" color={c.star}>{stars}</T> : null}
            <T v="subheadline" secondary numberOfLines={1} style={{ flexShrink: 1 }}>
              {t.km != null && t.centreLabel
                ? LF('· %@ from %@', formatDistance(t.km), t.centreLabel)
                : hotel.city !== regionName(hotel) ? `· ${hotel.city}` : ''}
            </T>
          </View>
          <View style={{ marginTop: 2 }}>
            {dzd != null ? (
              <View style={styles.price}>
                <T v="headline">{Money.dzd(dzd)}</T>
                <T v="subheadline" secondary>{L('/ night')}</T>
              </View>
            ) : tel ? (
              // Placeholder line; the tappable "Call for price" sits on top, outside the card link.
              <View style={{ height: 22 }} />
            ) : (
              <T v="subheadline" secondary numberOfLines={1}>
                {(() => {
                  const highlights = amenityKeys.filter((k) => t.amenities.has(k)).slice(0, 3).map(amenityTitle);
                  return highlights.length ? highlights.join(' · ') : L('Price on request');
                })()}
              </T>
            )}
          </View>
        </View>
      </Pressable>

      {/* Kept outside the link so tapping them doesn't open the stay. */}
      <SaveButton hotel={hotel} style={styles.save} />
      {dzd == null && tel ? (
        <Pressable
          onPress={() => Linking.openURL(tel)}
          style={styles.callForPrice}
          hitSlop={6}
          accessibilityLabel={LF('Call %@ for a price', hotel.name)}
        >
          <Icon name="phone" size={17} color={c.accent} />
          <T v="subheadline" w="semibold" color={c.accent}>{L('Call for price')}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Small square-photo card for the wilaya rows and nearby stays. */
export const COMPACT_WIDTH = 164;

export function CompactStayCard({ hotel }: { hotel: Hotel }) {
  const { c } = useTheme();
  const dzd = lowestDZD(hotel);
  return (
    <View style={{ width: COMPACT_WIDTH }}>
      <Pressable onPress={() => openHotel(hotel)} accessibilityRole="button" accessibilityLabel={hotel.name} style={{ gap: 6 }}>
        <PhotoBox
          path={hotel.photos[0]}
          kind={hotel.type}
          placeholderText="No photos yet"
          size="compact"
          style={{ width: COMPACT_WIDTH, height: COMPACT_WIDTH, borderRadius: 14 }}
        />
        <View style={{ gap: 2 }}>
          <T v="subheadline" w="semibold" numberOfLines={1}>{hotel.name}</T>
          <View style={styles.compactMeta}>
            <T v="footnote" secondary>{L(hotel.type)}</T>
            {hotel.rating != null ? (
              <>
                <T v="footnote" secondary>·</T>
                <Icon name="star" size={11} color={c.star} />
                <T v="footnote" secondary>{formatDecimal(hotel.rating)}</T>
              </>
            ) : null}
          </View>
          {dzd != null ? (
            <View style={styles.price}>
              <T v="footnote" w="semibold">{Money.dzd(dzd)}</T>
              <T v="footnote" secondary>{L('/ night')}</T>
            </View>
          ) : null}
        </View>
      </Pressable>
      <SaveButton hotel={hotel} style={styles.compactSave} />
    </View>
  );
}

/** Last tile in a row, opening the full list for that wilaya. */
function SeeAllTile({ name, total, onPress }: { name: string; total: number; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.seeAll, { height: COMPACT_WIDTH }]}>
      <View style={[styles.seeAllCircle, { backgroundColor: c.surface }]}>
        <Icon name="arrow-right" size={22} directional />
      </View>
      <T v="subheadline" w="semibold" center>{LF('See all %lld', total)}</T>
      <T v="footnote" secondary center>{LF('in %@', L(name))}</T>
    </Pressable>
  );
}

/** "Hotels to stay in Algiers ›" with a sideways row of compact cards. */
export function WilayaRow({ name, total, hotels, onShowAll }: {
  name: string; total: number; hotels: Hotel[]; onShowAll: () => void;
}) {
  return (
    <View style={{ gap: 10, paddingTop: 6, paddingBottom: 8 }}>
      <Pressable
        onPress={onShowAll}
        style={styles.rowTitle}
        accessibilityRole="button"
        accessibilityLabel={LF('Hotels to stay in %@, see all %d', L(name), total)}
      >
        <T v="title3" w="bold" numberOfLines={1} style={{ flexShrink: 1, paddingEnd: 2 }}>{LF('Hotels to stay in %@', L(name))}</T>
        <Icon name="chevron-right" size={22} directional />
      </Pressable>
      <FlatList
        horizontal
        data={hotels}
        keyExtractor={(h) => String(h.id)}
        renderItem={({ item }) => <CompactStayCard hotel={item} />}
        ListFooterComponent={<SeeAllTile name={name} total={total} onPress={onShowAll} />}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        showsHorizontalScrollIndicator={false}
        snapToInterval={COMPACT_WIDTH + 12}
        decelerationRate="fast"
        initialNumToRender={3}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingBottom: 8 },
  photo: { aspectRatio: 4 / 3, borderRadius: 16, overflow: 'hidden' },
  closed: {
    position: 'absolute', top: 12, start: 12, backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  save: { position: 'absolute', top: 6, end: 6 },
  callForPrice: { position: 'absolute', bottom: 8, start: 0, flexDirection: 'row', alignItems: 'center', gap: 6, height: 24 },
  compactMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactSave: { position: 'absolute', top: 0, end: 0 },
  seeAll: { width: 120, alignItems: 'center', justifyContent: 'center', gap: 8 },
  seeAllCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16 },
});
