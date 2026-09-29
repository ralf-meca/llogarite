import {
  ImageIcon,
  PencilSimpleIcon,
  PlusIcon,
  QrCodeIcon,
  ScanIcon,
  XIcon,
  type Icon,
} from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { BOTTOM_NAV_HEIGHT, FAB_BOTTOM_OFFSET, FAB_SIZE, colors } from '../lib/theme';
import { GlassView } from './GlassView';

type ScanMenuProps = {
  onScanQr: () => void;
  onAddManually: () => void;
  onScanReceipt: () => void;
  onUploadFromGallery: () => void;
};

// A soft teardrop rather than a triangle: both curves leave the tip
// horizontally, so the two sides meet in a rounded point instead of a corner.
const TAIL_WIDTH = 30;
const TAIL_HEIGHT = 15;
const TAIL_PATH = 'M0 0 C9.5 0 11.5 13.5 15 13.5 C18.5 13.5 20.5 0 30 0';

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
        <Pressable onPress={() => setIsOpen((prev) => !prev)}>
          <GlassView style={styles.fab}>
            {isOpen ? (
              <XIcon size={28} weight="bold" color="#fff" />
            ) : (
              <PlusIcon size={28} weight="bold" color="#fff" />
            )}
          </GlassView>
        </Pressable>
      </View>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={[styles.menuWrapper, { paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + 44 }]} pointerEvents="box-none">
            <View style={styles.bubble}>
              <GlassView style={styles.menu}>
                {MENU_ITEMS.map((item) => (
                  <Pressable key={item.key} style={styles.menuItem} onPress={() => handleSelect(item.key)}>
                    <item.icon size={20} color="#1f2937" />
                    <Text style={styles.menuItemText}>{t(item.labelKey)}</Text>
                  </Pressable>
                ))}
              </GlassView>
              {/* Drawn outside the GlassView because that clips its children, and
                  filled before it is outlined so only the two sloping sides carry
                  the border - a stroke on the closed path would draw one across
                  the top, where the tail joins the menu. */}
              <Svg width={TAIL_WIDTH} height={TAIL_HEIGHT} style={styles.tail} pointerEvents="none">
                <Path d={`${TAIL_PATH} Z`} fill={colors.white} />
                <Path d={TAIL_PATH} stroke={colors.border} strokeWidth={1} fill="none" />
              </Svg>
            </View>
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
  // Pulled up a pixel so the menu's own bottom border does not draw a line
  // across the top of the tail; the two should read as one shape.
  tail: {
    marginTop: -1,
  },
  menu: {
    minWidth: 220,
    paddingVertical: 8,
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
