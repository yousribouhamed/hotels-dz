import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { L, LF, formatDay } from '../lib/i18n';
import { Hotel } from '../lib/model';
import { mailURL, reportReasons } from '../lib/moderation';
import { GuestReview, guestName, isEdited, isHiddenReview, useCommunity } from '../lib/community';
import { useTheme } from '../lib/theme';
import { LongPressReview, cardLines } from './reviewPeek';
import { Icon, T } from './ui';
import { Menu, MenuItem } from './menu';

/** A guest's initial in a soft circle, standing in for a profile photo. */
export function ReviewerAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
      <T w="semibold" size={size * 0.45} color={c.accent}>{name.slice(0, 1).toUpperCase()}</T>
    </View>
  );
}

/** Small gold stars, the same as on the collected reviews. */
export function ReviewStars({ n, size = 9 }: { n: number; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={LF('%d out of 5 stars', n)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} name={i < n ? 'star' : 'star-outline'} size={size + 2} color={c.star} />
      ))}
    </View>
  );
}

/** A guest review: the carousel card, or a full-width row (`row`) in long lists. */
export function GuestReviewCard({ hotel, review, isMine = false, row = false, onEdit = () => {}, onNote = () => {} }: {
  hotel: Hotel; review: GuestReview; isMine?: boolean; row?: boolean; onEdit?: () => void; onNote?: (note: string) => void;
}) {
  const { c } = useTheme();
  const day = formatDay(review.created_at.slice(0, 10));
  const hidden = isMine && isHiddenReview(review);
  const who = (
    <>
      <ReviewerAvatar name={guestName(review)} />
      <View style={{ flex: 1, gap: 1 }}>
        <T v="subheadline" w="semibold" numberOfLines={1}>{isMine ? L('Your review') : guestName(review)}</T>
        <View style={styles.meta}>
          <ReviewStars n={review.rating} />
          {day ? <T v="caption" secondary numberOfLines={1}>{`· ${day}`}</T> : null}
          {isEdited(review) ? <T v="caption" secondary>{`· ${L('Edited')}`}</T> : null}
        </View>
      </View>
    </>
  );
  const card = (
    <View
      style={
        row
          ? { paddingVertical: 14, gap: 8 }
          : [styles.card, { backgroundColor: c.surface }, isMine ? { borderWidth: 1.5, borderColor: c.accent + '80' } : null]
      }
    >
      <View style={styles.header}>
        {who}
        <GuestReviewMenu hotel={hotel} review={review} isMine={isMine} onEdit={onEdit} onNote={onNote} />
      </View>
      {hidden ? (
        <View style={styles.meta}>
          <Icon name="eye-off-outline" size={14} color={c.heart} />
          <T v="caption" w="medium" color={c.heart}>{L('Hidden after reports while we check it.')}</T>
        </View>
      ) : null}
      <T v="subheadline" numberOfLines={row ? undefined : cardLines(review.body, hidden ? 3 : 4)}>{review.body}</T>
    </View>
  );
  // Rows in "Show all reviews" already show everything; carousel cards long-press to read it all.
  return row ? card : <LongPressReview text={review.body} header={<View style={styles.header}>{who}</View>}>{card}</LongPressReview>;
}

/** "⋯" on a guest review: edit or delete your own; report or block anyone else's. */
function GuestReviewMenu({ hotel, review, isMine, onEdit, onNote }: {
  hotel: Hotel; review: GuestReview; isMine: boolean; onEdit: () => void; onNote: (note: string) => void;
}) {
  const { c } = useTheme();
  const { report, block, deleteMine } = useCommunity.getState();

  const actions: MenuItem[] = isMine
    ? [
        { id: 'edit', title: L('Edit review'), icon: 'pencil-outline' },
        { id: 'delete', title: L('Delete review'), icon: 'trash-can-outline', destructive: true },
      ]
    : [
        { id: 'report', title: L('Report review'), icon: 'flag-outline', children: reportReasons.map((r) => ({ id: `reason:${r}`, title: L(r) })) },
        { id: 'block', title: L('Block reviewer'), icon: 'account-cancel-outline', destructive: true },
      ];

  const onAction = async (id: string) => {
    if (id === 'edit') onEdit();
    else if (id === 'delete') {
      Alert.alert(L('Delete your review?'), undefined, [
        { text: L('Cancel'), style: 'cancel' },
        {
          text: L('Delete'),
          style: 'destructive',
          onPress: () => deleteMine(hotel.id).then(() => onNote('Review deleted'), () => onNote('Something went wrong. Try again.')),
        },
      ]);
    } else if (id.startsWith('reason:')) {
      const reason = id.slice(7);
      const sent = await report(review, reason);
      if (!sent) {
        // Signed out: the report goes by email instead, like for the collected reviews.
        const body = `Stay: ${hotel.name} (#${hotel.id})\nGuest review: ${review.id}\nReason: ${reason}\n\nReview:\n${review.body}`;
        Linking.openURL(mailURL(`Review report #${hotel.id}`, body)).catch(() => {});
      }
      onNote('Review reported');
    } else if (id === 'block') {
      Alert.alert(L('Block this reviewer?'), L('You won’t see their reviews anymore. You can unblock in Settings.'), [
        { text: L('Cancel'), style: 'cancel' },
        { text: L('Block'), style: 'destructive', onPress: () => block(review).then(() => onNote('Reviewer blocked')) },
      ]);
    }
  };

  return (
    <Menu items={actions} width={240} onSelect={onAction}>
      {(open) => (
        <Pressable onPress={open} hitSlop={6} style={{ width: 36, height: 28, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={L('More options')}>
          <Icon name="dots-horizontal" size={20} color={c.secondary} />
        </Pressable>
      )}
    </Menu>
  );
}

export const starLabels = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

/** Five big stars; tap one to rate. */
export function StarPicker({ rating, onChange }: { rating: number; onChange: (n: number) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          hitSlop={4}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel={LF('%d out of 5 stars', n)}
          accessibilityState={{ selected: n === rating }}
        >
          <Icon
            name={n <= rating ? 'star' : 'star-outline'}
            size={38}
            color={n <= rating ? c.star : c.tertiary}
            style={n === rating ? { transform: [{ scale: 1.12 }] } : undefined}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 280, height: 170, borderRadius: 16, padding: 16, gap: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
