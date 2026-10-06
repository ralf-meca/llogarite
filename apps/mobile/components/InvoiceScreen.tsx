import { ArrowLeftIcon, PencilSimpleIcon } from 'phosphor-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { VerificationState } from '../App';
import { useTranslation } from '../lib/i18n';
import type { InvoiceItem } from '../lib/invoiceApi';
import { colors, radius } from '../lib/theme';
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
  // Passed through to the receipt: who entered the invoice, and whether that
  // is the person looking at it.
  owner?: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
  ownerIsViewer?: boolean;
  onMarkOwnerPaid?: () => void;
  isMarkingOwnerPaid?: boolean;
  viewerId?: string;
  onMarkBuddyPaid?: (buddyUserId: string) => void;
  markingBuddyId?: string | null;
  onNotifyPaid?: () => void;
  isNotifyingPaid?: boolean;
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
  owner,
  ownerIsViewer,
  onMarkOwnerPaid,
  isMarkingOwnerPaid,
  viewerId,
  onMarkBuddyPaid,
  markingBuddyId,
  onNotifyPaid,
  isNotifyingPaid,
}: InvoiceScreenProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {onEdit ? (
        <View style={styles.headerRow}>
          <Pressable onPress={onClose} style={styles.iconButtonShadow}>
            <GlassView style={[styles.iconButton, styles.backButton]}>
              <ArrowLeftIcon size={18} color="#9ca3af" />
            </GlassView>
          </Pressable>
          <Pressable onPress={onEdit} style={styles.iconButtonShadow}>
            <GlassView style={styles.iconButton}>
              <PencilSimpleIcon size={18} color="#111827" />
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

      {/* The wait for the tax authority's answer, which can run to several seconds:
          centred, with something moving, so it reads as work under way. */}
      {verification.status === 'loading' && (
        <View style={styles.verifying}>
          <View style={styles.verifyingCard}>
            <View style={styles.verifyingSpinner}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
            <Text style={styles.verifyingTitle}>{t('invoice.verifying')}</Text>
            <Text style={styles.verifyingDetail}>{t('invoice.verifyingDetail')}</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={[styles.scroll, verification.status === 'loading' && styles.hidden]}
        contentContainerStyle={styles.scrollContent}
      >
        {verification.status === 'invalid' && (
          <Text style={styles.errorText}>{t('invoice.invalidQr')}</Text>
        )}
        {verification.status === 'error' && (
          <Text style={styles.errorText}>{t('invoice.verificationFailed', { message: verification.message })}</Text>
        )}
        {verification.status === 'success' && (
          <InvoiceReceipt
            result={verification.data}
            owner={owner}
            ownerIsViewer={ownerIsViewer}
            onMarkOwnerPaid={onMarkOwnerPaid}
            isMarkingOwnerPaid={isMarkingOwnerPaid}
            viewerId={viewerId}
            onMarkBuddyPaid={onMarkBuddyPaid}
            markingBuddyId={markingBuddyId}
            onNotifyPaid={onNotifyPaid}
            isNotifyingPaid={isNotifyingPaid}
            onSelectItem={onSelectItem}
          />
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
  hidden: {
    display: 'none',
  },
  verifying: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  verifyingCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: radius.sheet,
    backgroundColor: colors.white,
  },
  verifyingSpinner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: colors.primaryTint,
  },
  verifyingTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textDark,
    marginBottom: 8,
  },
  verifyingDetail: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textMuted,
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
