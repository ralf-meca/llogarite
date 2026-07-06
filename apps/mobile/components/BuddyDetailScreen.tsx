import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buddyInvoiceShares, unpaidTotal } from '../lib/buddyExpenses';
import { formatAmount } from '../lib/formatAmount';
import type { SavedInvoice } from '../lib/savedInvoicesApi';
import { GlassView } from './GlassView';

type BuddyDetailScreenProps = {
  buddyId: string;
  buddyName: string;
  invoices: SavedInvoice[];
  onBack: () => void;
  onSelectInvoice: (invoiceId: string) => void;
};

export function BuddyDetailScreen({ buddyId, buddyName, invoices, onBack, onSelectInvoice }: BuddyDetailScreenProps) {
  const shares = useMemo(() => buddyInvoiceShares(invoices, buddyId), [invoices, buddyId]);
  const unpaidShares = shares.filter((share) => !share.paid);
  const total = unpaidTotal(shares);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {buddyName}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GlassView style={styles.totalCard}>
          <Text style={styles.totalLabel}>Papaguar gjithsej</Text>
          <Text style={styles.totalValue}>{formatAmount(total)}</Text>
        </GlassView>

        <Text style={styles.sectionTitle}>Faturat e papaguara</Text>
        {unpaidShares.length === 0 && <Text style={styles.emptyText}>Nuk ka fatura të papaguara.</Text>}
        {unpaidShares.map((share) => (
          <Pressable key={share.invoiceId} onPress={() => onSelectInvoice(share.invoiceId)}>
            <GlassView style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowSeller} numberOfLines={1}>
                  {share.sellerName}
                </Text>
                <Text style={styles.rowDate}>{new Date(share.dateTimeCreated).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.rowShare}>{formatAmount(share.share)}</Text>
            </GlassView>
          </Pressable>
        ))}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  rowMain: {
    flex: 1,
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
});
