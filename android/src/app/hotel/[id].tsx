import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, FlatList, Linking, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Share, StyleSheet, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { MenuView } from '@react-native-menu/menu';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { L, LF, formatDay, formatDecimal, formatDistance } from '../../lib/i18n';
import {
  Hotel, Money, Review, googleMapsURL, hotelById, isGuestFavourite, lowestDZD, mapsAppURL, ratingLabel, rateRows, regionName,
  reviewCountText, starsText, telURL, websiteLabel, websiteURL,
} from '../../lib/model';
import { traits } from '../../lib/filters';
import { confirmBlock, reportReasons, reportReview, useVisibleReviews } from '../../lib/moderation';
import { nearby, useIsSaved, useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { useMapStyle } from '../../lib/mapStyle';
import { CompactStayCard } from '../../components/cards';
import { GuestReviewCard } from '../../components/reviews';
import { LongPressReview, cardLines } from '../../components/reviewPeek';
import { GuestReview, useCommunity, useGuestReviews, useMyReview } from '../../lib/community';
import { PhotoBox } from '../../components/photos';
import { Divider, Flow, Icon, IconName, Laurels, PageDots, SectionTitle, T, stayTypeIcon } from '../../components/ui';

const GALLERY = 340;

/**
 * One long, calm scroll in the Airbnb style: photos, then the essentials, then
 * sections that only appear when there is something to show.
 */
export default function HotelDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hotel = hotelById.get(Number(id));
  if (!hotel) return null;
  return <Detail hotel={hotel} />;
}

function Detail({ hotel }: { hotel: Hotel }) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const t = traits(hotel);
  const scroll = useRef<ScrollView>(null);
  const reviewsY = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [copiedNote, setCopiedNote] = useState<string | null>(null);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const isSaved = useIsSaved(hotel.id);
  const toggleSaved = useStore((s) => s.toggleSaved);

  const tel = telURL(hotel);
  const web = websiteURL(hotel);
  const gmaps = googleMapsURL(hotel);
  const mapsApp = mapsAppURL(hotel);
  const dzd = lowestDZD(hotel);
  const rows = rateRows(hotel);
  const available = hotel.am.filter((a) => a.y);

  const copy = (text: string, note: string) => {
    Clipboard.setStringAsync(text);
    setCopiedNote(note);
    setTimeout(() => setCopiedNote(null), 1600);
  };

  // Once the photos scroll away, show a solid bar with the name behind the buttons.
  const bandOpacity = scrollY.interpolate({ inputRange: [GALLERY - 90, GALLERY - 40], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <Animated.ScrollView
        ref={scroll as never}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Gallery hotel={hotel} />

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 24 }}>
          {/* Header */}
          <View style={{ gap: 6 }}>
            <View style={styles.row6}>
              <T v="subheadline" w="semibold" secondary>{L(hotel.type)}</T>
              {starsText(hotel) ? <T v="subheadline" w="semibold" color={c.star}>{starsText(hotel)}</T> : null}
            </View>
            <T v="title2" w="bold">{hotel.name}</T>
            <T v="subheadline" secondary numberOfLines={2}>
              {(hotel.city === regionName(hotel) ? L(hotel.city) : `${hotel.city}, ${L(regionName(hotel))}`) +
                (t.km != null && t.centreLabel ? ` ${LF('· %@ from %@', formatDistance(t.km), t.centreLabel)}` : '')}
            </T>
          </View>

          {hotel.rating != null ? (
            <RatingStrip hotel={hotel} onPress={() => scroll.current?.scrollTo({ y: reviewsY.current, animated: true })} />
          ) : null}

          {/* Round shortcut buttons: only the ones this stay supports. */}
          <View style={styles.quickActions}>
            {tel ? (
              <MenuView
                shouldOpenOnLongPress
                actions={[{ id: 'copy', title: L('Copy number') }]}
                onPressAction={() => copy(hotel.phone, 'Number copied')}
                style={{ flex: 1 }}
              >
                <QuickAction title="Call" icon="phone" onPress={() => Linking.openURL(tel)} />
              </MenuView>
            ) : null}
            {mapsApp || gmaps ? (
              <QuickAction title="Directions" icon="directions" onPress={() => Linking.openURL((mapsApp ?? gmaps)!)} />
            ) : null}
            {web ? <QuickAction title="Website" icon="web" onPress={() => Linking.openURL(web)} /> : null}
            {hotel.address ? <QuickAction title="Copy address" icon="content-copy" onPress={() => copy(hotel.address, 'Address copied')} /> : null}
          </View>

          {hotel.closed ? (
            <View style={styles.row6}>
              <Icon name="alert" size={18} color={c.heart} />
              <T v="subheadline" w="semibold" color={c.heart} style={{ flex: 1 }}>
                {L('This stay is marked as closed. Call before you travel.')}
              </T>
            </View>
          ) : null}

          {rows.length > 0 ? (
            <Section title="Prices">
              <View>
                {rows.map((row, i) => (
                  <View key={i}>
                    <View style={styles.priceRow}>
                      <T numberOfLines={1} style={{ flexShrink: 1 }}>{L(row.site)}</T>
                      {i === 0 ? (
                        <View style={[styles.lowest, { backgroundColor: c.brandSoft }]}>
                          <T v="caption2" w="bold" color={c.good}>{L('Lowest')}</T>
                        </View>
                      ) : null}
                      <View style={{ flex: 1 }} />
                      <T w="semibold">{Money.dzd(row.dzd)}</T>
                    </View>
                    {i < rows.length - 1 ? <Divider /> : null}
                  </View>
                ))}
              </View>
              <T v="footnote" secondary>
                {LF(
                  'Per night from %@, in dinars as listed online in October 2026. Rates change with dates, so check before booking.',
                  formatDay(hotel.cin) ?? L('a date in autumn 2026'),
                )}
              </T>
            </Section>
          ) : null}

          {hotel.desc ? (
            <Section title="About this place">
              <ExpandableText text={hotel.desc} />
            </Section>
          ) : null}

          {available.length > 0 ? (
            <Section title="What this place offers">
              {/* Two-column tiles: icon on top, name below. */}
              <View style={styles.amenityGrid}>
                {available.slice(0, 6).map((a) => (
                  <View key={a.n} style={[styles.amenityTile, { backgroundColor: c.surface }]}>
                    <Icon name={amenityIcon(a.n)} size={22} color={c.accent} />
                    <T v="subheadline" w="medium" numberOfLines={2}>{L(a.n)}</T>
                  </View>
                ))}
              </View>
              {hotel.am.length > 6 ? (
                <Pressable onPress={() => setShowAllAmenities(true)} style={[styles.showAll, { backgroundColor: c.surface }]}>
                  <T w="semibold" color={c.accent}>{LF('Show all %lld amenities', hotel.am.length)}</T>
                </Pressable>
              ) : null}
            </Section>
          ) : null}

          {hotel.rating != null || useCommunity.getState().available ? (
            <View onLayout={(e) => (reviewsY.current = e.nativeEvent.layout.y + GALLERY - 20)}>
              <Section title="Reviews">
                <Reviews hotel={hotel} onNote={(note) => { setCopiedNote(note); setTimeout(() => setCopiedNote(null), 1600); }} />
              </Section>
            </View>
          ) : null}

          <Section title="Where you’ll be">
            <Location hotel={hotel} dark={isDark} />
          </Section>

          {tel || hotel.email || web ? (
            <Section title="Contact">
              <View>
                {tel ? (
                  <ContactRow icon="phone" title="Phone" value={hotel.phone} onPress={() => Linking.openURL(tel)}
                    copy={{ title: L('Copy number'), run: () => copy(hotel.phone, 'Number copied') }} />
                ) : null}
                {hotel.email ? (
                  <>
                    {tel ? <Divider style={{ marginStart: 44 }} /> : null}
                    <ContactRow icon="email" title="Email" value={hotel.email} onPress={() => Linking.openURL(`mailto:${hotel.email}`)}
                      copy={{ title: L('Copy email'), run: () => copy(hotel.email, 'Email copied') }} />
                  </>
                ) : null}
                {web ? (
                  <>
                    {tel || hotel.email ? <Divider style={{ marginStart: 44 }} /> : null}
                    <ContactRow icon="web" title="Website" value={websiteLabel(hotel)} onPress={() => Linking.openURL(web)} />
                  </>
                ) : null}
              </View>
            </Section>
          ) : null}

          <Nearby hotel={hotel} />

          <T v="footnote" secondary>{L('Details, photos and reviews were last updated in October 2026.')}</T>
        </View>
      </Animated.ScrollView>

      {/* Solid band with the name, faded in after the photos. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.band, { height: insets.top + 60, backgroundColor: c.canvas, borderBottomColor: c.line, opacity: bandOpacity }]}
      >
        <T v="headline" numberOfLines={1} style={{ marginTop: insets.top + 18, marginHorizontal: 72 }}>{hotel.name}</T>
      </Animated.View>

      {/* Back, share and save over the photos. */}
      <View style={[styles.topButtons, { top: insets.top + 8 }]} pointerEvents="box-none">
        <CircleButton icon="arrow-left" directional onPress={() => router.back()} label="Back" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {gmaps ? (
            <CircleButton icon="share-variant" onPress={() => Share.share({ message: `${hotel.name}\n${gmaps}` })} label="Share" />
          ) : null}
          <CircleButton
            icon={isSaved ? 'heart' : 'heart-outline'}
            color={isSaved ? c.heart : undefined}
            onPress={() => toggleSaved(hotel.id)}
            label={isSaved ? L('Remove from saved') : L('Save')}
          />
        </View>
      </View>

      {copiedNote ? (
        <View style={[styles.toast, { backgroundColor: c.surface, bottom: 100 + insets.bottom }]}>
          <Icon name="check-circle" size={18} color={c.good} />
          <T v="subheadline" w="semibold">{L(copiedNote)}</T>
        </View>
      ) : null}

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { backgroundColor: c.canvas, paddingBottom: 12 + insets.bottom }]}>
        <View style={{ flex: 1, gap: 2 }}>
          {dzd != null ? (
            <>
              <View style={[styles.row6, { alignItems: 'baseline', gap: 3 }]}>
                <T v="headline">{Money.dzd(dzd)}</T>
                <T v="subheadline" secondary>{L('/ night')}</T>
              </View>
              <T v="caption" secondary>{L('Lowest online rate')}</T>
            </>
          ) : (
            <>
              <T v="headline">{L('Price on request')}</T>
              <T v="caption" secondary>{tel ? L('Call for today’s rate') : L('Ask at the front desk')}</T>
            </>
          )}
        </View>
        {tel ? (
          <PrimaryButton icon="phone" title={L('Call to book')} onPress={() => Linking.openURL(tel)} />
        ) : mapsApp || gmaps ? (
          <PrimaryButton icon="directions" title={L('Directions')} onPress={() => Linking.openURL((mapsApp ?? gmaps)!)} />
        ) : null}
      </View>

      <AllAmenities hotel={hotel} visible={showAllAmenities} onClose={() => setShowAllAmenities(false)} />
    </View>
  );
}

// MARK: Pieces

function Gallery({ hotel }: { hotel: Hotel }) {
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  if (!hotel.photos.length) {
    return <PhotoBox path={null} kind={hotel.type} placeholderText="No photos yet" style={{ height: GALLERY }} />;
  }
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    width && setPage(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width));
  return (
    <View style={{ height: GALLERY }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <FlatList
          data={hotel.photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p, i) => `${i}-${p}`}
          onMomentumScrollEnd={onEnd}
          renderItem={({ item }) => <PhotoBox path={item} style={{ width, height: GALLERY }} />}
        />
      )}
      {hotel.photos.length > 1 ? (
        <>
          <View style={styles.galleryDots} pointerEvents="none">
            <PageDots count={hotel.photos.length} current={page} />
          </View>
          <View style={styles.counter} pointerEvents="none">
            <T v="caption" w="semibold" color="#FFFFFF">{`${page + 1} / ${hotel.photos.length}`}</T>
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Airbnb-style strip: score · label · review count. Tapping jumps to the reviews. */
function RatingStrip({ hotel, onPress }: { hotel: Hotel; onPress: () => void }) {
  const { c } = useTheme();
  const rating = hotel.rating ?? 0;
  const fav = isGuestFavourite(hotel);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.strip, { borderColor: c.line }]}
      accessibilityLabel={LF('Rated %@, %@, %d reviews. Show reviews', formatDecimal(rating), ratingLabel(hotel), hotel.reviews)}
    >
      <View style={styles.stripCell}>
        {fav ? (
          // Top-rated: just the score sits between small gold laurels, stars below.
          <Laurels height={24}>
            <T v="title3" w="bold">{formatDecimal(rating)}</T>
          </Laurels>
        ) : (
          <T v="title3" w="bold">{formatDecimal(rating)}</T>
        )}
        <Stars n={Math.round(rating)} size={9} />
      </View>
      <View style={[styles.stripDivider, { backgroundColor: c.line }]} />
      <View style={styles.stripCell}>
        {fav ? (
          <T v="headline" center style={{ maxWidth: 90 }}>{L('Guest favourite')}</T>
        ) : (
          <>
            <T v="headline">{ratingLabel(hotel)}</T>
            <T v="caption" secondary>{L('Guest rating')}</T>
          </>
        )}
      </View>
      <View style={[styles.stripDivider, { backgroundColor: c.line }]} />
      <View style={styles.stripCell}>
        <T v="title3" w="bold">{hotel.reviews}</T>
        <T v="caption" secondary>{hotel.reviews === 1 ? L('Review') : L('Reviews')}</T>
      </View>
    </Pressable>
  );
}

function Stars({ n, size }: { n: number; size: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} name={i < n ? 'star' : 'star-outline'} size={size + 2} color={c.star} />
      ))}
    </View>
  );
}

function QuickAction({ title, icon, onPress }: { title: string; icon: IconName; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.quickAction} accessibilityRole="button" accessibilityLabel={L(title)}>
      <View style={[styles.quickCircle, { backgroundColor: c.brandSoft }]}>
        <Icon name={icon} size={20} color={c.accent} />
      </View>
      <T v="caption" w="medium" numberOfLines={1}>{L(title)}</T>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 14 }}>
      <Divider style={{ marginBottom: 6 }} />
      <SectionTitle title={title} />
      {children}
    </View>
  );
}

/** Long descriptions show five lines with "Show more". */
function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <T numberOfLines={expanded ? undefined : 5}>{text}</T>
      {text.length > 240 ? (
        <Pressable onPress={() => setExpanded(!expanded)}>
          <T v="subheadline" w="semibold" style={{ textDecorationLine: 'underline' }}>
            {expanded ? L('Show less') : L('Show more')}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

function amenityIcon(name: string): IconName {
  const n = name.toLowerCase();
  const table: [string, IconName][] = [
    ['wi-fi', 'wifi'], ['parking', 'parking'], ['breakfast', 'coffee'], ['air con', 'snowflake'],
    ['restaurant', 'silverware-fork-knife'], ['bar', 'glass-wine'], ['pool', 'pool'], ['shuttle', 'airplane'],
    ['kid', 'human-male-female-child'], ['pets', 'paw'], ['fitness', 'dumbbell'], ['spa', 'leaf'], ['hot tub', 'hot-tub'],
    ['laundry', 'washing-machine'], ['room service', 'bell-ring'], ['wheelchair', 'wheelchair-accessibility'],
    ['business', 'briefcase'], ['smoking', 'smoking-off'], ['beach', 'beach'], ['kitchen', 'stove'],
  ];
  return table.find(([k]) => n.includes(k))?.[1] ?? 'check-circle-outline';
}

function AllAmenities({ hotel, visible, onClose }: { hotel: Hotel; visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const yes = hotel.am.filter((a) => a.y), no = hotel.am.filter((a) => !a.y);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.canvas, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHeader}>
          <T v="headline">{L('What this place offers')}</T>
          <Pressable onPress={onClose} hitSlop={10}>
            <T v="body" w="semibold" color={c.accent}>{L('Done')}</T>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          <T v="footnote" w="semibold" secondary style={{ textTransform: 'uppercase' }}>{L('Available')}</T>
          {yes.map((a) => (
            <View key={a.n} style={styles.listRow}>
              <Icon name={amenityIcon(a.n)} size={20} color={c.accent} />
              <T>{L(a.n)}</T>
            </View>
          ))}
          {no.length ? (
            <>
              <T v="footnote" w="semibold" secondary style={{ textTransform: 'uppercase', marginTop: 12 }}>{L('Not available')}</T>
              {no.map((a) => (
                <View key={a.n} style={styles.listRow}>
                  <Icon name={amenityIcon(a.n)} size={20} color={c.secondary} />
                  <T secondary style={{ textDecorationLine: 'line-through' }}>{L(a.n)}</T>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

type ReviewItem = { kind: 'mine' | 'guest'; r: GuestReview } | { kind: 'collected'; r: Review };

function Reviews({ hotel, onNote }: { hotel: Hotel; onNote: (note: string) => void }) {
  const visible = useVisibleReviews(hotel);
  const guests = useGuestReviews(hotel.id);
  const mine = useMyReview(hotel.id);
  const available = useCommunity((s) => s.available);
  const signedIn = useCommunity((s) => s.userId != null);
  const { c } = useTheme();
  useEffect(() => {
    useCommunity.getState().load(hotel.id);
  }, [hotel.id, signedIn]);
  const items: ReviewItem[] = [
    ...(mine ? [{ kind: 'mine' as const, r: mine }] : []),
    ...guests.map((r) => ({ kind: 'guest' as const, r })),
    ...visible.map((r) => ({ kind: 'collected' as const, r })),
  ];
  // Opens the review form, or sign-in first when nobody is signed in.
  const writeReview = () => router.push(signedIn ? `/review/${hotel.id}` : `/signin?next=${hotel.id}`);
  const guestList = mine ? [mine, ...guests] : guests;
  const guestAverage = guestList.reduce((s, r) => s + r.rating, 0) / Math.max(1, guestList.length);
  const rating = hotel.rating ?? 0;
  const d = hotel.dist;
  const dist: [number, number][] = [[5, d?.fiveStar ?? 0], [4, d?.fourStar ?? 0], [3, d?.threeStar ?? 0], [2, d?.twoStar ?? 0], [1, d?.oneStar ?? 0]];
  const total = Math.max(1, dist.reduce((s, [, n]) => s + n, 0));
  const bars = (
    <View style={{ flex: 1, gap: 5 }}>
      {dist.map(([star, n]) => (
        <View key={star} style={styles.row6}>
          <T v="caption" secondary style={{ width: 10 }}>{star}</T>
          <View style={[styles.barTrack, { backgroundColor: c.placeholder }]}>
            <View style={{ width: `${(100 * n) / total}%`, height: '100%', borderRadius: 2, backgroundColor: c.good }} />
          </View>
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ gap: 18 }}>
      {hotel.rating == null ? (
        guestList.length === 0 ? (
          <T v="subheadline" secondary>{L('No reviews yet')}</T>
        ) : (
          // Stays without collected reviews: the average of the guest reviews.
          <View style={[styles.row6, { alignItems: 'baseline', gap: 10 }]}>
            <T v="largeTitle" w="bold" size={44}>{formatDecimal(guestAverage)}</T>
            <T v="caption" secondary>{guestList.length === 1 ? L('1 review') : LF('%d reviews', guestList.length)}</T>
          </View>
        )
      ) : isGuestFavourite(hotel) ? (
        // Top-rated stays: score between gold laurels on one side, star breakdown on the other.
        <View style={[styles.row6, { gap: 16, paddingVertical: 6 }]}>
          <View style={{ alignItems: 'center', gap: 4, maxWidth: 150 }}>
            <Laurels height={52}>
              <T v="largeTitle" w="bold" size={40}>{formatDecimal(rating)}</T>
            </Laurels>
            <T v="subheadline" w="bold" center>{L('Guest favourite')}</T>
            <T v="caption" secondary center>{reviewCountText(hotel)}</T>
          </View>
          {bars}
        </View>
      ) : (
        <View style={[styles.row6, { gap: 20 }]}>
          <View style={{ gap: 2 }}>
            <T v="largeTitle" w="bold" size={44}>{formatDecimal(rating)}</T>
            <T v="caption" secondary>{reviewCountText(hotel)}</T>
          </View>
          {bars}
        </View>
      )}
      {hotel.tags.length ? (
        <Flow gap={6}>
          {hotel.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: c.surface }]}>
              <T v="footnote" w="semibold">{tag}</T>
            </View>
          ))}
        </Flow>
      ) : null}
      {items.length ? (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item, i) => (item.kind === 'collected' ? `c${i}` : item.r.id)}
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          snapToInterval={292}
          decelerationRate="fast"
          renderItem={({ item }) => {
            if (item.kind !== 'collected') {
              return <GuestReviewCard hotel={hotel} review={item.r} isMine={item.kind === 'mine'} onEdit={writeReview} onNote={onNote} />;
            }
            const r = item.r;
            const meta = (
              <>
                <Stars n={r.s ?? 0} size={9} />
                {formatDay(r.d) ? <T v="caption" secondary>{`· ${formatDay(r.d)}`}</T> : null}
              </>
            );
            return (
              <LongPressReview text={r.t} header={<View style={styles.row6}>{meta}</View>}>
                <View style={[styles.reviewCard, { backgroundColor: c.surface }]}>
                  <View style={styles.row6}>
                    {meta}
                    <View style={{ flex: 1 }} />
                    <ReviewMenu hotel={hotel} review={r} onNote={onNote} />
                  </View>
                  <T v="subheadline" numberOfLines={cardLines(r.t)}>{r.t}</T>
                </View>
              </LongPressReview>
            );
          }}
        />
      ) : null}
      {available ? (
        <Pressable onPress={writeReview} style={[styles.writeButton, { backgroundColor: c.surface }]}>
          <Icon name={mine ? 'pencil' : 'square-edit-outline'} size={18} color={c.accent} />
          <T w="semibold" color={c.accent}>
            {mine ? L('Edit your review') : items.length === 0 ? L('Be the first to review this place') : L('Write a review')}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** "⋯" on a review: Report (with a reason) or Block. */
function ReviewMenu({ hotel, review, onNote }: { hotel: Hotel; review: Review; onNote: (note: string) => void }) {
  const { c, isDark } = useTheme();
  return (
    <MenuView
      themeVariant={isDark ? 'dark' : 'light'}
      actions={[
        {
          id: 'report',
          title: L('Report review'),
          subactions: reportReasons.map((r) => ({ id: `reason:${r}`, title: L(r) })),
        },
        { id: 'block', title: L('Block reviewer'), attributes: { destructive: true } },
      ]}
      onPressAction={({ nativeEvent }) => {
        const id = nativeEvent.event;
        if (id.startsWith('reason:')) {
          reportReview(hotel, review, id.slice(7));
          onNote('Review reported');
        } else if (id === 'block') {
          confirmBlock(hotel, review, () => onNote('Reviewer blocked'));
        }
      }}
    >
      <View style={{ width: 36, height: 28, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={L('More options')}>
        <Icon name="dots-horizontal" size={20} color={c.secondary} />
      </View>
    </MenuView>
  );
}

function Location({ hotel, dark }: { hotel: Hotel; dark: boolean }) {
  const { c } = useTheme();
  const t = traits(hotel);
  const style = useMapStyle(dark);
  const open = googleMapsURL(hotel) ?? mapsAppURL(hotel);
  return (
    <View style={{ gap: 12 }}>
      {hotel.lat != null && hotel.lng != null ? (
        <Pressable onPress={() => open && Linking.openURL(open)} style={styles.mapBox} accessibilityLabel={L('Open the map')}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Map style={StyleSheet.absoluteFill} mapStyle={style} logo={false} attribution={false} dragPan={false}
              touchZoom={false} doubleTapZoom={false} touchRotate={false} touchPitch={false}>
              <Camera initialViewState={{ center: [hotel.lng, hotel.lat], zoom: 14 }} />
              <Marker id="stay" lngLat={[hotel.lng, hotel.lat]}>
                <View style={[styles.marker, { backgroundColor: c.accent }]}>
                  <Icon name={stayTypeIcon(hotel.type)} size={16} color={c.onAccent} />
                </View>
              </Marker>
            </Map>
          </View>
          <View style={[styles.expand, { backgroundColor: c.bar }]}>
            <Icon name="arrow-expand" size={14} />
          </View>
        </Pressable>
      ) : null}
      {hotel.address ? <T v="subheadline" selectable>{hotel.address}</T> : null}
      {t.km != null && t.centreLabel ? <T v="subheadline" secondary>{LF('%@ from %@', formatDistance(t.km), t.centreLabel)}</T> : null}
    </View>
  );
}

/** Settings-style rows. Long-press to copy. */
function ContactRow({ icon, title, value, onPress, copy }: {
  icon: IconName; title: string; value: string; onPress: () => void; copy?: { title: string; run: () => void };
}) {
  const { c } = useTheme();
  const row = (
    <Pressable onPress={onPress} style={styles.contactRow}>
      <Icon name={icon} size={22} color={c.accent} style={{ width: 30 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="caption" secondary>{L(title)}</T>
        <T numberOfLines={1}>{value}</T>
      </View>
      <Icon name="chevron-right" size={18} color={c.tertiary} directional />
    </Pressable>
  );
  if (!copy) return row;
  return (
    <MenuView shouldOpenOnLongPress actions={[{ id: 'copy', title: copy.title }]} onPressAction={copy.run}>
      {row}
    </MenuView>
  );
}

function Nearby({ hotel }: { hotel: Hotel }) {
  const near = useMemo(() => nearby(hotel, 8), [hotel]);
  if (!near.length) return null;
  return (
    <View style={{ gap: 14 }}>
      <Divider style={{ marginBottom: 6 }} />
      <SectionTitle title="Nearby stays" />
      <FlatList
        horizontal
        data={near}
        keyExtractor={(n) => String(n.hotel.id)}
        renderItem={({ item }) => <CompactStayCard hotel={item.hotel} />}
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      />
    </View>
  );
}

function CircleButton({ icon, onPress, label, color, directional }: {
  icon: IconName; onPress: () => void; label: string; color?: string; directional?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.circle, { backgroundColor: c.bar }]} accessibilityLabel={label}>
      <Icon name={icon} size={22} color={color} directional={directional} />
    </Pressable>
  );
}

function PrimaryButton({ icon, title, onPress }: { icon: IconName; title: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.primary, { backgroundColor: c.accent }]}>
      <Icon name={icon} size={18} color={c.onAccent} />
      <T w="semibold" color={c.onAccent} numberOfLines={1}>{title}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  galleryDots: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' },
  counter: { position: 'absolute', bottom: 10, end: 14, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  strip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderWidth: 1, borderRadius: 16 },
  stripCell: { flex: 1, alignItems: 'center', gap: 2 },
  stripDivider: { width: StyleSheet.hairlineWidth, height: 34 },
  quickActions: { flexDirection: 'row' },
  quickAction: { flex: 1, alignItems: 'center', gap: 6 },
  quickCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  lowest: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityTile: { width: '48%', flexGrow: 1, minHeight: 80, borderRadius: 14, padding: 12, gap: 8 },
  showAll: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 24, marginTop: 4 },
  barTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  reviewCard: { width: 280, height: 170, borderRadius: 16, padding: 16, gap: 8 },
  writeButton: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapBox: { height: 200, borderRadius: 16, overflow: 'hidden' },
  marker: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  expand: { position: 'absolute', top: 10, end: 10, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  band: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  topButtons: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, elevation: 4 },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12,
    elevation: 12, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: -2 },
  },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 20, borderRadius: 25 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
});
