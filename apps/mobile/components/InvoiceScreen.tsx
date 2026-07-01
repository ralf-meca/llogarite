import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { VerificationState } from '../App';
import { InvoiceReceipt } from './InvoiceReceipt';

type InvoiceScreenProps = {
  verification: VerificationState;
  isSaving?: boolean;
  saveError?: string | null;
  onClose: () => void;
  onConfirm?: () => void;
  isDeleting?: boolean;
  deleteError?: string | null;
  onDelete?: () => void;
};

export function InvoiceScreen({
  verification,
  isSaving,
  saveError,
  onClose,
  onConfirm,
  isDeleting,
  deleteError,
  onDelete,
}: InvoiceScreenProps) {
  return (
    <View style={styles.container}>
      <Pressable style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>✕</Text>
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
          {saveError && <Text style={styles.errorText}>{saveError}</Text>}
          {deleteError && <Text style={styles.errorText}>{deleteError}</Text>}
          {onConfirm && (
            <Pressable style={styles.confirmButton} onPress={onConfirm} disabled={isSaving}>
              <Text style={styles.confirmButtonText}>{isSaving ? 'Duke ruajtur...' : 'Konfirmo'}</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable style={styles.deleteButton} onPress={onDelete} disabled={isDeleting}>
              <Text style={styles.deleteButtonText}>{isDeleting ? 'Duke fshirë...' : 'Fshi'}</Text>
            </Pressable>
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
  closeButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginRight: 16,
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
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
  confirmButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 16,
  },
});
