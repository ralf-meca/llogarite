import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { listProducts, type ProductSummary } from '../lib/productPrices';
import type { SavedInvoice } from '../lib/savedInvoicesApi';
import { colors } from '../lib/theme';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';

type ProductsScreenProps = {
  invoices: SavedInvoice[];
  onSelectProduct: (product: ProductSummary) => void;
};

export function ProductsScreen({ invoices, onSelectProduct }: ProductsScreenProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const sourceInvoices = useMemo(
    () => (verifiedOnly ? invoices.filter((invoice) => invoice.data.verified) : invoices),
    [invoices, verifiedOnly],
  );
  const products = useMemo(() => listProducts(sourceInvoices), [sourceInvoices]);
  const filtered = products.filter((product) => product.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('products.title')}</Text>

        <GlassTextInput
          style={styles.search}
          placeholder={t('products.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleButton, !verifiedOnly && styles.toggleButtonActive]}
            onPress={() => setVerifiedOnly(false)}
          >
            <Text style={[styles.toggleText, !verifiedOnly && styles.toggleTextActive]}>{t('products.all')}</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, verifiedOnly && styles.toggleButtonActive]}
            onPress={() => setVerifiedOnly(true)}
          >
            <Text style={[styles.toggleText, verifiedOnly && styles.toggleTextActive]}>
              {t('products.verifiedOnly')}
            </Text>
          </Pressable>
        </View>

        {filtered.length === 0 && (
          <Text style={styles.emptyText}>
            {products.length === 0
              ? verifiedOnly
                ? t('products.emptyVerified')
                : t('products.emptyNone')
              : t('products.noneFound')}
          </Text>
        )}

        {filtered.map((product) => (
          <Pressable key={product.key} onPress={() => onSelectProduct(product)}>
            <GlassView style={styles.row}>
              <Text style={styles.rowName} numberOfLines={1}>
                {product.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
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
  scroll: {
    flex: 1,
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  search: {
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    padding: 4,
    marginBottom: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#ffffff',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
});
