import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L, LF, isArabic } from '../../lib/i18n';
import { hotelById } from '../../lib/model';
import { reviewErrorMessage, useCommunity, useMyReview } from '../../lib/community';
import { useTheme } from '../../lib/theme';
import { T, font } from '../../components/ui';
import { ReviewerAvatar, StarPicker, starLabels } from '../../components/reviews';

const MIN_LENGTH = 20;
const MAX_LENGTH = 2000;

/** Write a review, or edit yours. Opened as a sheet from the stay page. */
export default function WriteReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hotel = hotelById.get(Number(id));
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const mine = useMyReview(Number(id));
  const displayName = useCommunity((s) => s.displayName) || L('Guest');
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [text, setText] = useState(mine?.body ?? '');
  const [posting, setPosting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const count = text.trim().length;
  const canPost = rating > 0 && count >= MIN_LENGTH && count <= MAX_LENGTH && !posting;
  const isEditing = mine != null;

  // Ask before throwing away a half-written review.
  const close = () => {
    if (!text.trim() || text === mine?.body) return router.back();
    Alert.alert(L('Write a review'), L('Discard your review?'), [
      { text: L('Keep writing'), style: 'cancel' },
      { text: L('Discard'), style: 'destructive', onPress: () => router.back() },
    ]);
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  });

  if (!hotel) return null;

  const post = async () => {
    setPosting(true);
    try {
      await useCommunity.getState().submit(hotel.id, rating, text);
      router.back();
    } catch (e) {
      setPosting(false);
      Alert.alert(L('Couldn’t post'), reviewErrorMessage(e));
    }
  };

  const saveName = async () => {
    setRenaming(false);
    try {
      await useCommunity.getState().rename(newName);
    } catch {
      Alert.alert(L('Something went wrong. Try again.'));
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.canvas }}>
      <View style={styles.grabberWrap}><View style={[styles.grabber, { backgroundColor: c.tertiary }]} /></View>
      <View style={styles.header}>
        <Pressable onPress={close} style={[styles.headerButton, { backgroundColor: c.surface }]}>
          <T color={c.accent}>{L('Cancel')}</T>
        </Pressable>
        <T v="headline">{isEditing ? L('Edit your review') : L('Write a review')}</T>
        <Pressable
          onPress={post}
          disabled={!canPost}
          style={[styles.headerButton, { backgroundColor: canPost ? c.accent : c.surface, opacity: canPost || posting ? 1 : 0.5 }]}
        >
          {posting ? <ActivityIndicator color={c.accent} /> : (
            <T w="semibold" color={canPost ? c.onAccent : c.secondary}>{isEditing ? L('Save') : L('Post')}</T>
          )}
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 24 + insets.bottom }}>
        <View style={{ gap: 2 }}>
          <T v="headline" numberOfLines={2}>{hotel.name}</T>
          <T v="subheadline" secondary>{L(hotel.city)}</T>
        </View>

        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <T v="title3" w="bold" center>{L('How was your stay?')}</T>
          <StarPicker rating={rating} onChange={setRating} />
          <T v="subheadline" w="medium" secondary={rating === 0} center>
            {rating === 0 ? L('Tap a star to rate') : L(starLabels[rating - 1])}
          </T>
        </View>

        <View style={{ gap: 8 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            multiline
            maxLength={MAX_LENGTH + 200}
            placeholder={L('Tell other guests about the rooms, cleanliness, staff and location.')}
            placeholderTextColor={c.tertiary}
            textAlignVertical="top"
            style={[
              font('body'),
              styles.input,
              {
                color: c.text,
                backgroundColor: c.surface,
                borderColor: focused ? c.accent : c.line,
                borderWidth: focused ? 1.5 : 1,
                textAlign: isArabic() ? 'right' : 'left',
              },
            ]}
          />
          <View style={styles.counter}>
            <T v="caption" secondary>{count < MIN_LENGTH ? LF('At least %d characters', MIN_LENGTH) : ''}</T>
            <T v="caption" color={count > MAX_LENGTH ? c.heart : c.secondary}>{`${count}/${MAX_LENGTH}`}</T>
          </View>
        </View>

        {renaming ? (
          <View style={styles.nameRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              autoFocus
              maxLength={40}
              placeholder={L('Your name')}
              placeholderTextColor={c.tertiary}
              onSubmitEditing={saveName}
              style={[font('body'), styles.nameInput, { color: c.text, backgroundColor: c.surface, borderColor: c.line }]}
            />
            <Pressable onPress={saveName} hitSlop={8}>
              <T v="subheadline" w="semibold" color={c.accent}>{L('Save')}</T>
            </Pressable>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <ReviewerAvatar name={displayName} size={36} />
            <T v="subheadline" numberOfLines={1} style={{ flex: 1 }}>{LF('Posting as %@', displayName)}</T>
            <Pressable onPress={() => { setNewName(useCommunity.getState().displayName); setRenaming(true); }} hitSlop={8}>
              <T v="subheadline" w="semibold" color={c.accent}>{L('Change name')}</T>
            </Pressable>
          </View>
        )}

        <View style={{ gap: 6 }}>
          <T v="footnote" secondary>
            {L('Reviews are public. Don’t share phone numbers or personal details. By posting you agree to the community guidelines.')}
          </T>
          <Pressable onPress={() => router.push('/guidelines')} hitSlop={6}>
            <T v="footnote" w="semibold" color={c.accent}>{L('Community guidelines')}</T>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  grabberWrap: { alignItems: 'center', paddingTop: 8 },
  grabber: { width: 36, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerButton: { paddingHorizontal: 16, height: 40, minWidth: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 190, borderRadius: 14, padding: 14 },
  counter: { flexDirection: 'row', justifyContent: 'space-between' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  nameInput: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
});
