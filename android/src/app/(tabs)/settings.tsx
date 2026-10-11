import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L, LF, LanguageSetting } from '../../lib/i18n';
import { mailURL } from '../../lib/moderation';
import { Appearance, useStore } from '../../lib/store';
import { palettes, useTheme } from '../../lib/theme';
import { Divider, Icon, T, font } from '../../components/ui';
import { ReviewerAvatar } from '../../components/reviews';
import { useCommunity } from '../../lib/community';

const languages: { id: LanguageSetting; name: () => string }[] = [
  { id: 'system', name: () => L('Device language') },
  { id: 'en', name: () => 'English' },
  { id: 'fr', name: () => 'Français' },
  { id: 'ar', name: () => 'العربية' },
];

const appearances: { id: Appearance; title: string }[] = [
  { id: 'system', title: 'Automatic' },
  { id: 'light', title: 'Light' },
  { id: 'dark', title: 'Dark' },
];

export default function SettingsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const language = useStore((s) => s.language);
  const appearance = useStore((s) => s.appearance);
  const setLanguage = useStore((s) => s.setLanguage);
  const setAppearance = useStore((s) => s.setAppearance);
  const hiddenReviews = useStore((s) => s.hiddenReviews);
  const unhideAll = useStore((s) => s.unhideAllReviews);
  const communityAvailable = useCommunity((s) => s.available);
  const blockedGuests = useCommunity((s) => s.blocked.length + s.hidden.length);
  const hiddenCount = hiddenReviews.length + blockedGuests;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.canvas }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40 }}>
      <T v="largeTitle" w="bold" style={styles.title}>{L('Settings')}</T>
      <View style={{ paddingHorizontal: 16, gap: 28 }}>
        <Group title="Appearance">
          <View style={styles.tiles}>
            {appearances.map((a) => (
              <AppearanceTile key={a.id} option={a.id} title={a.title} isOn={appearance === a.id} onPress={() => setAppearance(a.id)} />
            ))}
          </View>
        </Group>

        <Group title="Language">
          {languages.map((l, i) => (
            <View key={l.id}>
              <Pressable onPress={() => setLanguage(l.id)} style={styles.row} accessibilityState={{ selected: language === l.id }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T>{l.name()}</T>
                  {l.id === 'system' ? <T v="footnote" secondary>{L('Follows your iPhone settings')}</T> : null}
                </View>
                {language === l.id ? <Icon name="check" size={22} color={c.accent} /> : null}
              </Pressable>
              {i < languages.length - 1 ? <Divider style={{ marginStart: 16 }} /> : null}
            </View>
          ))}
        </Group>

        {communityAvailable ? (
          <Group title="Account">
            <AccountRows />
          </Group>
        ) : null}

        <Group title="Support & privacy">
          <SupportRow icon="shield-account" title="Privacy policy" onPress={() => router.push('/privacy')} />
          <Divider style={{ marginStart: 52 }} />
          <SupportRow icon="email" title="Contact us" onPress={() => Linking.openURL(mailURL('Boumerdès Stays', ''))} />
          {hiddenCount > 0 ? (
            <>
              <Divider style={{ marginStart: 52 }} />
              <View style={styles.row}>
                <Icon name="eye-off" size={20} color={c.accent} style={{ width: 22 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T>{L('Blocked reviews')}</T>
                  <T v="footnote" secondary>{LF('%d hidden', hiddenCount)}</T>
                </View>
                <Pressable onPress={() => { unhideAll(); useCommunity.getState().unblockAll(); }} hitSlop={8}>
                  <T v="subheadline" w="semibold" color={c.accent}>{L('Unblock all')}</T>
                </Pressable>
              </View>
            </>
          ) : null}
        </Group>
      </View>
    </ScrollView>
  );
}

/** Signed out: one row to sign in. Signed in: your name, sign out, delete account. */
function AccountRows() {
  const { c } = useTheme();
  const signedIn = useCommunity((s) => s.userId != null);
  const displayName = useCommunity((s) => s.displayName) || L('Guest');
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  if (!signedIn) {
    return (
      <Pressable onPress={() => router.push('/signin')} style={styles.row}>
        <Icon name="account-circle" size={20} color={c.accent} style={{ width: 22 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <T>{L('Sign in')}</T>
          <T v="footnote" secondary>{L('Sign in to post reviews')}</T>
        </View>
        <Icon name="chevron-right" size={18} color={c.tertiary} directional />
      </Pressable>
    );
  }

  const saveName = () => {
    setRenaming(false);
    useCommunity.getState().rename(newName).catch(() => Alert.alert(L('Something went wrong. Try again.')));
  };

  const confirmDelete = () =>
    Alert.alert(L('Delete your account?'), L('Your account and all your reviews will be deleted for good.'), [
      { text: L('Cancel'), style: 'cancel' },
      {
        text: L('Delete account'),
        style: 'destructive',
        onPress: () =>
          useCommunity.getState().deleteAccount().then(
            () => Alert.alert(L('Account deleted')),
            () => Alert.alert(L('Something went wrong. Try again.')),
          ),
      },
    ]);

  return (
    <View>
      <View style={styles.row}>
        <ReviewerAvatar name={displayName} size={36} />
        {renaming ? (
          <TextInput
            value={newName}
            onChangeText={setNewName}
            autoFocus
            maxLength={40}
            placeholder={L('Your name')}
            placeholderTextColor={c.tertiary}
            onSubmitEditing={saveName}
            style={[font('body'), { flex: 1, color: c.text, paddingVertical: 4 }]}
          />
        ) : (
          <View style={{ flex: 1, gap: 2 }}>
            <T w="semibold">{displayName}</T>
            <T v="footnote" secondary>{L('Shown on your reviews')}</T>
          </View>
        )}
        <Pressable
          onPress={() => (renaming ? saveName() : (setNewName(useCommunity.getState().displayName), setRenaming(true)))}
          hitSlop={8}
        >
          <T v="subheadline" w="semibold" color={c.accent}>{renaming ? L('Save') : L('Change name')}</T>
        </Pressable>
      </View>
      <Divider style={{ marginStart: 52 }} />
      <SupportRow icon="logout" title="Sign out" onPress={() => useCommunity.getState().signOut()} />
      <Divider style={{ marginStart: 52 }} />
      <Pressable onPress={confirmDelete} style={styles.row}>
        <Icon name="trash-can-outline" size={20} color={c.heart} style={{ width: 22 }} />
        <T color={c.heart} style={{ flex: 1 }}>{L('Delete account')}</T>
      </Pressable>
    </View>
  );
}

function SupportRow({ icon, title, onPress }: { icon: string; title: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Icon name={icon as never} size={20} color={c.accent} style={{ width: 22 }} />
      <T style={{ flex: 1 }}>{L(title)}</T>
      <Icon name="chevron-right" size={18} color={c.tertiary} directional />
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T v="footnote" w="semibold" secondary style={{ paddingStart: 16, textTransform: 'uppercase' }}>{L(title)}</T>
      <View style={{ backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

/** A small phone mock-up in each mode, like iOS Display settings. */
function AppearanceTile({ option, title, isOn, onPress }: { option: Appearance; title: string; isOn: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const mock = (dark: boolean) => {
    const p = dark ? palettes.dark : palettes.light;
    const card = dark ? '#1A2614' : '#FCEFD3';
    return (
      <View style={{ flex: 1, backgroundColor: p.canvas, padding: 7, gap: 5 }}>
        <View style={{ height: 30, borderRadius: 3, backgroundColor: card }} />
        <View style={{ width: 30, height: 5, borderRadius: 2, backgroundColor: p.accent }} />
        <View style={{ height: 30, borderRadius: 3, backgroundColor: card }} />
        <View style={{ width: 22, height: 5, borderRadius: 2, backgroundColor: p.accent, opacity: 0.6 }} />
      </View>
    );
  };
  return (
    <Pressable onPress={onPress} style={styles.tile} accessibilityState={{ selected: isOn }}>
      <View style={[styles.preview, { borderColor: isOn ? c.accent : c.line, borderWidth: isOn ? 2.5 : 1 }]}>
        {option === 'system' ? (
          <View style={{ flex: 1, flexDirection: 'row', direction: 'ltr' }}>
            <View style={{ flex: 1, overflow: 'hidden' }}>{mock(false)}</View>
            <View style={{ flex: 1, overflow: 'hidden' }}>{mock(true)}</View>
          </View>
        ) : (
          mock(option === 'dark')
        )}
      </View>
      <T v="subheadline" w="medium">{L(title)}</T>
      <Icon name={isOn ? 'check-circle' : 'circle-outline'} size={22} color={isOn ? c.accent : c.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 20 },
  tiles: { flexDirection: 'row', padding: 16, gap: 12 },
  tile: { flex: 1, alignItems: 'center', gap: 10 },
  preview: { width: 64, height: 110, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
});
