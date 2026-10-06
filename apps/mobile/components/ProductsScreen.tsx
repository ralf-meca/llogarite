import { CaretRightIcon } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { listProducts, type PricedInvoice, type ProductSummary } from '../lib/productPrices';
import { colors } from '../lib/theme';
import { GlassTextInput } from './GlassTextInput';

type ProductsScreenProps = {
  invoices: PricedInvoice[];
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

        {/* One plain list, its rows told apart by a hairline, rather than a box each. */}
        <View>
          {filtered.map((product, index) => (
            <Pressable
              key={product.key}
              style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.rowPressed]}
              onPress={() => onSelectProduct(product)}
            >
              <Text style={styles.rowName} numberOfLines={1}>
                {product.name}
              </Text>
              <CaretRightIcon size={16} color="#9ca3af" />
            </Pressable>
          ))}
        </View>
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
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 4,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d5db',
  },
  rowPressed: {
    opacity: 0.5,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
});
