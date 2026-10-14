import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase project behind guest reviews (see supabase/SETUP.md), set in `.env`:
 *   EXPO_PUBLIC_SUPABASE_URL=…   EXPO_PUBLIC_SUPABASE_ANON_KEY=…
 * The anon key is meant to ship inside apps: the database rules decide who can read and write what.
 * While these are empty the app works as before, without guest reviews.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const AUTH_REDIRECT = 'zalumo://login-callback';

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
      })
    : null;

// Refresh the sign-in only while the app is open, as Supabase recommends for mobile apps.
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
