import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L } from '../lib/i18n';
import { useCommunity } from '../lib/community';
import { useTheme } from '../lib/theme';
import { Icon, T } from '../components/ui';

/** Sign in with Google or Apple before writing a review. `next` is the stay to review afterwards. */
export default function SignIn() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [working, setWorking] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: 'google' | 'apple') => {
    setWorking(provider);
    setError(null);
    try {
      const ok = await useCommunity.getState().signIn(provider);
      setWorking(null);
      if (!ok) return;
      if (next) {
        await useCommunity.getState().load(Number(next));
        router.replace(`/review/${next}`);
      } else {
        router.back();
      }
    } catch {
      setWorking(null);
      setError(L('Couldn’t sign in. Please try again.'));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas, paddingBottom: insets.bottom + 16 }}>
      <View style={styles.grabberWrap}><View style={[styles.grabber, { backgroundColor: c.tertiary }]} /></View>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={[styles.headerButton, { backgroundColor: c.surface }]}>
          <T color={c.accent}>{L('Cancel')}</T>
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, alignItems: 'center', gap: 22 }}>
        <View style={[styles.badge, { backgroundColor: c.brandSoft }]}>
          <Icon name="message-text" size={30} color={c.accent} />
        </View>
        <View style={{ gap: 8 }}>
          <T v="title2" w="bold" center>{L('Sign in to write a review')}</T>
          <T v="subheadline" secondary center>{L('Your name will appear on your reviews. We never post anything else.')}</T>
        </View>

        <View style={{ alignSelf: 'stretch', gap: 12 }}>
          <Pressable
            onPress={() => signIn('google')}
            disabled={working != null}
            style={[styles.button, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
          >
            {working === 'google' ? <ActivityIndicator color={isDark ? '#000' : '#FFF'} /> : (
              <T w="semibold" color={isDark ? '#000000' : '#FFFFFF'}>{L('Continue with Google')}</T>
            )}
          </Pressable>
          <Pressable
            onPress={() => signIn('apple')}
            disabled={working != null}
            style={[styles.button, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }]}
          >
            {working === 'apple' ? <ActivityIndicator color={c.accent} /> : (
              <>
                <Icon name="apple" size={20} />
                <T w="semibold">{L('Continue with Apple')}</T>
              </>
            )}
          </Pressable>
        </View>

        {error ? <T v="footnote" w="medium" color={c.heart} center>{error}</T> : null}

        <View style={{ flex: 1 }} />
        <View style={{ gap: 4, alignItems: 'center' }}>
          <T v="footnote" secondary center>{L('By continuing you agree to the community guidelines and privacy policy.')}</T>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={() => router.push('/guidelines')} hitSlop={6}>
              <T v="footnote" w="semibold" color={c.accent}>{L('Community guidelines')}</T>
            </Pressable>
            <Pressable onPress={() => router.push('/privacy')} hitSlop={6}>
              <T v="footnote" w="semibold" color={c.accent}>{L('Privacy policy')}</T>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grabberWrap: { alignItems: 'center', paddingTop: 8 },
  grabber: { width: 36, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 },
  headerButton: { paddingHorizontal: 16, height: 40, borderRadius: 20, justifyContent: 'center' },
  badge: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  button: { height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
