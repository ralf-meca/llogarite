import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassView } from './GlassView';

type ScanMenuProps = {
  onScanQr: () => void;
  onAddManually: () => void;
  onScanReceipt: () => void;
};

const MENU_ITEMS = [
  { key: 'qr', icon: 'qr-code-outline', label: 'Skano kodin QR' },
  { key: 'receipt', icon: 'scan-outline', label: 'Skano faturën' },
  { key: 'manual', icon: 'create-outline', label: 'Shto manualisht' },
] as const;

export function ScanMenu({ onScanQr, onAddManually, onScanReceipt }: ScanMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (key: (typeof MENU_ITEMS)[number]['key']) => {
    setIsOpen(false);
    if (key === 'qr') {
      onScanQr();
    } else if (key === 'manual') {
      onAddManually();
    } else {
      onScanReceipt();
    }
  };

  return (
    <>
      <View style={styles.fabWrapper} pointerEvents="box-none">
        <Pressable onPress={() => setIsOpen((prev) => !prev)}>
          <GlassView style={styles.fab}>
            <Ionicons name={isOpen ? 'close' : 'add'} size={28} color="#fff" />
          </GlassView>
        </Pressable>
      </View>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.menuWrapper} pointerEvents="box-none">
            <GlassView style={styles.menu} intensity={100}>
              {MENU_ITEMS.map((item) => (
                <Pressable key={item.key} style={styles.menuItem} onPress={() => handleSelect(item.key)}>
                  <Ionicons name={item.icon} size={20} color="#1f2937" />
                  <Text style={styles.menuItemText}>{item.label}</Text>
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
    backgroundColor: 'rgba(37,99,235,0.55)',
    borderColor: 'rgba(255,255,255,0.5)',
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
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    boxShadow: '0px 6px 16px rgba(0,0,0,0.2)',
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
    color: '#1f2937',
  },
});
