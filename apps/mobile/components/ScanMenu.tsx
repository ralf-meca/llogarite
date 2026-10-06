import {
  ImageIcon,
  PencilSimpleIcon,
  PlusIcon,
  QrCodeIcon,
  ScanIcon,
  type Icon,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { BOTTOM_NAV_HEIGHT, FAB_BOTTOM_OFFSET, FAB_SIZE, colors } from '../lib/theme';
import { GlassView } from './GlassView';
import { PopoverTail } from './PopoverTail';

type ScanMenuProps = {
  onScanQr: () => void;
  onAddManually: () => void;
  onScanReceipt: () => void;
  onUploadFromGallery: () => void;
};

const MENU_ITEMS: { key: 'qr' | 'receipt' | 'gallery' | 'manual'; icon: Icon; labelKey: TranslationKey }[] = [
  { key: 'qr', icon: QrCodeIcon, labelKey: 'scanMenu.scanQr' },
  { key: 'receipt', icon: ScanIcon, labelKey: 'scanMenu.scanReceipt' },
  { key: 'gallery', icon: ImageIcon, labelKey: 'scanMenu.uploadFromGallery' },
  { key: 'manual', icon: PencilSimpleIcon, labelKey: 'scanMenu.addManually' },
];

export function ScanMenu({ onScanQr, onAddManually, onScanReceipt, onUploadFromGallery }: ScanMenuProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);

  // 0 closed, 1 open. Turns the plus into a cross and brings the menu up out of
  // the button, both on a spring so the button feels pressed rather than switched.
  const openProgress = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(openProgress, {
      toValue: isOpen ? 1 : 0,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [isOpen, openProgress]);

  const pressTo = (toValue: number) =>
    Animated.spring(pressScale, { toValue, friction: 4, tension: 220, useNativeDriver: true }).start();

  const iconRotation = openProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] });
  const menuStyle = {
    opacity: openProgress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: openProgress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
      { scale: openProgress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
    ],
  };

  const handleSelect = (key: (typeof MENU_ITEMS)[number]['key']) => {
    setIsOpen(false);
    if (key === 'qr') {
      onScanQr();
    } else if (key === 'manual') {
      onAddManually();
    } else if (key === 'gallery') {
      onUploadFromGallery();
    } else {
      onScanReceipt();
    }
  };

  return (
    <>
      <View style={[styles.fabWrapper, { bottom: FAB_BOTTOM_OFFSET + insets.bottom }]} pointerEvents="box-none">
        <Pressable
          onPress={() => setIsOpen((prev) => !prev)}
          onPressIn={() => pressTo(0.88)}
          onPressOut={() => pressTo(1)}
        >
          <Animated.View style={{ transform: [{ scale: pressScale }] }}>
            <GlassView style={styles.fab}>
              {/* The same plus, turned until it reads as a cross. */}
              <Animated.View style={{ transform: [{ rotate: iconRotation }] }}>
                <PlusIcon size={28} weight="bold" color="#fff" />
              </Animated.View>
            </GlassView>
          </Animated.View>
        </Pressable>
      </View>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={[styles.menuWrapper, { paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + 44 }]} pointerEvents="box-none">
            <Animated.View style={[styles.bubble, menuStyle]}>
              <GlassView style={styles.menu}>
                {MENU_ITEMS.map((item) => (
                  <Pressable key={item.key} style={styles.menuItem} onPress={() => handleSelect(item.key)}>
                    <item.icon size={20} color="#1f2937" />
                    <Text style={styles.menuItemText}>{t(item.labelKey)}</Text>
                  </Pressable>
                ))}
              </GlassView>
              {/* Outside the GlassView, which clips its children. */}
              <PopoverTail style={styles.tail} />
            </Animated.View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: FAB_BOTTOM_OFFSET,
    alignItems: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
  },
  // Same scrim the More menu uses, so the two bottom-bar popups dim the page
  // the same way rather than one of them floating over an undimmed screen.
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  menuWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: BOTTOM_NAV_HEIGHT + 44,
  },
  bubble: {
    alignItems: 'center',
  },
  // Overlapped a pixel so no hairline shows between the two white shapes.
  tail: {
    marginTop: -1,
  },
  menu: {
    minWidth: 220,
    paddingVertical: 8,
    // No border: the tail cannot carry one around its curve without the join
    // showing, so the menu goes without too and the scrim does the separating.
    borderWidth: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
});
