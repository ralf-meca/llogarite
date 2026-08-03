import { ArrowLeftIcon, CheckCircleIcon } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buddyInvoiceShares, unpaidTotal, type BuddyInvoiceShare } from '../lib/buddyExpenses';
import { toDateLabel } from '../lib/date';
import { formatAmount } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import { setBuddyPaid, type SavedInvoice } from '../lib/savedInvoicesApi';
import { colors, radius } from '../lib/theme';
import { GlassView } from './GlassView';

type BuddyDetailScreenProps = {
  buddyId: string;
  buddyName: string;
  invoices: SavedInvoice[];
  onBack: () => void;
  onSelectInvoice: (invoiceId: string) => void;
  onInvoicesChanged: () => void;
};

export function BuddyDetailScreen({
  buddyId,
  buddyName,
  invoices,
  onBack,
  onSelectInvoice,
  onInvoicesChanged,
}: BuddyDetailScreenProps) {
  const { t } = useTranslation();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const shares = useMemo(() => buddyInvoiceShares(invoices, buddyId), [invoices, buddyId]);
  const unpaidShares = shares.filter((share) => !share.paid);
  const total = unpaidTotal(shares);

  const handleMarkPaid = (share: BuddyInvoiceShare) => {
    Alert.alert(t('buddyDetail.confirmMarkPaidTitle'), t('buddyDetail.confirmMarkPaidMessage', { seller: share.sellerName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: () => {
          setMarkingId(share.invoiceId);
          setBuddyPaid(share.invoiceId, buddyId, true)
            .then(() => {
              setMarkingId(null);
              onInvoicesChanged();
            })
            .catch((error: Error) => {
              setMarkingId(null);
              Alert.alert(t('buddyDetail.markPaidErrorTitle'), error.message);
            });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
          <ArrowLeftIcon size={22} color="#1f2937" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {buddyName}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GlassView style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('buddyDetail.totalUnpaid')}</Text>
          <Text style={styles.totalValue}>{formatAmount(total)}</Text>
        </GlassView>

        <Text style={styles.sectionTitle}>{t('buddyDetail.unpaidInvoices')}</Text>
        {unpaidShares.length === 0 && <Text style={styles.emptyText}>{t('buddyDetail.noUnpaidInvoices')}</Text>}
        {unpaidShares.map((share) => {
          const isMarking = markingId === share.invoiceId;
          return (
            <GlassView key={share.invoiceId} style={styles.row}>
              <Pressable style={styles.rowLeft} onPress={() => onSelectInvoice(share.invoiceId)}>
                <Text style={styles.rowSeller} numberOfLines={1}>
                  {share.sellerName}
                </Text>
                <Text style={styles.rowDate}>
                  {toDateLabel(new Date(share.dateTimeCreated))}
                </Text>
              </Pressable>
              <View style={styles.rowRight}>
                <Pressable onPress={() => onSelectInvoice(share.invoiceId)}>
                  <Text style={styles.rowShare}>{formatAmount(share.share)}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.markPaidButton, pressed && styles.markPaidButtonPressed]}
                  onPress={() => handleMarkPaid(share)}
                  disabled={isMarking}
                >
                  <CheckCircleIcon size={13} weight="fill" color={colors.primary} />
                  <Text style={styles.markPaidButtonText}>
                    {isMarking ? t('common.saving') : t('buddyDetail.markPaid')}
                  </Text>
                </Pressable>
              </View>
            </GlassView>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 24,
    marginTop: 8,
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  scroll: {
    flex: 1,
    marginTop: 16,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    gap: 12,
  },
  totalCard: {
    padding: 20,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  totalValue: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '700',
    color: '#dc2626',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  rowLeft: {
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowSeller: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  rowDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  rowShare: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  markPaidButtonPressed: {
    opacity: 0.6,
  },
  markPaidButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
});
