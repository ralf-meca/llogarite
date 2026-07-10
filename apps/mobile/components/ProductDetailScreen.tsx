import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import {
  getProductRecords,
  last30DaysStats,
  monthlyChartPoints,
  yearlyChartPoints,
} from '../lib/productPrices';
import type { SavedInvoice } from '../lib/savedInvoicesApi';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';
import { LineChart } from './LineChart';

type ProductDetailScreenProps = {
  productKey: string;
  productName: string;
  invoices: SavedInvoice[];
  onBack: () => void;
};

type ChartRange = 'monthly' | 'yearly';

const CHART_WIDTH = Dimensions.get('window').width - 88;

export function ProductDetailScreen({ productKey, productName, invoices, onBack }: ProductDetailScreenProps) {
  const { t, language } = useTranslation();
  const [range, setRange] = useState<ChartRange>('monthly');

  const records = useMemo(() => getProductRecords(invoices, productKey), [invoices, productKey]);
  const stats = useMemo(() => last30DaysStats(records), [records]);
  const points = useMemo(
    () => (range === 'monthly' ? monthlyChartPoints(records) : yearlyChartPoints(records, language)),
    [records, range, language],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {productName}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsRow}>
          <GlassView style={styles.statCard}>
            <Text style={styles.statValue}>{formatAmount(stats.average)}</Text>
            <Text style={styles.statLabel}>{t('productDetail.average')}</Text>
          </GlassView>
          <GlassView style={styles.statCard}>
            <Text style={styles.statValue}>{formatAmount(stats.lowest)}</Text>
            <Text style={styles.statLabel}>{t('productDetail.lowest')}</Text>
          </GlassView>
          <GlassView style={styles.statCard}>
            <Text style={styles.statValue}>{formatAmount(stats.highest)}</Text>
            <Text style={styles.statLabel}>{t('productDetail.highest')}</Text>
          </GlassView>
        </View>
        <Text style={styles.statsHint}>{t('productDetail.basedOnLast30Days')}</Text>

        <GlassView style={styles.chartCard}>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleButton, range === 'monthly' && styles.toggleButtonActive]}
              onPress={() => setRange('monthly')}
            >
              <Text style={[styles.toggleText, range === 'monthly' && styles.toggleTextActive]}>
                {t('productDetail.monthly')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleButton, range === 'yearly' && styles.toggleButtonActive]}
              onPress={() => setRange('yearly')}
            >
              <Text style={[styles.toggleText, range === 'yearly' && styles.toggleTextActive]}>
                {t('productDetail.yearly')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.chartWrapper}>
            <LineChart points={points} width={CHART_WIDTH} height={200} />
          </View>
        </GlassView>
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
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  statsHint: {
    marginTop: -8,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  chartCard: {
    padding: 20,
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
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
  chartWrapper: {
    alignItems: 'center',
  },
});
