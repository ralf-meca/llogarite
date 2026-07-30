import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { computeBuddyShareFromRows } from '../lib/buddyExpenses';
import { toDateLabel } from '../lib/date';
import { formatAmount } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import type { InvoiceItem, InvoiceVerificationResult } from '../lib/invoiceApi';
import { fetchProjects, type Project } from '../lib/projectsApi';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';
import { MultiPersonAvatar } from './MultiPersonAvatar';
import { UserAvatar } from './UserAvatar';
import { VerifiedBadge } from './VerifiedBadge';

type InvoiceReceiptProps = {
  result: InvoiceVerificationResult;
  onSelectItem?: (item: InvoiceItem) => void;
};

export function InvoiceReceipt({ result, onSelectItem }: InvoiceReceiptProps) {
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

  const invoiceBuddies = result.buddies ?? [];
  const allBuddyIds = invoiceBuddies.map((buddy) => buddy.userId);
  const shareRows = result.items.map((item) => ({
    quantity: item.quantity,
    unitPrice: item.unitPriceAfterVat,
    buddyQuantities: item.buddyQuantities ?? {},
  }));
  const hasPerRowSplit =
    invoiceBuddies.length > 0 &&
    result.items.some((item) => Object.values(item.buddyQuantities ?? {}).some((qty) => qty > 0));

  return (
    <GlassView style={styles.card}>
      <Text style={styles.date}>{toDateLabel(new Date(result.dateTimeCreated))}</Text>
      <View style={styles.sellerRow}>
        <Text style={styles.sellerName}>{result.seller.name}</Text>
        {result.verified && <VerifiedBadge />}
      </View>

      {project && (
        <View style={styles.metaRow}>
          <Ionicons name="briefcase-outline" size={14} color="#6b7280" />
          <Text style={styles.metaText}>{project.name}</Text>
        </View>
      )}

      {invoiceBuddies.length > 0 && (
        <View style={styles.buddiesSection}>
          <Text style={styles.buddiesTitle}>{t('invoiceReceipt.buddiesTitle')}</Text>
          {invoiceBuddies.map((buddy) => {
            const info = buddies.find((candidate) => candidate.id === buddy.userId);
            const share = computeBuddyShareFromRows(shareRows, buddy.userId, allBuddyIds);
            return (
              <View key={buddy.userId} style={styles.buddyRow}>
                <UserAvatar user={info ?? null} size={26} />
                <Text style={styles.buddyName} numberOfLines={1}>
                  {info?.name ?? info?.email ?? t('manualInvoice.buddyFallback')}
                </Text>
                <Text style={styles.buddyShare}>{formatAmount(share)}</Text>
                <Ionicons
                  name={buddy.paid ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={buddy.paid ? '#10b981' : '#9ca3af'}
                />
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
            <Text style={[styles.cell, styles.priceColumn]}>{formatAmount(item.unitPriceAfterVat)}</Text>
            <Text style={[styles.cell, styles.priceColumn]}>{formatAmount(item.unitPriceAfterVat * item.quantity)}</Text>
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
        <Text style={styles.totalValue}>{formatAmount(result.totalPrice)}</Text>
      </View>
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
});
