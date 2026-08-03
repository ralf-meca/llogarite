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
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';

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
      <View style={styles.fabWrapper} pointerEvents="box-none">
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
          <View style={styles.menuWrapper} pointerEvents="box-none">
            <GlassView style={styles.menu}>
              {MENU_ITEMS.map((item) => (
                <Pressable key={item.key} style={styles.menuItem} onPress={() => handleSelect(item.key)}>
                  <item.icon size={20} color="#1f2937" />
                  <Text style={styles.menuItemText}>{t(item.labelKey)}</Text>
                </Pressable>
              ))}
            </GlassView>
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
    bottom: 32,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
  },
  backdrop: {
    flex: 1,
  },
  menuWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 100,
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
