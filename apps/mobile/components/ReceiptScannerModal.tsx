import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassButton } from './GlassButton';
import { GlassView } from './GlassView';

type ReceiptScannerModalProps = {
  visible: boolean;
  isProcessing: boolean;
  onClose: () => void;
  onCaptured: (photoUri: string) => void;
};

export function ReceiptScannerModal({ visible, isProcessing, onClose, onCaptured }: ReceiptScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) {
      return;
    }
    const photo = await cameraRef.current.takePictureAsync({ quality: 1, shutterSound: false });
    if (photo?.uri) {
      onCaptured(photo.uri);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />
            <View style={styles.instructionWrapper} pointerEvents="none">
              <GlassView tint="dark" style={styles.instructionCard}>
                <Text style={styles.instructionText}>Fotografo faturën e plotë, qartë dhe pa hije.</Text>
              </GlassView>
            </View>
            <View style={styles.footer}>
              {isProcessing ? (
                <GlassView tint="dark" style={styles.processingCard}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.processingText}>Duke lexuar faturën...</Text>
                </GlassView>
              ) : (
                <Pressable onPress={handleCapture} style={styles.captureButtonWrapper}>
                  <View style={styles.captureButton} />
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <View style={styles.permissionContainer}>
            <GlassView tint="dark" style={styles.permissionCard}>
              <Text style={styles.permissionText}>Nevojitet qasje në kamerë për të fotografuar faturën.</Text>
              <GlassButton label="Jep leje" variant="accent" onPress={requestPermission} />
            </GlassView>
          </View>
        )}
        <Pressable onPress={onClose} style={styles.closeButtonWrapper} disabled={isProcessing}>
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
  instructionWrapper: {
    position: 'absolute',
    top: 100,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  instructionCard: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  instructionText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButtonWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  processingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  processingText: {
    color: '#fff',
    fontWeight: '600',
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
