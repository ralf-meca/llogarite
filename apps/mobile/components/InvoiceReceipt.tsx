import { StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../lib/formatAmount';
import type { InvoiceVerificationResult } from '../lib/invoiceApi';

type InvoiceReceiptProps = {
  result: InvoiceVerificationResult;
};

export function InvoiceReceipt({ result }: InvoiceReceiptProps) {
  return (
    <View>
      <Text style={styles.date}>{new Date(result.dateTimeCreated).toLocaleString()}</Text>
      <Text style={styles.sellerName}>{result.seller.name}</Text>

      <View style={styles.itemsHeader}>
        <Text style={[styles.headerCell, styles.nameColumn]}>Artikulli</Text>
        <Text style={[styles.headerCell, styles.qtyColumn]}>Sasia</Text>
        <Text style={[styles.headerCell, styles.priceColumn]}>Çmimi</Text>
        <Text style={[styles.headerCell, styles.priceColumn]}>Me TVSH</Text>
      </View>
      {result.items.map((item, index) => (
        <View key={index} style={styles.itemRow}>
          <Text style={[styles.cell, styles.nameColumn]}>{item.name}</Text>
          <Text style={[styles.cell, styles.qtyColumn]}>{item.quantity}</Text>
          <Text style={[styles.cell, styles.priceColumn]}>{formatAmount(item.unitPriceBeforeVat)}</Text>
          <Text style={[styles.cell, styles.priceColumn]}>{formatAmount(item.unitPriceAfterVat)}</Text>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Totali</Text>
        <Text style={styles.totalValue}>{formatAmount(result.totalPrice)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  date: {
    color: '#6b7280',
    fontSize: 13,
  },
  sellerName: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 16,
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
