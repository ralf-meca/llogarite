import { ArrowLeftIcon, CheckIcon, XIcon } from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import {
  fetchReviewInvoices,
  setInvoiceLegitimacy,
  type InvoiceLegitimacy,
  type ReviewInvoice,
} from '../lib/adminApi';
import { toDateLabel } from '../lib/date';
import { formatAmount } from '../lib/formatAmount';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';
import { InvoiceReceipt } from './InvoiceReceipt';
import { ToastHost } from './ToastHost';

// Pending first, and selected by default: the reason to open this screen is the
// queue. The other two are where you go to look something up or undo yourself.
const FILTERS: { key: InvoiceLegitimacy; labelKey: TranslationKey }[] = [
  { key: 'pending', labelKey: 'review.pending' },
  { key: 'accepted', labelKey: 'review.accepted' },
  { key: 'denied', labelKey: 'review.denied' },
];

export function InvoiceReviewScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<InvoiceLegitimacy>('pending');
  const [invoices, setInvoices] = useState<ReviewInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openInvoice, setOpenInvoice] = useState<ReviewInvoice | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toasts, showError, showSuccess, dismissToast } = useToasts();

  const load = useCallback(
    (next: InvoiceLegitimacy) => {
      setIsLoading(true);
      fetchReviewInvoices(next)
        .then((result) => {
          setInvoices(result);
          setIsLoading(false);
        })
        .catch((error: Error) => {
          setInvoices([]);
          setIsLoading(false);
          showError(error.message);
        });
    },
    [showError],
  );

  useEffect(() => {
    load(status);
  }, [status, load]);

  const decide = (invoice: ReviewInvoice, legitimacy: InvoiceLegitimacy) => {
    setSavingId(invoice.id);
    setInvoiceLegitimacy(invoice.id, legitimacy)
      .then(() => {
        setSavingId(null);
        setOpenInvoice(null);
        // Drop it rather than reload: it no longer belongs in the list being
        // shown, and refetching would scroll the reviewer back to the top.
        setInvoices((current) => current.filter((candidate) => candidate.id !== invoice.id));
        showSuccess(t(legitimacy === 'accepted' ? 'review.acceptedToast' : 'review.deniedToast'));
      })
      .catch((error: Error) => {
        setSavingId(null);
        showError(error.message);
      });
  };

  if (openInvoice) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => setOpenInvoice(null)} hitSlop={12}>
            <ArrowLeftIcon size={22} color={colors.textDark} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {openInvoice.ownerName ?? openInvoice.ownerEmail}
          </Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <InvoiceReceipt result={openInvoice.data} />
        </ScrollView>

        <View style={styles.decisionBar}>
          <Pressable
            style={[styles.decisionButton, styles.denyButton]}
            onPress={() => decide(openInvoice, 'denied')}
            disabled={savingId === openInvoice.id}
          >
            <XIcon size={18} weight="bold" color={colors.white} />
            <Text style={styles.decisionText}>{t('review.deny')}</Text>
          </Pressable>
          <Pressable
            style={[styles.decisionButton, styles.acceptButton]}
            onPress={() => decide(openInvoice, 'accepted')}
            disabled={savingId === openInvoice.id}
          >
            <CheckIcon size={18} weight="bold" color={colors.white} />
            <Text style={styles.decisionText}>{t('review.accept')}</Text>
          </Pressable>
        </View>

        <ToastHost toasts={toasts} onDismiss={dismissToast} bottomOffset={110} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>{t('review.title')}</Text>

        <View style={styles.filterRow}>
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.key}
              style={[styles.filterButton, status === filter.key && styles.filterButtonActive]}
              onPress={() => setStatus(filter.key)}
            >
              <Text style={[styles.filterText, status === filter.key && styles.filterTextActive]}>
                {t(filter.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : invoices.length === 0 ? (
          <Text style={styles.emptyText}>{t('review.empty')}</Text>
        ) : (
          invoices.map((invoice) => (
            <Pressable key={invoice.id} onPress={() => setOpenInvoice(invoice)}>
              <GlassView style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowSeller} numberOfLines={1}>
                    {invoice.data.seller.name.trim() || t('review.noSeller')}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {invoice.ownerName ?? invoice.ownerEmail}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {toDateLabel(new Date(invoice.data.dateTimeCreated))} ·{' '}
                    {t('review.itemCount', { count: invoice.data.items.length })}
                  </Text>
                </View>

                <View style={styles.rowRight}>
                  <Text style={styles.rowTotal}>{formatAmount(invoice.data.totalPrice)}</Text>
                  <View style={styles.rowActions}>
                    <Pressable
                      style={[styles.iconButton, styles.denyButton]}
                      onPress={() => decide(invoice, 'denied')}
                      disabled={savingId === invoice.id}
                      hitSlop={6}
                    >
                      <XIcon size={16} weight="bold" color={colors.white} />
                    </Pressable>
                    <Pressable
                      style={[styles.iconButton, styles.acceptButton]}
                      onPress={() => decide(invoice, 'accepted')}
                      disabled={savingId === invoice.id}
                      hitSlop={6}
                    >
                      <CheckIcon size={16} weight="bold" color={colors.white} />
                    </Pressable>
                  </View>
                </View>
              </GlassView>
            </Pressable>
          ))
        )}
      </ScrollView>

      <ToastHost toasts={toasts} onDismiss={dismissToast} bottomOffset={110} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 140,
    gap: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 24,
    marginBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.neutral,
    borderRadius: 10,
    padding: 3,
  },
  filterButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: colors.white,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.primary,
  },
  loading: {
    marginTop: 32,
  },
  emptyText: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowSeller: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  rowTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    backgroundColor: colors.white,
  },
  decisionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  acceptButton: {
    backgroundColor: '#059669',
  },
  denyButton: {
    backgroundColor: colors.danger,
  },
  decisionText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
});
