import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
            <Text style={styles.permissionText}>Nevojitet qasje në kamerë për të skanuar kodet QR.</Text>
            <Pressable style={styles.button} onPress={requestPermission}>
              <Text style={styles.buttonText}>Jep leje</Text>
            </Pressable>
          </View>
        )}
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.buttonText}>Mbyll</Text>
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
    gap: 16,
  },
  permissionText: {
    color: '#fff',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
