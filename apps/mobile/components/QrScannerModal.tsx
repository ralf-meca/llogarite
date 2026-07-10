import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useTranslation } from '../lib/i18n';
import { GlassButton } from './GlassButton';
import { GlassView } from './GlassView';

type QrScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
};

const FRAME_SIZE = 260;
const FRAME_RADIUS = 24;

export function QrScannerModal({ visible, onClose, onScanned }: QrScannerModalProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);
  const { width, height } = Dimensions.get('window');
  const frameLeft = (width - FRAME_SIZE) / 2;
  const frameTop = (height - FRAME_SIZE) / 2;

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
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <Defs>
                <Mask id="scanMask">
                  <Rect x={0} y={0} width={width} height={height} fill="white" />
                  <Rect
                    x={frameLeft}
                    y={frameTop}
                    width={FRAME_SIZE}
                    height={FRAME_SIZE}
                    rx={FRAME_RADIUS}
                    fill="black"
                  />
                </Mask>
              </Defs>
              <Rect x={0} y={0} width={width} height={height} fill="rgba(0,0,0,0.5)" mask="url(#scanMask)" />
            </Svg>
            <View
              pointerEvents="none"
              style={[styles.frame, { left: frameLeft, top: frameTop }]}
            />
          </>
        ) : (
          <View style={styles.permissionContainer}>
            <GlassView tint="dark" style={styles.permissionCard}>
              <Text style={styles.permissionText}>{t('qrScanner.cameraPermission')}</Text>
              <GlassButton label={t('common.grantPermission')} variant="accent" onPress={requestPermission} />
            </GlassView>
          </View>
        )}
        <Pressable onPress={onClose} style={styles.closeButtonWrapper}>
          <GlassView tint="dark" style={styles.closeButton}>
            <Text style={styles.buttonText}>{t('common.close')}</Text>
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
  frame: {
    position: 'absolute',
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: FRAME_RADIUS,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
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
