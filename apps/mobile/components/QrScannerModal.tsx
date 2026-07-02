import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassButton } from './GlassButton';
import { GlassView } from './GlassView';

type QrScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
};

export function QrScannerModal({ visible, onClose, onScanned }: QrScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);

  const handleShow = () => {
    setHasScanned(false);
  };

  const handleBarcodeScanned = (result: { data: string }) => {
    if (hasScanned) {
      return;
    }
    setHasScanned(true);
    onScanned(result.data);
  };

  return (
    <Modal visible={visible} animationType="slide" onShow={handleShow} onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        ) : (
          <View style={styles.permissionContainer}>
            <GlassView tint="dark" style={styles.permissionCard}>
              <Text style={styles.permissionText}>Nevojitet qasje në kamerë për të skanuar kodet QR.</Text>
              <GlassButton label="Jep leje" variant="accent" onPress={requestPermission} />
            </GlassView>
          </View>
        )}
        <Pressable onPress={onClose} style={styles.closeButtonWrapper}>
          <GlassView tint="dark" style={styles.closeButton}>
            <Text style={styles.buttonText}>Mbyll</Text>
          </GlassView>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionCard: {
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  permissionText: {
    color: '#fff',
    textAlign: 'center',
  },
  closeButtonWrapper: {
    position: 'absolute',
    top: 48,
    right: 24,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
