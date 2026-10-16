import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Modal, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { Icon, T } from './ui';

/**
 * Tall bottom sheet in the app's style: dimmed backdrop, rounded top, grabber, title and close button.
 * Closes with the button, the backdrop, Android's back gesture, or by dragging the header down.
 */
export function BottomSheet({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      // Close the keyboard first, or Android hands focus to the screen's own search field.
      Keyboard.dismiss();
      Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => finished && setMounted(false));
    }
  }, [visible, progress, drag]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 1) closeRef.current();
        else Animated.spring(drag, { toValue: 0, bounciness: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const translateY = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [screen, 0] }), drag);

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)', opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={L('Close')} />
      </Animated.View>
      {/* Pinned to the top gap rather than a fixed height, so it shrinks above the keyboard. */}
      <Animated.View
        style={[styles.sheet, { top: insets.top + 48, backgroundColor: c.canvas, paddingBottom: insets.bottom, transform: [{ translateY }] }]}
      >
        <View {...pan.panHandlers}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <View style={styles.header}>
            <T v="title3" w="bold" style={{ flex: 1 }} accessibilityRole="header">{title}</T>
            <Pressable onPress={onClose} hitSlop={8} style={[styles.close, { backgroundColor: c.surface }]} accessibilityLabel={L('Close')}>
              <Icon name="close" size={18} />
            </Pressable>
          </View>
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
