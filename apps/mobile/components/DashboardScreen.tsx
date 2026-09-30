import { CaretRightIcon } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchBudget } from '../lib/budgetApi';
import { CATEGORIES, categoryColor, categoryIcon, categoryLabelKey, categoryPlaceKey } from '../lib/categories';
import { currentMonthCategoryTotals, dominantCategory } from '../lib/categorySpending';
import { formatAmountLoose } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import {
  averageMonthlyThisYear,
  currentMonthKey,
  currentMonthTotal,
  groupByMonth,
  monthKeyOf,
} from '../lib/monthlySpending';
import type { SavedInvoice } from '../lib/savedInvoicesApi';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';
import { LineChart } from './LineChart';

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((category) => category.id));
const CHART_WIDTH = Dimensions.get('window').width - 88;
const TOP_CATEGORIES = 5;
const RECENT_INVOICES = 5;
const TREND_MONTHS = 8;

// Today counts: on the 1st you have spent a day's worth, not nothing.
function daysElapsedInMonth(): number {
  return new Date().getDate();
}

function daysLeftInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, lastDay - now.getDate() + 1);
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

type DashboardScreenProps = {
  invoices: SavedInvoice[];
  onSelectBudget: () => void;
  onSelectInvoiceList: () => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectInvoice?: (invoice: SavedInvoice) => void;
};

export function DashboardScreen({
  invoices,
  onSelectBudget,
  onSelectInvoiceList,
  onSelectCategory,
  onSelectInvoice,
}: DashboardScreenProps) {
  const { t, language } = useTranslation();
  const [budgetTarget, setBudgetTarget] = useState<number | null>(null);

  useEffect(() => {
    fetchBudget()
      .then((budget) => setBudgetTarget(budget?.amount ?? null))
      .catch(() => setBudgetTarget(null));
  }, []);

  const monthSpent = currentMonthTotal(invoices);
  const hasBudget = budgetTarget !== null && budgetTarget > 0;
  const budgetRatio = hasBudget ? Math.min(1, monthSpent / (budgetTarget as number)) : 0;
  const remaining = hasBudget ? Math.max(0, (budgetTarget as number) - monthSpent) : 0;
  const daysLeft = daysLeftInMonth();
  const daysElapsed = daysElapsedInMonth();

  const savedThisMonth = invoices.filter(
    (invoice) => monthKeyOf(invoice.data.dateTimeCreated) === currentMonthKey(),
  ).length;

  const months = [...groupByMonth(invoices, language)].sort((a, b) => (a.key < b.key ? -1 : 1));
  const monthlyPoints = months
    .slice(-TREND_MONTHS)
    .map((entry) => ({ label: entry.label, value: entry.total }));

  // Trend compares the two most recent months that actually have data.
  const previousMonthTotal = months.length > 1 ? months[months.length - 2].total : 0;
  const latestMonthTotal = months.length > 0 ? months[months.length - 1].total : 0;
  const trendPercent =
    previousMonthTotal > 0
      ? Math.round(((latestMonthTotal - previousMonthTotal) / previousMonthTotal) * 100)
      : null;

  // Scoped to the current month so the breakdown agrees with the spend card
  // above it, which is monthly.
  const categoryTotals = currentMonthCategoryTotals(invoices);
  const categoryGrandTotal = categoryTotals.reduce((sum, entry) => sum + entry.total, 0);
  const topCategories = categoryTotals.slice(0, TOP_CATEGORIES);

  const recent = [...invoices]
    .sort((a, b) => (a.data.dateTimeCreated < b.data.dateTimeCreated ? 1 : -1))
    .slice(0, RECENT_INVOICES);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Pressable onPress={onSelectBudget}>
        <View style={styles.spendCard}>
          <Text style={styles.spendAmount}>{formatAmountLoose(monthSpent)}</Text>
          <Text style={styles.spendMeta}>
            {hasBudget
              ? t('dashboard.budgetMeta', {
                  target: formatAmountLoose(budgetTarget as number),
                  percent: Math.round(budgetRatio * 100),
                  // The last day is worth naming: "1 day left" is both wrong
                  // in Albanian, which wants the singular, and less useful
                  // than saying which day it is.
                  days:
                    daysLeft === 1
                      ? t('dashboard.lastDayOfMonth')
                      : t('dashboard.daysLeft', { days: daysLeft }),
                })
              : t('dashboard.spentNoBudget')}
          </Text>
          {hasBudget && (
            <View style={styles.spendTrack}>
              <View style={[styles.spendFill, { width: `${Math.round(budgetRatio * 100)}%` }]} />
            </View>
          )}
        </View>
      </Pressable>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.primary }]} numberOfLines={1}>
            {hasBudget ? formatAmountLoose(remaining) : '—'}
          </Text>
          <Text style={styles.statLabel}>{t('dashboard.remaining')}</Text>
        </View>
        <View style={styles.statCard}>
          {/* What has been spent per day, not what is left to spend per day.
              The budget bar above already answers the second, and the second
              read as the first anyway - on the last of the month it equalled
              the remaining balance exactly, since there was one day to divide
              by. Needs no budget set, unlike everything beside it. */}
          <Text style={[styles.statValue, { color: '#F093FB' }]} numberOfLines={1}>
            {formatAmountLoose(monthSpent / daysElapsed)}
          </Text>
          <Text style={styles.statLabel}>{t('dashboard.perDay')}</Text>
        </View>
        <Pressable style={styles.statCard} onPress={onSelectInvoiceList}>
          <Text style={[styles.statValue, { color: '#4FACFE' }]} numberOfLines={1}>
            {savedThisMonth}
          </Text>
          <Text style={styles.statLabel}>{t('dashboard.invoicesShort')}</Text>
        </Pressable>
      </View>

      {invoices.length === 0 ? (
        <Text style={styles.emptyText}>{t('dashboard.noInvoicesForStats')}</Text>
      ) : (
        <>
          {topCategories.length > 0 && (
            <GlassView style={styles.card}>
              <Text style={styles.cardTitle}>{t('dashboard.spendingByCategory')}</Text>
              {topCategories.map((entry) => {
                const share = categoryGrandTotal > 0 ? entry.total / categoryGrandTotal : 0;
                const tint = categoryColor(entry.key);
                const label = CATEGORY_IDS.has(entry.key)
                  ? t(categoryLabelKey(entry.key))
                  : entry.label;
                return (
                  <Pressable
                    key={entry.key}
                    style={({ pressed }) => [styles.categoryRow, pressed && styles.categoryRowPressed]}
                    onPress={() => onSelectCategory(entry.key)}
                  >
                    <View style={styles.categoryHeader}>
                      <View style={[styles.categoryDot, { backgroundColor: tint }]} />
                      <Text style={styles.categoryLabel} numberOfLines={1}>
                        {label}
                      </Text>
                      <Text style={styles.categoryPercent}>{Math.round(share * 100)}%</Text>
                      <Text style={styles.categoryAmount}>{formatAmountLoose(entry.total)}</Text>
                    </View>
                    <View style={styles.categoryTrack}>
                      <View
                        style={[
                          styles.categoryFill,
                          { width: `${Math.max(2, Math.round(share * 100))}%`, backgroundColor: tint },
                        ]}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </GlassView>
          )}

          {recent.length > 0 && (
            <GlassView style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{t('dashboard.recentInvoices')}</Text>
                <Pressable onPress={onSelectInvoiceList} hitSlop={8} style={styles.viewAll}>
                  <Text style={styles.viewAllText}>{t('dashboard.viewAll')}</Text>
                  <CaretRightIcon size={12} color={colors.primary} weight="bold" />
                </Pressable>
              </View>
              {recent.map((invoice) => {
                const category = dominantCategory(invoice);
                const Icon = categoryIcon(category);
                return (
                  <Pressable
                    key={invoice.id}
                    style={styles.invoiceRow}
                    onPress={() => onSelectInvoice?.(invoice)}
                  >
                    <View style={[styles.invoiceIcon, { backgroundColor: categoryColor(category) }]}>
                      <Icon size={20} color={colors.white} weight="fill" />
                    </View>
                    <View style={styles.invoiceText}>
                      {/* Same stand-in as the saved list. The category is already
                          in hand here for the icon, so the row costs nothing extra. */}
                      <Text
                        style={[
                          styles.invoiceSeller,
                          !invoice.data.seller.name.trim() && styles.invoiceSellerFallback,
                        ]}
                        numberOfLines={1}
                      >
                        {invoice.data.seller.name.trim() || t(categoryPlaceKey(category))}
                      </Text>
                      <Text style={styles.invoiceMeta} numberOfLines={1}>
                        {shortDate(invoice.data.dateTimeCreated)} · {t(categoryLabelKey(category))}
                      </Text>
                    </View>
                    <Text style={styles.invoiceAmount}>{formatAmountLoose(invoice.data.totalPrice)}</Text>
                  </Pressable>
                );
              })}
            </GlassView>
          )}

          <GlassView style={styles.card}>
            <Text style={styles.cardTitle}>{t('dashboard.spendingByMonth')}</Text>
            <View style={styles.lineChartWrapper}>
              <LineChart points={monthlyPoints} width={CHART_WIDTH} height={160} />
            </View>
            <View style={styles.trendRow}>
              <View style={styles.trendCell}>
                <Text style={[styles.trendValue, { color: colors.primary }]} numberOfLines={1}>
                  {formatAmountLoose(averageMonthlyThisYear(invoices))}
                </Text>
                <Text style={styles.trendLabel}>{t('dashboard.yearlyAverage')}</Text>
              </View>
              <View style={styles.trendCell}>
                <Text
                  style={[styles.trendValue, { color: trendPercent !== null && trendPercent > 0 ? '#FA709A' : '#43E97B' }]}
                  numberOfLines={1}
                >
                  {trendPercent === null ? '—' : `${trendPercent > 0 ? '↑' : '↓'} ${Math.abs(trendPercent)}%`}
                </Text>
                <Text style={styles.trendLabel}>{t('dashboard.trend')}</Text>
              </View>
            </View>
          </GlassView>
        </>
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
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  spendCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  spendAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.white,
  },
  spendMeta: {
    fontSize: 11,
    marginTop: 2,
    color: colors.white,
    opacity: 0.85,
  },
  spendTrack: {
    height: 6,
    marginTop: 14,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  spendFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.neutral,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 9,
    marginTop: 2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 40,
  },
  card: {
    padding: 18,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  categoryRowPressed: {
    opacity: 0.6,
  },
  categoryRow: {
    marginTop: 14,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  categoryPercent: {
    fontSize: 11,
    color: colors.textMuted,
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  categoryTrack: {
    height: 6,
    marginTop: 6,
    borderRadius: 3,
    backgroundColor: colors.neutral,
    overflow: 'hidden',
  },
  categoryFill: {
    height: '100%',
    borderRadius: 3,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
  },
  invoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceText: {
    flex: 1,
  },
  invoiceSeller: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  // Muted, so a guessed place never reads as a name someone actually entered.
  invoiceSellerFallback: {
    color: colors.textMuted,
  },
  invoiceMeta: {
    fontSize: 9,
    marginTop: 1,
    color: colors.textMuted,
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  lineChartWrapper: {
    alignItems: 'center',
    marginTop: 12,
  },
  trendRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.neutral,
  },
  trendCell: {
    flex: 1,
  },
  trendValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  trendLabel: {
    fontSize: 9,
    marginTop: 2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
