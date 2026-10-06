import { AirplaneTiltIcon, FolderIcon, CheckCircleIcon, CircleIcon, HandCoinsIcon } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { categoryPlaceKey } from '../lib/categories';
import { CURRENCY_SYMBOL, formatMoney, formatRate, invoiceCurrency, invoiceRate } from '../lib/currency';
import { dominantCategoryOfItems } from '../lib/categorySpending';
import { toDateLabel } from '../lib/date';
import { formatAmount, needsCents } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import type { InvoiceItem, InvoiceVerificationResult } from '../lib/invoiceApi';
import { AMOUNT_EPSILON, invoiceDebts } from '../lib/invoicePayments';
import { fetchProjects, type Project } from '../lib/projectsApi';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';
import { MultiPersonAvatar } from './MultiPersonAvatar';
import { UserAvatar } from './UserAvatar';
import { VerifiedBadge } from './VerifiedBadge';

type InvoiceReceiptProps = {
  result: InvoiceVerificationResult;
  // Whoever entered the invoice, for their row when a buddy paid the bill.
  owner?: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
  // True when the owner is the person looking at it, who is then called "you".
  ownerIsViewer?: boolean;
  // Settles what the owner still owes the buddies who paid. Only given on the
  // owner's own invoice: they are the one who knows they paid it back.
  onMarkOwnerPaid?: () => void;
  isMarkingOwnerPaid?: boolean;
  // The same two ways round the buddies screen offers. On the owner's own invoice,
  // a buddy's share can be marked as paid back. On someone else's, the viewer can
  // only tell the owner they have paid: the owner keeps the record.
  viewerId?: string;
  onMarkBuddyPaid?: (buddyUserId: string) => void;
  markingBuddyId?: string | null;
  onNotifyPaid?: () => void;
  isNotifyingPaid?: boolean;
  onSelectItem?: (item: InvoiceItem) => void;
};

export function InvoiceReceipt({
  result,
  owner,
  ownerIsViewer,
  onMarkOwnerPaid,
  isMarkingOwnerPaid,
  viewerId,
  onMarkBuddyPaid,
  markingBuddyId,
  onNotifyPaid,
  isNotifyingPaid,
  onSelectItem,
}: InvoiceReceiptProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [buddies, setBuddies] = useState<Buddy[]>([]);

  useEffect(() => {
    if (result.projectId) {
      fetchProjects()
        .then(setProjects)
        .catch(() => setProjects([]));
    }
    if (result.buddies && result.buddies.length > 0) {
      fetchBuddies()
        .then(setBuddies)
        .catch(() => setBuddies([]));
    }
  }, [result.projectId, result.buddies]);

  const project = result.projectId ? (projects.find((candidate) => candidate.id === result.projectId) ?? null) : null;
  const ProjectIcon = project?.kind === 'trip' ? AirplaneTiltIcon : FolderIcon;

  const invoiceBuddies = result.buddies ?? [];
  // Who paid what at the till, and what that leaves each person owing.
  const debts = invoiceDebts(result);
  const ownerName = ownerIsViewer ? t('manualInvoice.you') : (owner?.name ?? owner?.email ?? t('invoiceReceipt.owner'));
  const buddyName = (userId: string) => {
    const info = buddies.find((candidate) => candidate.id === userId);
    return info?.name ?? info?.email ?? t('manualInvoice.buddyFallback');
  };
  const payers = [
    ...(debts.owner.paidAtTill > AMOUNT_EPSILON ? [{ name: ownerName, amount: debts.owner.paidAtTill }] : []),
    ...invoiceBuddies
      .filter((buddy) => debts.buddies[buddy.userId].paidAtTill > AMOUNT_EPSILON)
      .map((buddy) => ({ name: buddyName(buddy.userId), amount: debts.buddies[buddy.userId].paidAtTill })),
  ];
  // The receipt reads in the currency it was written in. Stored amounts are in
  // lek, so each one goes back through the invoice's own rate.
  const currency = invoiceCurrency(result);
  const rate = invoiceRate(result);
  const asWritten = (amountInLek: number) => amountInLek / rate;
  const showCents = needsCents([
    asWritten(result.totalPrice),
    ...result.items.flatMap((item) => [
      asWritten(item.unitPriceAfterVat),
      asWritten(item.unitPriceAfterVat * item.quantity),
    ]),
  ]);
  const hasPerRowSplit =
    invoiceBuddies.length > 0 &&
    result.items.some((item) => Object.values(item.buddyQuantities ?? {}).some((qty) => qty > 0));

  return (
    <GlassView style={styles.card}>
      <Text style={styles.date}>{toDateLabel(new Date(result.dateTimeCreated))}</Text>
      <View style={styles.sellerRow}>
        {/* Same stand-in the saved list uses, so an invoice that was never
            given a seller reads the same in both places rather than opening
            onto a blank heading. */}
        <Text style={[styles.sellerName, !result.seller.name.trim() && styles.sellerNameFallback]}>
          {result.seller.name.trim() || t(categoryPlaceKey(dominantCategoryOfItems(result.items)))}
        </Text>
        {result.verified && <VerifiedBadge />}
      </View>

      {project && (
        <View style={styles.metaRow}>
          {/* The same mark the project wears on its own card. */}
          <ProjectIcon size={14} color="#6b7280" />
          <Text style={styles.metaText}>{project.name}</Text>
        </View>
      )}

      {debts.hasOtherPayers && (
        <View style={styles.metaRow}>
          <HandCoinsIcon size={14} color="#6b7280" />
          <Text style={styles.metaText}>
            {/* One payer needs no figure; several each get theirs. */}
            {t('invoiceReceipt.paidBy', {
              name:
                payers.length === 1
                  ? payers[0].name
                  : payers.map((payer) => `${payer.name} ${formatMoney(asWritten(payer.amount), currency)}`).join(', '),
            })}
          </Text>
        </View>
      )}

      {invoiceBuddies.length > 0 && (
        <View style={styles.buddiesSection}>
          <Text style={styles.buddiesTitle}>{t('invoiceReceipt.buddiesTitle')}</Text>
          {/* When buddies paid, the owner may owe part of the bill too. */}
          {debts.hasOtherPayers && (
            <>
            <View style={styles.buddyRow}>
              {/* Someone else's invoice arrives without their photo, but its owner
                  is one of the viewer's buddies, whose list carries it. */}
              <UserAvatar
                user={
                  owner
                    ? owner.avatarUrl
                      ? owner
                      : (buddies.find((candidate) => candidate.id === owner.id) ?? owner)
                    : null
                }
                size={26}
              />
              <Text style={styles.buddyName} numberOfLines={1}>
                {ownerName}
              </Text>
              <Text style={styles.buddyShare}>
                {formatMoney(asWritten(debts.owner.debt > 0 ? debts.owner.debt : debts.owner.share), currency, true)}
              </Text>
              {debts.owner.debt === 0 ? (
                <HandCoinsIcon size={16} color={colors.primary} />
              ) : result.ownerPaid ? (
                <CheckCircleIcon size={16} weight="fill" color="#10b981" />
              ) : (
                <CircleIcon size={16} color="#9ca3af" />
              )}
            </View>
            {/* The owner's own debt on their own invoice is theirs to tick off. */}
            {ownerIsViewer && onMarkOwnerPaid && debts.owner.debt > 0 && !result.ownerPaid && (
              <Pressable
                style={[styles.markPaidButton, isMarkingOwnerPaid && styles.markPaidButtonDisabled]}
                onPress={onMarkOwnerPaid}
                disabled={isMarkingOwnerPaid}
                hitSlop={6}
              >
                <Text style={styles.markPaidText}>
                  {isMarkingOwnerPaid ? t('common.saving') : t('projectDetail.markPaid')}
                </Text>
              </Pressable>
            )}
            </>
          )}
          {invoiceBuddies.map((buddy) => {
            const info = buddies.find((candidate) => candidate.id === buddy.userId);
            // What is still owed once anything paid at the till is counted; the
            // whole share when they covered it all themselves.
            const position = debts.buddies[buddy.userId];
            const share = position.debt > 0 ? position.debt : position.share;
            const coveredAtTill = position.paidAtTill > AMOUNT_EPSILON && position.debt === 0;
            const stillOwes = position.debt > 0 && !buddy.paid;
            const canMarkPaid = Boolean(ownerIsViewer && onMarkBuddyPaid) && stillOwes;
            const canNotify = !ownerIsViewer && Boolean(onNotifyPaid) && buddy.userId === viewerId && stillOwes;
            const isMarking = markingBuddyId === buddy.userId;
            return (
              <View key={buddy.userId}>
              <View style={styles.buddyRow}>
                <UserAvatar user={info ?? null} size={26} />
                <Text style={styles.buddyName} numberOfLines={1}>
                  {info?.name ?? info?.email ?? t('manualInvoice.buddyFallback')}
                </Text>
                <Text style={styles.buddyShare}>{formatMoney(asWritten(share), currency, true)}</Text>
                {coveredAtTill ? (
                  <HandCoinsIcon size={16} color={colors.primary} />
                ) : buddy.paid ? (
                  <CheckCircleIcon size={16} weight="fill" color="#10b981" />
                ) : (
                  <CircleIcon size={16} color="#9ca3af" />
                )}
              </View>
              {canMarkPaid && (
                <Pressable
                  style={[styles.markPaidButton, markingBuddyId != null && styles.markPaidButtonDisabled]}
                  onPress={() => onMarkBuddyPaid?.(buddy.userId)}
                  disabled={markingBuddyId != null}
                  hitSlop={6}
                >
                  <Text style={styles.markPaidText}>
                    {isMarking ? t('common.saving') : t('projectDetail.markPaid')}
                  </Text>
                </Pressable>
              )}
              {canNotify && (
                <Pressable
                  style={[styles.markPaidButton, isNotifyingPaid && styles.markPaidButtonDisabled]}
                  onPress={onNotifyPaid}
                  disabled={isNotifyingPaid}
                  hitSlop={6}
                >
                  <Text style={styles.markPaidText}>
                    {isNotifyingPaid ? t('common.saving') : t('buddies.notifyPaid')}
                  </Text>
                </Pressable>
              )}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.itemsHeader}>
        <Text style={[styles.headerCell, styles.nameColumn]}>{t('invoiceReceipt.itemColumn')}</Text>
        <Text style={[styles.headerCell, styles.qtyColumn]}>{t('invoiceReceipt.quantityColumn')}</Text>
        <Text style={[styles.headerCell, styles.priceColumn]}>{t('invoiceReceipt.priceColumn')}</Text>
        <Text style={[styles.headerCell, styles.priceColumn]}>{t('invoiceReceipt.totalColumn')}</Text>
        {hasPerRowSplit && <View style={styles.splitColumn} />}
      </View>
      {result.items.map((item, index) => {
        const claimedBuddies = invoiceBuddies
          .filter((buddy) => (item.buddyQuantities?.[buddy.userId] ?? 0) > 0)
          .map((buddy) => buddies.find((candidate) => candidate.id === buddy.userId))
          .filter((buddy): buddy is Buddy => Boolean(buddy));
        return (
          <Pressable
            key={index}
            style={({ pressed }) => [styles.itemRow, onSelectItem && pressed && styles.itemRowPressed]}
            onPress={onSelectItem ? () => onSelectItem(item) : undefined}
            disabled={!onSelectItem}
          >
            <Text style={[styles.cell, styles.nameColumn]}>{item.name}</Text>
            <Text style={[styles.cell, styles.qtyColumn]}>{item.quantity}</Text>
            <Text style={[styles.cell, styles.priceColumn]}>
              {formatAmount(asWritten(item.unitPriceAfterVat), showCents)}
            </Text>
            <Text style={[styles.cell, styles.priceColumn]}>
              {formatAmount(asWritten(item.unitPriceAfterVat * item.quantity), showCents)}
            </Text>
            {hasPerRowSplit && (
              <View style={styles.splitColumn}>
                {claimedBuddies.length > 0 && <MultiPersonAvatar people={claimedBuddies} size={22} />}
              </View>
            )}
          </Pressable>
        );
      })}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t('invoiceReceipt.total')}</Text>
        <Text style={styles.totalValue}>{formatMoney(asWritten(result.totalPrice), currency, showCents)}</Text>
      </View>
      {/* What it came to in lek, which is what every total elsewhere counts. */}
      {currency !== 'ALL' && (
        <View style={styles.convertedRow}>
          <Text style={styles.convertedText}>
            {t('invoiceReceipt.rate', { symbol: CURRENCY_SYMBOL[currency], rate: formatRate(rate) })}
          </Text>
          <Text style={styles.convertedText}>
            = {formatAmount(result.totalPrice, needsCents([result.totalPrice]))} {CURRENCY_SYMBOL.ALL}
          </Text>
        </View>
      )}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
  },
  date: {
    color: '#6b7280',
    fontSize: 13,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  sellerName: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Muted, so a guessed place never reads as a name someone actually entered.
  sellerNameFallback: {
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#6b7280',
  },
  buddiesSection: {
    marginTop: 4,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  buddiesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  buddyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  buddyName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  buddyShare: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  // Same pill the project screen settles a debt with, under the row it belongs to.
  markPaidButton: {
    alignSelf: 'flex-end',
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primaryTint,
  },
  markPaidButtonDisabled: {
    opacity: 0.5,
  },
  markPaidText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  itemsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 6,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemRowPressed: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  cell: {
    fontSize: 14,
  },
  nameColumn: {
    flex: 3,
  },
  qtyColumn: {
    flex: 1,
    textAlign: 'right',
  },
  priceColumn: {
    flex: 1.5,
    textAlign: 'right',
  },
  splitColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 28,
    marginLeft: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  convertedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  convertedText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
