import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import type { InvoiceItem, InvoiceVerificationResult } from '../lib/invoiceApi';
import { GlassView } from './GlassView';
import { VerifiedBadge } from './VerifiedBadge';

type InvoiceReceiptProps = {
  result: InvoiceVerificationResult;
  onSelectItem?: (item: InvoiceItem) => void;
};

const LOCALE_BY_LANGUAGE = { sq: 'sq-AL', en: 'en-US' } as const;

export function InvoiceReceipt({ result, onSelectItem }: InvoiceReceiptProps) {
  const { t, language } = useTranslation();
  return (
    <GlassView style={styles.card}>
      <Text style={styles.date}>
        {new Date(result.dateTimeCreated).toLocaleString(LOCALE_BY_LANGUAGE[language])}
      </Text>
      <View style={styles.sellerRow}>
        <Text style={styles.sellerName}>{result.seller.name}</Text>
        {result.verified && <VerifiedBadge />}
      </View>

      <View style={styles.itemsHeader}>
        <Text style={[styles.headerCell, styles.nameColumn]}>{t('invoiceReceipt.itemColumn')}</Text>
        <Text style={[styles.headerCell, styles.qtyColumn]}>{t('invoiceReceipt.quantityColumn')}</Text>
        <Text style={[styles.headerCell, styles.priceColumn]}>{t('invoiceReceipt.priceColumn')}</Text>
        <Text style={[styles.headerCell, styles.priceColumn]}>{t('invoiceReceipt.priceWithVatColumn')}</Text>
      </View>
      {result.items.map((item, index) => (
        <Pressable
          key={index}
          style={({ pressed }) => [styles.itemRow, onSelectItem && pressed && styles.itemRowPressed]}
          onPress={onSelectItem ? () => onSelectItem(item) : undefined}
          disabled={!onSelectItem}
        >
          <Text style={[styles.cell, styles.nameColumn]}>{item.name}</Text>
          <Text style={[styles.cell, styles.qtyColumn]}>{item.quantity}</Text>
          <Text style={[styles.cell, styles.priceColumn]}>{formatAmount(item.unitPriceBeforeVat)}</Text>
          <Text style={[styles.cell, styles.priceColumn]}>{formatAmount(item.unitPriceAfterVat)}</Text>
        </Pressable>
      ))}

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
    marginBottom: 16,
  },
  sellerName: {
    fontSize: 18,
    fontWeight: '700',
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
