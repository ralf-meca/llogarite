import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { VerificationState } from '../App';
import { useTranslation } from '../lib/i18n';
import type { InvoiceItem } from '../lib/invoiceApi';
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
  onEdit?: () => void;
  onSelectItem?: (item: InvoiceItem) => void;
};

export function InvoiceScreen({
  verification,
  isSaving,
  onClose,
  onConfirm,
  isDeleting,
  onDelete,
  onEdit,
  onSelectItem,
}: InvoiceScreenProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {onEdit ? (
        <View style={styles.headerRow}>
          <Pressable onPress={onClose} style={styles.iconButtonShadow}>
            <GlassView style={[styles.iconButton, styles.backButton]}>
              <Ionicons name="arrow-back" size={18} color="#9ca3af" />
            </GlassView>
          </Pressable>
          <Pressable onPress={onEdit} style={styles.iconButtonShadow}>
            <GlassView style={styles.iconButton}>
              <Ionicons name="create-outline" size={18} color="#111827" />
            </GlassView>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onClose} style={[styles.closeButtonWrapper, styles.iconButtonShadow]}>
          <GlassView style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </GlassView>
        </Pressable>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {verification.status === 'invalid' && (
          <Text style={styles.errorText}>{t('invoice.invalidQr')}</Text>
        )}
        {verification.status === 'loading' && <Text>{t('invoice.verifying')}</Text>}
        {verification.status === 'error' && (
          <Text style={styles.errorText}>{t('invoice.verificationFailed', { message: verification.message })}</Text>
        )}
        {verification.status === 'success' && (
          <InvoiceReceipt result={verification.data} onSelectItem={onSelectItem} />
        )}
      </ScrollView>

      {verification.status === 'success' && (onConfirm || onDelete) && (
        <View style={styles.footer}>
          {onConfirm && (
            <GlassButton
              label={isSaving ? t('common.saving') : t('common.confirm')}
              variant="accent"
              onPress={onConfirm}
              disabled={isSaving}
            />
          )}
          {onDelete && (
            <GlassButton
              label={isDeleting ? t('common.deleting') : t('common.delete')}
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
    marginBottom: 20,
    marginRight: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 20,
    marginHorizontal: 16,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    width: 52,
  },
  iconButtonShadow: {
    borderRadius: 18,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.15)',
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
