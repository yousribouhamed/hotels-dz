import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';
import { create } from 'zustand';
import { AUTH_REDIRECT, supabase } from './backend';
import { L, languageCode } from './i18n';

/** A review written by a guest in the app, as opposed to the collected ones in hotels.json. */
export type GuestReview = {
  id: string;
  stay_id: number;
  user_id: string;
  display_name?: string | null;
  rating: number;
  body: string;
  lang?: string | null;
  /** Only filled in on your own review, which you can see even when it's hidden after reports. */
  status?: string | null;
  created_at: string;
  updated_at: string;
};

export const guestName = (r: GuestReview) => r.display_name?.trim() || L('Guest');
export const isEdited = (r: GuestReview) => Date.parse(r.updated_at) - Date.parse(r.created_at) > 60_000;
export const isHiddenReview = (r: GuestReview) => (r.status ?? 'published') !== 'published';

/** Why posting failed, in words people can act on. The reasons come from the database checks. */
export function reviewErrorMessage(e: unknown) {
  const text = (e as { message?: string } | null)?.message ?? String(e);
  if (text.includes('blocked_words')) return L('Please remove offensive words and try again.');
  if (text.includes('contact_info')) return L('Please remove phone numbers, emails and links.');
  if (text.includes('rate_limited')) return L('You’ve posted a lot of reviews today. Try again tomorrow.');
  if (text.includes('banned')) return L('Your account can’t post reviews.');
  return L('Couldn’t post your review. Check your connection and try again.');
}

/** The report reasons (shared with the collected reviews) as the database stores them. */
export const reportCodes: Record<string, string> = {
  'Spam or fake': 'spam',
  'Offensive or hateful': 'offensive',
  'Shares personal information': 'personal',
  'Not about this place': 'offTopic',
  'Something else': 'other',
};

/** "Yasmine Benali" → "Yasmine B.", the same rule the database uses for Google names. */
export function shortName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

type State = {
  available: boolean;
  userId: string | null;
  displayName: string;
  reviewsByStay: Record<number, GuestReview[]>;
  mineByStay: Record<number, GuestReview | null>;
  /** Reviewers you blocked. Kept on the phone so blocking works signed out, and on your account when signed in. */
  blocked: string[];
  /** Guest reviews you reported, hidden on this phone straight away. */
  hidden: string[];
  init: () => void;
  load: (stayId: number) => Promise<void>;
  submit: (stayId: number, rating: number, body: string) => Promise<void>;
  deleteMine: (stayId: number) => Promise<void>;
  report: (review: GuestReview, reason: string) => Promise<boolean>;
  block: (review: GuestReview) => Promise<void>;
  unblockAll: () => Promise<void>;
  signIn: (provider: 'google' | 'apple') => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  rename: (name: string) => Promise<void>;
};

const KEY = 'community';
const OWN_COLUMNS = 'id,stay_id,user_id,rating,body,lang,status,created_at,updated_at';
let started = false;

export const useCommunity = create<State>((set, get) => {
  const saveLocal = () => {
    const { blocked, hidden } = get();
    AsyncStorage.setItem(KEY, JSON.stringify({ blocked, hidden })).catch(() => {});
  };

  const signedIn = async (id: string) => {
    set({ userId: id, mineByStay: {} });
    if (!supabase) return;
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', id).maybeSingle();
    if (profile) set({ displayName: profile.display_name });
    const { data: rows } = await supabase.from('user_blocks').select('blocked_id');
    if (rows) {
      set({ blocked: [...new Set([...get().blocked, ...rows.map((r) => r.blocked_id as string)])] });
      saveLocal();
    }
  };

  const signedOut = () => set({ userId: null, displayName: '', mineByStay: {} });

  return {
    available: supabase != null,
    userId: null,
    displayName: '',
    reviewsByStay: {},
    mineByStay: {},
    blocked: [],
    hidden: [],

    init: () => {
      if (started) return;
      started = true;
      AsyncStorage.getItem(KEY)
        .then((raw) => {
          const s = raw ? JSON.parse(raw) : {};
          set({ blocked: Array.isArray(s.blocked) ? s.blocked : [], hidden: Array.isArray(s.hidden) ? s.hidden : [] });
        })
        .catch(() => {});
      if (!supabase) return;
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) signedIn(data.session.user.id);
      });
      supabase.auth.onAuthStateChange((_event, session) => {
        // Supabase asks not to call it again from inside this callback, so defer the work.
        setTimeout(() => {
          const id = session?.user.id ?? null;
          if (id && id !== get().userId) signedIn(id);
          else if (!id && get().userId) signedOut();
        }, 0);
      });
    },

    load: async (stayId) => {
      if (!supabase) return;
      const { data } = await supabase
        .from('public_reviews')
        .select('*')
        .eq('stay_id', stayId)
        .order('created_at', { ascending: false })
        .limit(200);
      // Guest reviews are extra; the collected ones still show if this fails.
      if (data) set({ reviewsByStay: { ...get().reviewsByStay, [stayId]: data as GuestReview[] } });
      const userId = get().userId;
      if (userId) {
        const { data: mine } = await supabase.from('reviews').select(OWN_COLUMNS).eq('stay_id', stayId).eq('user_id', userId).maybeSingle();
        set({
          mineByStay: { ...get().mineByStay, [stayId]: mine ? { ...(mine as GuestReview), display_name: get().displayName } : null },
        });
      }
    },

    /** Posts a review, or saves the changes to yours when you already reviewed this stay. */
    submit: async (stayId, rating, body) => {
      if (!supabase || !get().userId) throw new Error('not_signed_in');
      const text = body.trim();
      const mine = get().mineByStay[stayId];
      const { error } = mine
        ? await supabase.from('reviews').update({ rating, body: text, lang: languageCode() }).eq('id', mine.id)
        : await supabase.from('reviews').insert({ stay_id: stayId, rating, body: text, lang: languageCode() });
      if (error) throw error;
      await get().load(stayId);
    },

    deleteMine: async (stayId) => {
      const mine = get().mineByStay[stayId];
      if (!supabase || !mine) return;
      const { error } = await supabase.from('reviews').delete().eq('id', mine.id);
      if (error) throw error;
      set({
        mineByStay: { ...get().mineByStay, [stayId]: null },
        reviewsByStay: { ...get().reviewsByStay, [stayId]: (get().reviewsByStay[stayId] ?? []).filter((r) => r.id !== mine.id) },
      });
    },

    /** Sends the report to the moderation queue (signed in) and hides the review on this phone.
     *  Returns false when nobody is signed in, so the caller can report by email instead. */
    report: async (review, reason) => {
      set({ hidden: [...new Set([...get().hidden, review.id])] });
      saveLocal();
      if (!supabase || !get().userId) return false;
      await supabase.from('review_reports').insert({ review_id: review.id, reason: reportCodes[reason] ?? 'other' });
      return true;
    },

    block: async (review) => {
      set({ blocked: [...new Set([...get().blocked, review.user_id])] });
      saveLocal();
      if (!supabase || !get().userId) return;
      await supabase.from('user_blocks').insert({ blocked_id: review.user_id });
    },

    unblockAll: async () => {
      set({ blocked: [], hidden: [] });
      saveLocal();
      const userId = get().userId;
      if (!supabase || !userId) return;
      await supabase.from('user_blocks').delete().eq('blocker_id', userId);
    },

    /** Google or Apple through Supabase's sign-in page in a secure browser tab.
     *  Resolves false when the person closes the page. */
    signIn: async (provider) => {
      if (!supabase) return false;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
      });
      if (error || !data?.url) throw error ?? new Error('no_url');
      const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
      if (result.type !== 'success') return false;
      const back = new URL(result.url);
      const code = back.searchParams.get('code');
      if (!code) throw new Error(back.searchParams.get('error_description') ?? 'no_code');
      const { data: session, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      await signedIn(session.user.id);
      return true;
    },

    signOut: async () => {
      await supabase?.auth.signOut().catch(() => {});
      signedOut();
    },

    /** Deletes the account and every review it wrote (the database cascades), then signs out. */
    deleteAccount: async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      signedOut();
    },

    rename: async (name) => {
      const userId = get().userId;
      const clean = name.trim().slice(0, 40);
      if (!supabase || !userId || !clean) return;
      const { error } = await supabase.from('profiles').update({ display_name: clean }).eq('id', userId);
      if (error) throw error;
      const mineByStay = Object.fromEntries(
        Object.entries(get().mineByStay).map(([k, r]) => [k, r ? { ...r, display_name: clean } : r]),
      );
      set({ displayName: clean, mineByStay });
    },
  };
});

/** Other people's reviews of a stay, newest first, without blocked or reported ones. */
export function useGuestReviews(stayId: number) {
  const list = useCommunity((s) => s.reviewsByStay[stayId]);
  const userId = useCommunity((s) => s.userId);
  const blocked = useCommunity((s) => s.blocked);
  const hidden = useCommunity((s) => s.hidden);
  return useMemo(
    () => (list ?? []).filter((r) => r.user_id !== userId && !blocked.includes(r.user_id) && !hidden.includes(r.id)),
    [list, userId, blocked, hidden],
  );
}

export const useMyReview = (stayId: number) => useCommunity((s) => s.mineByStay[stayId] ?? null);
