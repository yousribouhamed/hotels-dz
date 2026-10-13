import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, ToastAndroid, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L, LF, formatDay } from '../../lib/i18n';
import { Hotel, hotels } from '../../lib/model';
import { useVisibleReviews } from '../../lib/moderation';
import { useCommunity, useGuestReviews, useMyReview } from '../../lib/community';
import { useTheme } from '../../lib/theme';
import { GuestReviewCard } from '../../components/reviews';
import { Icon, T } from '../../components/ui';
import { ReviewMenu, Stars } from '../hotel/[id]';

/** Every review of one stay: your own, guests', then all collected ones (newest first). */
export default function AllReviews() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hotel = hotels.find((h) => h.id === Number(id));
  return hotel ? <ReviewList hotel={hotel} /> : null;
}

function ReviewList({ hotel }: { hotel: Hotel }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const visible = useVisibleReviews(hotel);
  const guests = useGuestReviews(hotel.id);
  const mine = useMyReview(hotel.id);
  useEffect(() => {
    useCommunity.getState().load(hotel.id);
  }, [hotel.id]);
  const note = (text: string) => ToastAndroid.show(text, ToastAndroid.SHORT);
  const total = visible.length + guests.length + (mine ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top }}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={L('Back')} style={styles.back}>
          <Icon name="arrow-left" size={24} directional />
        </Pressable>
        <T v="headline">{LF('%d reviews', total)}</T>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(_, i) => String(i)}
        initialNumToRender={8}
        windowSize={9}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 + insets.bottom }}
        ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: c.line }]} />}
        ListHeaderComponent={
          <>
            {mine ? <GuestReviewCard hotel={hotel} review={mine} isMine row onEdit={() => router.push(`/review/${hotel.id}`)} onNote={note} /> : null}
            {guests.map((r) => (
              <GuestReviewCard key={r.id} hotel={hotel} review={r} row onNote={note} />
            ))}
            {(mine || guests.length) && visible.length ? <View style={[styles.divider, { backgroundColor: c.line }]} /> : null}
          </>
        }
        renderItem={({ item: r }) => (
          <View style={styles.row}>
            <View style={styles.meta}>
              <Stars n={r.s ?? 0} size={9} />
              {formatDay(r.d) ? <T v="caption" secondary>{`· ${formatDay(r.d)}`}</T> : null}
              <View style={{ flex: 1 }} />
              <ReviewMenu hotel={hotel} review={r} onNote={note} />
            </View>
            <T v="subheadline">{r.t}</T>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  row: { paddingVertical: 14, gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: StyleSheet.hairlineWidth },
});
