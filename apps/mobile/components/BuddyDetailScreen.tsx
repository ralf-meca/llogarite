import { ArrowLeftIcon, ArrowsLeftRightIcon, CheckCircleIcon, PaperPlaneTiltIcon } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  buddyInvoiceShares,
  owedByMeShares,
  unpaidTotal,
  type BuddyInvoiceShare,
  type OwedShare,
} from '../lib/buddyExpenses';
import { settleWithBuddy } from '../lib/buddiesApi';
import { toDateLabel } from '../lib/date';
import { formatAmount } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import {
  fetchOwedInvoices,
  notifyInvoicePaid,
  setBuddyPaid,
  type OwedInvoice,
  type SavedInvoice,
} from '../lib/savedInvoicesApi';
import { colors, radius } from '../lib/theme';
import { GlassView } from './GlassView';

type BuddyDetailScreenProps = {
  buddyId: string;
  buddyName: string;
  // The signed-in user, to find the buddy's invoices this user owes on.
  userId: string;
  invoices: SavedInvoice[];
  onBack: () => void;
  onSelectInvoice: (invoiceId: string) => void;
  // Opens one of the buddy's own invoices, which this user only shares.
  onSelectOwedInvoice: (invoice: OwedInvoice) => void;
  onInvoicesChanged: () => void;
};

export function BuddyDetailScreen({
  buddyId,
  buddyName,
  userId,
  invoices,
  onBack,
  onSelectInvoice,
  onSelectOwedInvoice,
  onInvoicesChanged,
}: BuddyDetailScreenProps) {
  const { t } = useTranslation();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  // What this buddy owes me, from my own invoices...
  const shares = useMemo(() => buddyInvoiceShares(invoices, buddyId), [invoices, buddyId]);
  const unpaidShares = shares.filter((share) => !share.paid);
  const total = unpaidTotal(shares);

  // ...and what I owe them, from theirs. Only these were missing before: a
  // buddy who had put me on one of their invoices showed up here with nothing,
  // even though the buddies list and the notification both pointed here.
  const [owedInvoices, setOwedInvoices] = useState<OwedInvoice[]>([]);
  const loadOwed = () => {
    fetchOwedInvoices()
      .then(setOwedInvoices)
      .catch(() => setOwedInvoices([]));
  };
  useEffect(loadOwed, []);
  const owedShares = useMemo(
    () => owedByMeShares(owedInvoices, userId).filter((share) => share.ownerId === buddyId && !share.paid),
    [owedInvoices, userId, buddyId],
  );
  const owedTotal = owedShares.reduce((sum, share) => sum + share.share, 0);

  // With debts running both ways, the smaller total can come off both sides
  // at once, leaving one person owing only the difference.
  const [isSettling, setIsSettling] = useState(false);
  const canSettle = total > 0.005 && owedTotal > 0.005;
  const handleSettle = () => {
    const offset = Math.min(total, owedTotal);
    const difference = total - owedTotal;
    const outcome =
      Math.abs(difference) <= 0.005
        ? t('buddyDetail.settleOutcomeEven')
        : difference > 0
          ? t('buddyDetail.settleOutcomeTheyOwe', { name: buddyName, amount: formatAmount(difference) })
          : t('buddyDetail.settleOutcomeIOwe', { name: buddyName, amount: formatAmount(-difference) });
    Alert.alert(
      t('buddyDetail.settleTitle'),
      t('buddyDetail.settleMessage', { amount: formatAmount(offset), outcome }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            setIsSettling(true);
            settleWithBuddy(buddyId)
              .then(() => {
                setIsSettling(false);
                // Both lists changed: mine through the parent, theirs here.
                onInvoicesChanged();
                loadOwed();
                Alert.alert(t('buddyDetail.settleDone'));
              })
              .catch((error: Error) => {
                setIsSettling(false);
                Alert.alert(t('buddyDetail.settleErrorTitle'), error.message);
              });
          },
        },
      ],
    );
  };

  const openOwed = (share: OwedShare) => {
    const invoice = owedInvoices.find((candidate) => candidate.id === share.invoiceId);
    if (invoice) {
      onSelectOwedInvoice(invoice);
    }
  };

  // Only the owner can mark a share paid; the person who owes can tell them
  // it has been, which reaches the owner as a notification.
  const handleNotifyPaid = (share: OwedShare) => {
    setNotifyingId(share.invoiceId);
    notifyInvoicePaid(share.invoiceId)
      .then(() => {
        setNotifyingId(null);
        Alert.alert(t('buddies.notifySent'));
      })
      .catch((error: Error) => {
        setNotifyingId(null);
        Alert.alert(t('buddyDetail.markPaidErrorTitle'), error.message);
      });
  };

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
        <GlassView style={[styles.totalCard, styles.totalsRow]}>
          <View style={styles.totalCell}>
            <Text style={styles.totalLabel}>{t('buddyDetail.owedToMe')}</Text>
            <Text style={styles.totalValue}>{formatAmount(total)}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalCell}>
            <Text style={styles.totalLabel}>{t('buddyDetail.owedByMe')}</Text>
            <Text style={[styles.totalValue, styles.totalValueOwed]}>{formatAmount(owedTotal)}</Text>
          </View>
        </GlassView>

        {canSettle && (
          <Pressable
            style={({ pressed }) => [styles.settleButton, (pressed || isSettling) && styles.markPaidButtonPressed]}
            onPress={handleSettle}
            disabled={isSettling}
          >
            <ArrowsLeftRightIcon size={16} weight="bold" color={colors.white} />
            <Text style={styles.settleButtonText}>{isSettling ? t('common.saving') : t('buddyDetail.settle')}</Text>
          </Pressable>
        )}

        {unpaidShares.length === 0 && owedShares.length === 0 && (
          <Text style={styles.emptyText}>{t('buddyDetail.noUnpaidInvoices')}</Text>
        )}

        {unpaidShares.length > 0 && <Text style={styles.sectionTitle}>{t('buddyDetail.owedToMe')}</Text>}
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

        {owedShares.length > 0 && <Text style={styles.sectionTitle}>{t('buddyDetail.owedByMe')}</Text>}
        {owedShares.map((share) => {
          const isNotifying = notifyingId === share.invoiceId;
          return (
            <GlassView key={share.invoiceId} style={styles.row}>
              <Pressable style={styles.rowLeft} onPress={() => openOwed(share)}>
                <Text style={styles.rowSeller} numberOfLines={1}>
                  {share.sellerName}
                </Text>
                <Text style={styles.rowDate}>{toDateLabel(new Date(share.dateTimeCreated))}</Text>
              </Pressable>
              <View style={styles.rowRight}>
                <Pressable onPress={() => openOwed(share)}>
                  <Text style={[styles.rowShare, styles.rowShareOwed]}>{formatAmount(share.share)}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.markPaidButton, pressed && styles.markPaidButtonPressed]}
                  onPress={() => handleNotifyPaid(share)}
                  disabled={isNotifying}
                >
                  <PaperPlaneTiltIcon size={13} color={colors.primary} />
                  <Text style={styles.markPaidButtonText}>
                    {isNotifying ? t('common.saving') : t('buddies.notifyPaid')}
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
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  totalCell: {
    flex: 1,
    alignItems: 'center',
  },
  totalDivider: {
    width: 1,
    marginHorizontal: 12,
    backgroundColor: colors.border,
  },
  totalValueOwed: {
    color: colors.textDark,
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  settleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
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
  // What I owe reads in plain dark, so it is not mistaken for money owed to me.
  rowShareOwed: {
    color: colors.textDark,
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
