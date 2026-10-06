import { ArrowDownLeftIcon, ArrowUpRightIcon, CaretRightIcon } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { allBuddyInvoiceShares, owedByMeShares } from '../lib/buddyExpenses';
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
import { fetchOwedInvoices, type OwedInvoice, type SavedInvoice } from '../lib/savedInvoicesApi';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';
import { LineChart } from './LineChart';

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((category) => category.id));
const CHART_WIDTH = Dimensions.get('window').width - 88;
const TOP_CATEGORIES = 5;
const RECENT_INVOICES = 5;
const TREND_MONTHS = 8;
// Money coming in, money going out.
const DEBT_IN_COLOR = '#10b981';
const DEBT_OUT_COLOR = '#ef4444';

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

// What the buddies card was last built from, kept between visits to this screen. The
// card only exists once its figures are known, so without this it dropped into the
// page a moment after everything else on every visit, pushing the rest down.
let lastDebts: { userId: string; buddies: Buddy[]; owedInvoices: OwedInvoice[] } | null = null;

const BAR_GROW_MS = 1100;
const BAR_STAGGER_MS = 130;

// How long the monthly line takes to draw itself, and how much of its card has to be
// on screen before it starts.
const CHART_DRAW_MS = 1400;
const CHART_VISIBLE_MARGIN = 120;

// A bar growing out to its share from the left, after an optional wait - the category
// bars each start a beat after the one above. Grows again from where it stands when
// the share changes.
function GrowingBar({ percent, delay = 0, style }: { percent: number; delay?: number; style: StyleProp<ViewStyle> }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, {
      toValue: percent,
      duration: BAR_GROW_MS,
      delay,
      easing: Easing.out(Easing.cubic),
      // Width is a layout property, which the native driver cannot animate.
      useNativeDriver: false,
    }).start();
  }, [percent, delay, width]);

  return (
    <Animated.View
      style={[style, { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}
    />
  );
}

type DashboardScreenProps = {
  invoices: SavedInvoice[];
  userId: string;
  // Opens the buddies screen on the side that was tapped.
  onSelectBuddies: (tab: 'owedToMe' | 'owedByMe') => void;
  // Pulled down on: fetches the invoices again, resolving once they are in.
  onRefresh: () => Promise<void>;
  onSelectBudget: () => void;
  onSelectInvoiceList: () => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectInvoice?: (invoice: SavedInvoice) => void;
};

export function DashboardScreen({
  invoices,
  userId,
  onSelectBuddies,
  onRefresh,
  onSelectBudget,
  onSelectInvoiceList,
  onSelectCategory,
  onSelectInvoice,
}: DashboardScreenProps) {
  const { t, language } = useTranslation();
  const [budgetTarget, setBudgetTarget] = useState<number | null>(null);

  // Bumped by a pull down, so what this screen fetches for itself is fetched again too.
  const [refreshCount, setRefreshCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshCount((count) => count + 1);
    // The buddies' figures follow by themselves: they are fetched whenever the invoices change.
    onRefresh().finally(() => setIsRefreshing(false));
  };

  useEffect(() => {
    fetchBudget()
      .then((budget) => setBudgetTarget(budget?.amount ?? null))
      .catch(() => setBudgetTarget(null));
  }, [refreshCount]);

  // The monthly line draws itself from left to right, the first time its card comes
  // far enough up the screen to be seen - not while it is still below the fold.
  const chartReveal = useRef(new Animated.Value(0)).current;
  const hasChartDrawn = useRef(false);
  const viewportHeight = useRef(0);
  const scrollOffset = useRef(0);
  const chartTop = useRef<number | null>(null);
  const drawChartIfVisible = () => {
    if (hasChartDrawn.current || chartTop.current === null || viewportHeight.current === 0) {
      return;
    }
    if (scrollOffset.current + viewportHeight.current < chartTop.current + CHART_VISIBLE_MARGIN) {
      return;
    }
    hasChartDrawn.current = true;
    Animated.timing(chartReveal, {
      toValue: CHART_WIDTH,
      duration: CHART_DRAW_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  // What is still open between the reader and their buddies. Quietly absent if it
  // cannot be loaded: the buddies screen is where a failure gets reported.
  const remembered = lastDebts?.userId === userId ? lastDebts : null;
  const [buddies, setBuddies] = useState<Buddy[]>(remembered?.buddies ?? []);
  const [owedInvoices, setOwedInvoices] = useState<OwedInvoice[]>(remembered?.owedInvoices ?? []);
  useEffect(() => {
    let isCurrent = true;
    Promise.all([fetchBuddies(), fetchOwedInvoices()])
      .then(([buddyList, owed]) => {
        lastDebts = { userId, buddies: buddyList, owedInvoices: owed };
        if (isCurrent) {
          setBuddies(buddyList);
          setOwedInvoices(owed);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [invoices, userId]);

  const owedToMe = useMemo(
    () =>
      allBuddyInvoiceShares(invoices, buddies)
        .filter((share) => !share.paid)
        .reduce((sum, share) => sum + share.share, 0),
    [invoices, buddies],
  );
  const owedByMe = useMemo(
    () =>
      owedByMeShares(owedInvoices, userId)
        .filter((share) => !share.paid)
        .reduce((sum, share) => sum + share.share, 0),
    [owedInvoices, userId],
  );
  const hasOpenDebts = owedToMe > 0 || owedByMe > 0;

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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      scrollEventThrottle={32}
      onLayout={(event) => {
        viewportHeight.current = event.nativeEvent.layout.height;
        drawChartIfVisible();
      }}
      onScroll={(event) => {
        scrollOffset.current = event.nativeEvent.contentOffset.y;
        drawChartIfVisible();
      }}
    >
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
              <GrowingBar percent={Math.round(budgetRatio * 100)} style={styles.spendFill} />
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

      {/* Only when something is open either way: a card of two zeroes says nothing. */}
      {hasOpenDebts && (
        <GlassView style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{t('dashboard.buddies')}</Text>
            <Pressable
              onPress={() => onSelectBuddies(owedToMe > 0 ? 'owedToMe' : 'owedByMe')}
              hitSlop={8}
              style={styles.viewAll}
            >
              <Text style={styles.viewAllText}>{t('dashboard.viewAllBuddies')}</Text>
              <CaretRightIcon size={12} color={colors.primary} weight="bold" />
            </Pressable>
          </View>
          <View style={styles.debtRow}>
            <Pressable
              style={({ pressed }) => [styles.debtCell, pressed && styles.categoryRowPressed]}
              onPress={() => onSelectBuddies('owedToMe')}
            >
              <View style={styles.debtLabelRow}>
                <ArrowDownLeftIcon size={12} color={DEBT_IN_COLOR} weight="bold" />
                <Text style={styles.debtLabel}>{t('dashboard.buddiesOwedToMe')}</Text>
              </View>
              <Text style={[styles.trendValue, { color: DEBT_IN_COLOR }]} numberOfLines={1}>
                {formatAmountLoose(owedToMe)}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.debtCell, pressed && styles.categoryRowPressed]}
              onPress={() => onSelectBuddies('owedByMe')}
            >
              <View style={styles.debtLabelRow}>
                <ArrowUpRightIcon size={12} color={DEBT_OUT_COLOR} weight="bold" />
                <Text style={styles.debtLabel}>{t('dashboard.buddiesOwedByMe')}</Text>
              </View>
              <Text style={[styles.trendValue, { color: DEBT_OUT_COLOR }]} numberOfLines={1}>
                {formatAmountLoose(owedByMe)}
              </Text>
            </Pressable>
          </View>
        </GlassView>
      )}

      {invoices.length === 0 ? (
        <Text style={styles.emptyText}>{t('dashboard.noInvoicesForStats')}</Text>
      ) : (
        <>
          {topCategories.length > 0 && (
            <GlassView style={styles.card}>
              <Text style={styles.cardTitle}>{t('dashboard.spendingByCategory')}</Text>
              {topCategories.map((entry, index) => {
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
                      <GrowingBar
                        percent={Math.max(2, Math.round(share * 100))}
                        delay={index * BAR_STAGGER_MS}
                        style={[styles.categoryFill, { backgroundColor: tint }]}
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

          <View
            onLayout={(event) => {
              chartTop.current = event.nativeEvent.layout.y;
              drawChartIfVisible();
            }}
          >
          <GlassView style={styles.card}>
            <Text style={styles.cardTitle}>{t('dashboard.spendingByMonth')}</Text>
            <View style={styles.lineChartWrapper}>
              {/* A window onto the chart that widens from the left, so the line appears
                  to be drawn. The chart itself keeps its full width throughout. */}
              <View style={styles.chartFrame}>
                <Animated.View style={[styles.chartWindow, { width: chartReveal }]}>
                  <View style={styles.chartFrame}>
                    <LineChart points={monthlyPoints} width={CHART_WIDTH} height={160} />
                  </View>
                </Animated.View>
              </View>
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
                  style={[styles.trendValue, { color: trendPercent !== null && trendPercent > 0 ? '#dc2626' : '#059669' }]}
                  numberOfLines={1}
                >
                  {trendPercent === null ? '—' : `${trendPercent > 0 ? '↑' : '↓'} ${Math.abs(trendPercent)}%`}
                </Text>
                <Text style={styles.trendLabel}>{t('dashboard.trend')}</Text>
              </View>
            </View>
          </GlassView>
          </View>
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
  chartFrame: {
    width: CHART_WIDTH,
  },
  chartWindow: {
    overflow: 'hidden',
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
  debtRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  debtCell: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.neutral,
  },
  debtLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  debtLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    color: colors.textMuted,
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
