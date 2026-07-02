import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { GlassView } from './GlassView';
import { ScanMenu } from './ScanMenu';

type BottomNavBarProps = {
  activeScreen: 'dashboard' | 'list';
  onHome: () => void;
  onList: () => void;
  onScanQr: () => void;
  onAddManually: () => void;
  onScanReceipt: () => void;
};

export function BottomNavBar({
  activeScreen,
  onHome,
  onList,
  onScanQr,
  onAddManually,
  onScanReceipt,
}: BottomNavBarProps) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable onPress={onHome}>
        <GlassView style={[styles.sideButton, styles.sideButtonNoBorder, activeScreen === 'dashboard' && styles.sideButtonActive]}>
          <Ionicons name="pie-chart-outline" size={22} color={activeScreen === 'dashboard' ? '#2563eb' : '#1f2937'} />
        </GlassView>
      </Pressable>

      <ScanMenu onScanQr={onScanQr} onAddManually={onAddManually} onScanReceipt={onScanReceipt} />

      <Pressable onPress={onList}>
        <GlassView style={[styles.sideButton, activeScreen === 'list' && styles.sideButtonActive]}>
          <Ionicons name="receipt-outline" size={22} color={activeScreen === 'list' ? '#2563eb' : '#1f2937'} />
        </GlassView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sideButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonNoBorder: {
    borderWidth: 0,
  },
  sideButtonActive: {
    borderColor: 'rgba(37,99,235,0.5)',
  },
});
