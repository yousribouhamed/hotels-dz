import { Alert, Linking } from 'react-native';
import { L } from './i18n';
import { Hotel, Review } from './model';
import { useStore } from './store';

/** TODO: replace with the real support address before release (also in the privacy policy page). */
export const SUPPORT_EMAIL = 'support@zalumo.app';
export const POLICY_UPDATED = '2026-10-11';

/** Why someone reports a review (App Store / Play user-generated content rules). */
export const reportReasons = ['Spam or fake', 'Offensive or hateful', 'Shares personal information', 'Not about this place', 'Something else'];

export const reviewKey = (h: Hotel, r: Review) => `${h.id}|${r.d}|${r.t.slice(0, 80)}`;

export function useVisibleReviews(h: Hotel) {
  const hidden = useStore((s) => s.hiddenReviews);
  return h.revs.filter((r) => !hidden.includes(reviewKey(h, r)));
}

export function mailURL(subject: string, body: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Emails the report and hides the review straight away. */
export function reportReview(h: Hotel, r: Review, reason: string) {
  const body = `Stay: ${h.name} (#${h.id})\nReview date: ${r.d}\nReason: ${reason}\n\nReview:\n${r.t}`;
  Linking.openURL(mailURL(`Review report #${h.id}`, body)).catch(() => {});
  useStore.getState().hideReview(reviewKey(h, r));
}

/** Asks, then hides the review on this phone. */
export function confirmBlock(h: Hotel, r: Review, onDone: () => void) {
  Alert.alert(L('Block this reviewer?'), L('Their review will be hidden on this phone. You can unblock in Settings.'), [
    { text: L('Cancel'), style: 'cancel' },
    {
      text: L('Block'),
      style: 'destructive',
      onPress: () => {
        useStore.getState().hideReview(reviewKey(h, r));
        onDone();
      },
    },
  ]);
}
