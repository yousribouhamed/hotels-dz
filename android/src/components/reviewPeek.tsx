import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { L } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { Icon, T } from './ui';

/** Lines that fit a 170pt carousel card: Arabic script sets taller lines than Latin. */
export const cardLines = (text: string, latin = 5) => (/[؀-ۿ]/.test(text) ? latin - 1 : latin);

/**
 * Long-press a review card to read the whole review lifted over a dimmed screen, with Copy below,
 * like the iOS context-menu preview. Cards in the carousel cut long reviews short.
 */
export function LongPressReview({ text, header, children }: {
  text: string; header: React.ReactNode; children: React.ReactNode;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Pressable onLongPress={() => setOpen(true)} delayLongPress={400} accessibilityHint={L('Long press to read the whole review')}>
        {children}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={L('Close')}>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {header}
            <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
              <T>{text}</T>
            </ScrollView>
          </View>
          <View style={[styles.menu, { backgroundColor: c.surface }]}>
            <Pressable
              onPress={() => { Clipboard.setStringAsync(text); close(); }}
              style={({ pressed }) => [styles.menuRow, pressed ? { backgroundColor: c.line + '66' } : null]}
            >
              <T w="medium">{L('Copy review')}</T>
              <Icon name="content-copy" size={18} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20, gap: 10 },
  card: { width: '100%', maxWidth: 380, maxHeight: '70%', borderRadius: 16, padding: 20, gap: 12, elevation: 12 },
  menu: { width: '100%', maxWidth: 380, borderRadius: 14, overflow: 'hidden', elevation: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 48 },
});
