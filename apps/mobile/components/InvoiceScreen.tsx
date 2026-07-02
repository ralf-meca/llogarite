import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { VerificationState } from '../App';
import { GlassButton } from './GlassButton';
import { GlassView } from './GlassView';
import { InvoiceReceipt } from './InvoiceReceipt';

type InvoiceScreenProps = {
  verification: VerificationState;
  isSaving?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  isDeleting?: boolean;
  onDelete?: () => void;
};

export function InvoiceScreen({
  verification,
  isSaving,
  onClose,
  onConfirm,
  isDeleting,
  onDelete,
}: InvoiceScreenProps) {
  return (
    <View style={styles.container}>
      <Pressable onPress={onClose} style={styles.closeButtonWrapper}>
        <GlassView style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </GlassView>
      </Pressable>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {verification.status === 'invalid' && (
          <Text style={styles.errorText}>Nuk u lexuan dot të dhënat e faturës nga ky kod QR.</Text>
        )}
        {verification.status === 'loading' && <Text>Duke verifikuar faturën...</Text>}
        {verification.status === 'error' && (
          <Text style={styles.errorText}>Verifikimi dështoi: {verification.message}</Text>
        )}
        {verification.status === 'success' && <InvoiceReceipt result={verification.data} />}
      </ScrollView>

      {verification.status === 'success' && (onConfirm || onDelete) && (
        <View style={styles.footer}>
          {onConfirm && (
            <GlassButton
              label={isSaving ? 'Duke ruajtur...' : 'Konfirmo'}
              variant="accent"
              onPress={onConfirm}
              disabled={isSaving}
            />
          )}
          {onDelete && (
            <GlassButton
              label={isDeleting ? 'Duke fshirë...' : 'Fshi'}
              variant="danger"
              style={styles.deleteButton}
              onPress={onDelete}
              disabled={isDeleting}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButtonWrapper: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginRight: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  deleteButton: {
    marginTop: 12,
  },
});
