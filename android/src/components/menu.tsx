import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, I18nManager, Modal, Pressable, ScrollView, StyleSheet, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { Icon, IconName, T } from './ui';

export type MenuItem = {
  id: string;
  title: string;
  /** Secondary text at the trailing edge, e.g. a count. */
  detail?: string;
  icon?: IconName;
  selected?: boolean;
  destructive?: boolean;
  /** Opens a second page inside the same card (e.g. report reasons). */
  children?: MenuItem[];
};

const ROW = 48;
const MARGIN = 12;
const GAP = 6;

/**
 * App-styled pop-up menu anchored to its trigger, replacing the system Android menu.
 * The trigger is rendered by `children(open)`, so it decides whether a tap or a long press opens the menu.
 */
export function Menu({ items, title, onSelect, children, width = 264, style }: {
  items: MenuItem[];
  title?: string;
  onSelect: (id: string) => void;
  children: (open: () => void) => React.ReactNode;
  width?: number;
  style?: ViewStyle;
}) {
  const anchor = useRef<View>(null);
  const [frame, setFrame] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const open = () => {
    anchor.current?.measureInWindow((x, y, w, h) => setFrame({ x, y, w, h }));
  };

  return (
    <View ref={anchor} collapsable={false} style={style}>
      {children(open)}
      {frame ? (
        <MenuCard
          frame={frame}
          items={items}
          title={title}
          width={width}
          onClose={() => setFrame(null)}
          onSelect={(id) => {
            setFrame(null);
            onSelect(id);
          }}
        />
      ) : null}
    </View>
  );
}

function MenuCard({ frame, items, title, width, onClose, onSelect }: {
  frame: { x: number; y: number; w: number; h: number };
  items: MenuItem[];
  title?: string;
  width: number;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<MenuItem | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress]);

  const close = (then?: () => void) =>
    Animated.timing(progress, { toValue: 0, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => (then ? then() : onClose()));

  const list = page?.children ?? items;
  const heading = page ? page.title : title;

  // Place the card under the trigger, or above it when there isn't room; keep it on screen.
  const screen = Dimensions.get('window');
  const w = Math.min(width, screen.width - MARGIN * 2);
  const below = screen.height - insets.bottom - (frame.y + frame.h + GAP) - MARGIN;
  const above = frame.y - insets.top - GAP - MARGIN;
  const natural = list.length * ROW + (heading ? 36 : 8) + (page ? ROW : 0);
  const openUp = below < Math.min(natural, 240) && above > below;
  const maxHeight = Math.min(natural, Math.max(160, openUp ? above : below), 440);
  const alignEnd = I18nManager.isRTL ? frame.x + frame.w / 2 < screen.width / 2 : frame.x + frame.w / 2 > screen.width / 2;
  const left = Math.min(
    Math.max(MARGIN, alignEnd ? frame.x + frame.w - w : frame.x),
    screen.width - MARGIN - w,
  );
  const top = openUp ? frame.y - GAP - maxHeight : frame.y + frame.h + GAP;

  // Long lists (the 20 wilayas) open scrolled to the current choice.
  const selectedIndex = list.findIndex((i) => i.selected);
  const startOffset = Math.max(0, selectedIndex * ROW - maxHeight / 2 + ROW);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const shift = progress.interpolate({ inputRange: [0, 1], outputRange: [openUp ? 6 : -6, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => (page ? setPage(null) : close())} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel={L('Close menu')}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#000' : '#1F2A17', opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) }]} />
      </Pressable>
      <Animated.View
        style={[
          styles.card,
          {
            left, top, width: w, maxHeight,
            backgroundColor: c.canvas, borderColor: c.line,
            opacity: progress,
            transform: [{ translateY: shift }, { scale }],
          },
        ]}
        accessibilityViewIsModal
      >
        {heading ? (
          <View style={styles.heading}>
            <T v="footnote" w="semibold" secondary numberOfLines={1}>{heading}</T>
          </View>
        ) : null}
        <ScrollView
          bounces={false}
          contentOffset={{ x: 0, y: page ? 0 : startOffset }}
          showsVerticalScrollIndicator={list.length > 8}
        >
          {page ? (
            <Row icon="chevron-left" title={L('Back')} muted onPress={() => setPage(null)} />
          ) : null}
          {list.map((item, i) => (
            <View key={item.id}>
              {i > 0 || page ? <View style={[styles.divider, { backgroundColor: c.line }]} /> : null}
              <Row
                icon={item.icon}
                title={item.title}
                detail={item.detail}
                selected={item.selected}
                destructive={item.destructive}
                hasChildren={!!item.children?.length}
                onPress={() => (item.children?.length ? setPage(item) : close(() => onSelect(item.id)))}
              />
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function Row({ icon, title, detail, selected, destructive, hasChildren, muted, onPress }: {
  icon?: IconName; title: string; detail?: string; selected?: boolean; destructive?: boolean;
  hasChildren?: boolean; muted?: boolean; onPress: () => void;
}) {
  const { c } = useTheme();
  const tint = destructive ? c.heart : selected ? c.accent : muted ? c.secondary : c.text;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: c.brandSoft }}
      style={({ pressed }) => [styles.row, { backgroundColor: selected ? c.brandSoft : pressed ? c.surface : 'transparent' }]}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: !!selected }}
    >
      {icon ? <Icon name={icon} size={18} color={tint} directional={icon === 'chevron-left'} /> : null}
      <T v="body" w={selected ? 'semibold' : 'regular'} color={tint} numberOfLines={1} style={{ flex: 1 }}>{title}</T>
      {detail ? <T v="subheadline" secondary style={{ fontVariant: ['tabular-nums'] }}>{detail}</T> : null}
      {selected ? <Icon name="check" size={18} color={c.accent} /> : null}
      {hasChildren ? <Icon name="chevron-right" size={18} color={c.tertiary} directional /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  heading: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  row: { minHeight: ROW, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginStart: 16 },
});
