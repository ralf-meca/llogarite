import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchBudget } from '../lib/budgetApi';
import { groupByCategory } from '../lib/categorySpending';
import { formatAmount } from '../lib/formatAmount';
import { currentMonthTotal, groupByMonth } from '../lib/monthlySpending';
import { toPieSegments } from '../lib/pieSegments';
import type { SavedInvoice } from '../lib/savedInvoicesApi';
import { GlassView } from './GlassView';
import { PieChart } from './PieChart';
import { ProgressBar } from './ProgressBar';

const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4', '#a3a3a3'];

type DashboardScreenProps = {
  invoices: SavedInvoice[];
};

export function DashboardScreen({ invoices }: DashboardScreenProps) {
  const [budgetTarget, setBudgetTarget] = useState<number | null>(null);

  useEffect(() => {
    fetchBudget()
      .then((budget) => setBudgetTarget(budget?.amount ?? null))
      .catch(() => setBudgetTarget(null));
  }, []);

  const monthSpent = currentMonthTotal(invoices);
  const budgetRatio = budgetTarget && budgetTarget > 0 ? monthSpent / budgetTarget : 0;

  const totalSpent = invoices.reduce((sum, invoice) => sum + invoice.data.totalPrice, 0);
  const segments = toPieSegments(groupByMonth(invoices)).map((segment, index) => ({
    ...segment,
    color: PALETTE[index % PALETTE.length],
  }));
  const chartTotal = segments.reduce((sum, segment) => sum + segment.total, 0);

  const categorySegments = toPieSegments(groupByCategory(invoices)).map((segment, index) => ({
    ...segment,
    color: PALETTE[index % PALETTE.length],
  }));
  const categoryChartTotal = categorySegments.reduce((sum, segment) => sum + segment.total, 0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {budgetTarget !== null && (
        <GlassView style={styles.budgetCard}>
          <Text style={styles.chartTitle}>Buxheti i muajit</Text>
          <Text style={styles.budgetAmount}>
            {formatAmount(monthSpent)} <Text style={styles.budgetTarget}>nga {formatAmount(budgetTarget)}</Text>
          </Text>
          <View style={styles.budgetProgressWrapper}>
            <ProgressBar ratio={budgetRatio} />
          </View>
        </GlassView>
      )}

      <View style={styles.statsRow}>
        <GlassView style={styles.statCard}>
          <Text style={styles.statValue}>{formatAmount(totalSpent)}</Text>
          <Text style={styles.statLabel}>Shpenzime gjithsej</Text>
        </GlassView>
        <GlassView style={styles.statCard}>
          <Text style={styles.statValue}>{invoices.length}</Text>
          <Text style={styles.statLabel}>Fatura të ruajtura</Text>
        </GlassView>
      </View>

      {invoices.length === 0 ? (
        <Text style={styles.emptyText}>Nuk ka fatura për të shfaqur statistika.</Text>
      ) : (
        <GlassView style={styles.chartCard}>
          <Text style={styles.chartTitle}>Shpenzimet sipas muajit</Text>
          <View style={styles.chartRow}>
            <PieChart
              segments={segments.map((segment) => ({ label: segment.label, value: segment.total, color: segment.color }))}
              size={160}
            />
            <View style={styles.legend}>
              {segments.map((segment) => (
                <View key={segment.label} style={styles.legendRow}>
                  <View style={[styles.legendSwatch, { backgroundColor: segment.color }]} />
                  <View style={styles.legendTextGroup}>
                    <Text style={styles.legendLabel}>{segment.label}</Text>
                    <Text style={styles.legendValue}>
                      {formatAmount(segment.total)}
                      {chartTotal > 0 ? ` (${Math.round((segment.total / chartTotal) * 100)}%)` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </GlassView>
      )}

      {categorySegments.length > 0 && (
        <GlassView style={styles.chartCard}>
          <Text style={styles.chartTitle}>Shpenzimet sipas kategorisë</Text>
          <View style={styles.chartRow}>
            <PieChart
              segments={categorySegments.map((segment) => ({
                label: segment.label,
                value: segment.total,
                color: segment.color,
              }))}
              size={160}
            />
            <View style={styles.legend}>
              {categorySegments.map((segment) => (
                <View key={segment.label} style={styles.legendRow}>
                  <View style={[styles.legendSwatch, { backgroundColor: segment.color }]} />
                  <View style={styles.legendTextGroup}>
                    <Text style={styles.legendLabel}>{segment.label}</Text>
                    <Text style={styles.legendValue}>
                      {formatAmount(segment.total)}
                      {categoryChartTotal > 0 ? ` (${Math.round((segment.total / categoryChartTotal) * 100)}%)` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </GlassView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    gap: 16,
  },
  budgetCard: {
    padding: 20,
  },
  budgetAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 4,
  },
  budgetTarget: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  budgetProgressWrapper: {
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 40,
  },
  chartCard: {
    padding: 20,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendTextGroup: {
    flex: 1,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    textTransform: 'capitalize',
  },
  legendValue: {
    fontSize: 12,
    color: '#6b7280',
  },
});
