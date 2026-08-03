import { CheckIcon, PencilSimpleIcon } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useToasts } from '../hooks/useToasts';
import {
  fetchBudget,
  resolveAllocationAmount,
  setBudget as saveBudget,
  type BudgetCategoryAllocation,
} from '../lib/budgetApi';
import { CATEGORIES, categoryIcon, categoryLabelKey, type CategoryId } from '../lib/categories';
import { currentMonthCategoryTotals } from '../lib/categorySpending';
import { formatAmount, formatAmountInput, parseAmountInput } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import { currentMonthTotal } from '../lib/monthlySpending';
import type { SavedInvoice } from '../lib/savedInvoicesApi';
import { colors } from '../lib/theme';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ProgressBar } from './ProgressBar';
import { ToastHost } from './ToastHost';

type BudgetScreenProps = {
  invoices: SavedInvoice[];
};

type AllocationDraft = { mode: 'percent' | 'amount'; value: string };

function emptyAllocations(): Record<CategoryId, AllocationDraft> {
  const drafts = {} as Record<CategoryId, AllocationDraft>;
  for (const category of CATEGORIES) {
    drafts[category.id] = { mode: 'percent', value: '' };
  }
  return drafts;
}

function formatAmountDisplay(value: number): string {
  return formatAmount(value).replace(/,00$/, '');
}

export function BudgetScreen({ invoices }: BudgetScreenProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [allocations, setAllocations] = useState<Record<CategoryId, AllocationDraft>>(emptyAllocations());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCategoryIds, setEditingCategoryIds] = useState<Set<CategoryId>>(new Set());
  const { toasts, showError, dismissToast } = useToasts();

  useEffect(() => {
    fetchBudget()
      .then((budget) => {
        setTarget(budget?.amount ?? null);
        setInput(budget ? formatAmountDisplay(budget.amount) : '');
        if (budget?.categoryAllocations) {
          const categoryAllocations = budget.categoryAllocations;
          setAllocations((current) => {
            const next = { ...current };
            for (const [categoryId, allocation] of Object.entries(categoryAllocations)) {
              if (categoryId in next) {
                next[categoryId as CategoryId] = {
                  mode: allocation.mode,
                  value:
                    allocation.mode === 'percent' ? String(allocation.value) : formatAmountDisplay(allocation.value),
                };
              }
            }
            return next;
          });
        }
        setIsLoading(false);
      })
      .catch((error: Error) => {
        setIsLoading(false);
        showError(error.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spent = currentMonthTotal(invoices);
  const targetAmount = target ?? 0;
  const ratio = target && target > 0 ? spent / target : 0;
  const categoryTotals = currentMonthCategoryTotals(invoices);
  const spentByCategory = new Map(categoryTotals.map((entry) => [entry.key, entry.total]));

  const parsedAllocations = {} as Record<CategoryId, BudgetCategoryAllocation>;
  for (const category of CATEGORIES) {
    const draft = allocations[category.id];
    const numericValue =
      draft.mode === 'percent' ? Number(draft.value.replace(/[^0-9.]/g, '')) : parseAmountInput(draft.value);
    parsedAllocations[category.id] = { mode: draft.mode, value: Number.isFinite(numericValue) ? numericValue : 0 };
  }

  const totalAllocated = CATEGORIES.reduce(
    (sum, category) => sum + resolveAllocationAmount(parsedAllocations[category.id], targetAmount),
    0,
  );
  const unallocated = targetAmount - totalAllocated;

  const setAllocationMode = (categoryId: CategoryId, mode: 'percent' | 'amount') => {
    setAllocations((current) => ({ ...current, [categoryId]: { mode, value: '' } }));
  };

  const setAllocationValue = (categoryId: CategoryId, rawValue: string) => {
    setAllocations((current) => {
      const draft = current[categoryId];
      const value = draft.mode === 'percent' ? rawValue.replace(/[^0-9]/g, '') : formatAmountInput(rawValue);
      return { ...current, [categoryId]: { ...draft, value } };
    });
  };

  const persistBudget = (onSuccess: () => void) => {
    const amount = parseAmountInput(input);
    if (!Number.isFinite(amount) || amount < 0) {
      showError(t('budget.invalidAmount'));
      return;
    }
    const categoryAllocations: Record<string, BudgetCategoryAllocation> = {};
    for (const category of CATEGORIES) {
      const allocation = parsedAllocations[category.id];
      if (allocation.value > 0) {
        categoryAllocations[category.id] = allocation;
      }
    }
    setIsSaving(true);
    saveBudget(amount, Object.keys(categoryAllocations).length > 0 ? categoryAllocations : null)
      .then((budget) => {
        setIsSaving(false);
        setTarget(budget.amount);
        setInput(formatAmountDisplay(budget.amount));
        onSuccess();
      })
      .catch((error: Error) => {
        setIsSaving(false);
        showError(error.message);
      });
  };

  const handleSave = () => {
    persistBudget(() => setEditingCategoryIds(new Set()));
  };

  const startEditingCategory = (categoryId: CategoryId) => {
    setEditingCategoryIds((current) => new Set(current).add(categoryId));
  };

  const handleSaveCategory = (categoryId: CategoryId) => {
    persistBudget(() => {
      setEditingCategoryIds((current) => {
        const next = new Set(current);
        next.delete(categoryId);
        return next;
      });
    });
  };

  return (
    <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} bottomOffset={20}>
      <Text style={styles.title}>{t('budget.title')}</Text>

      {!isLoading && target !== null && (
        <GlassView style={styles.card}>
          <Text style={styles.cardLabel}>{t('budget.thisMonth')}</Text>
          <Text style={styles.amountText}>
            {formatAmountDisplay(spent)}{' '}
            <Text style={styles.amountTarget}>
              {t('budget.of')} {formatAmountDisplay(target)}
            </Text>
          </Text>
          <View style={styles.progressWrapper}>
            <ProgressBar ratio={ratio} />
          </View>
          <Text style={styles.percentText}>{t('budget.percentOfBudget', { percent: Math.round(ratio * 100) })}</Text>
        </GlassView>
      )}

      <GlassView style={styles.card}>
        <Text style={styles.cardLabel}>{target !== null ? t('budget.editBudget') : t('budget.setMonthlyBudget')}</Text>
        <GlassTextInput
          style={styles.input}
          placeholder={t('budget.amountPlaceholder')}
          keyboardType="numeric"
          value={input}
          onChangeText={(value) => setInput(formatAmountInput(value))}
        />

        <View style={styles.categorySectionHeader}>
          <View style={styles.categorySectionHeaderText}>
            <Text style={styles.sectionLabel}>{t('budget.splitByCategory')}</Text>
            <Text style={styles.sectionHint}>{t('budget.categoryAllocationHint')}</Text>
          </View>
        </View>

        <View style={styles.categoryGrid}>
          {CATEGORIES.map((category) => {
            const draft = allocations[category.id];
            const allocation = parsedAllocations[category.id];
            const resolvedAmount = resolveAllocationAmount(allocation, parseAmountInput(input) || 0);
            const categorySpent = spentByCategory.get(category.id) ?? 0;
            const categoryRatio = resolvedAmount > 0 ? categorySpent / resolvedAmount : 0;
            const isEditingCategory = editingCategoryIds.has(category.id);
            const CategoryIcon = categoryIcon(category.id);

            return (
              <View key={category.id} style={styles.categoryCube}>
                <Pressable
                  style={styles.categoryEditButton}
                  onPress={() =>
                    isEditingCategory ? handleSaveCategory(category.id) : startEditingCategory(category.id)
                  }
                  disabled={isSaving}
                >
                  {isEditingCategory ? (
                    <CheckIcon size={14} weight="bold" color={colors.primary} />
                  ) : (
                    <PencilSimpleIcon size={14} color={colors.primary} />
                  )}
                </Pressable>

                <CategoryIcon size={32} color={colors.primary} />
                <Text style={styles.categoryLabel} numberOfLines={1}>
                  {t(categoryLabelKey(category.id))}
                </Text>

                {isEditingCategory ? (
                  <View style={styles.categoryInputRow}>
                    <GlassTextInput
                      style={styles.categoryInput}
                      placeholder={draft.mode === 'percent' ? '0%' : t('budget.amountPlaceholder')}
                      keyboardType="numeric"
                      value={draft.value}
                      onChangeText={(value) => setAllocationValue(category.id, value)}
                    />

                    <View style={styles.modeToggle}>
                      <Pressable
                        style={[styles.modeOption, draft.mode === 'percent' && styles.modeOptionActive]}
                        onPress={() => setAllocationMode(category.id, 'percent')}
                      >
                        <Text
                          style={[styles.modeOptionText, draft.mode === 'percent' && styles.modeOptionTextActive]}
                        >
                          %
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.modeOption, draft.mode === 'amount' && styles.modeOptionActive]}
                        onPress={() => setAllocationMode(category.id, 'amount')}
                      >
                        <Text style={[styles.modeOptionText, draft.mode === 'amount' && styles.modeOptionTextActive]}>
                          {t('budget.amountMode')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    {resolvedAmount > 0 ? (
                      <Text style={styles.categoryResolved} numberOfLines={1}>
                        {formatAmountDisplay(resolvedAmount)}
                      </Text>
                    ) : (
                      <Text style={styles.categoryNotDefined} numberOfLines={1}>
                        {t('budget.notDefined')}
                      </Text>
                    )}

                    {resolvedAmount > 0 && (
                      <View style={styles.categoryProgressWrapper}>
                        <ProgressBar ratio={categoryRatio} height={6} />
                        <Text style={styles.categorySpentText} numberOfLines={1}>
                          {formatAmountDisplay(categorySpent)} {t('budget.of')} {formatAmountDisplay(resolvedAmount)}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.allocationSummary}>
          <Text style={styles.allocationSummaryText}>
            {t('budget.allocated', { amount: formatAmountDisplay(totalAllocated) })}
          </Text>
          <Text style={[styles.allocationSummaryText, unallocated < 0 && styles.allocationSummaryWarning]}>
            {unallocated >= 0
              ? t('budget.unallocated', { amount: formatAmountDisplay(unallocated) })
              : t('budget.overAllocatedBy', { amount: formatAmountDisplay(Math.abs(unallocated)) })}
          </Text>
        </View>

        <GlassButton
          label={isSaving ? t('common.saving') : t('common.save')}
          variant="accent"
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isSaving}
        />
      </GlassView>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </KeyboardAwareScrollView>
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  card: {
    padding: 20,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  amountText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  amountTarget: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
  },
  progressWrapper: {
    marginTop: 14,
  },
  percentText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  input: {
    marginBottom: 12,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  categorySectionHeaderText: {
    flex: 1,
  },
  sectionLabel: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  sectionHint: {
    marginTop: 2,
    marginBottom: 14,
    fontSize: 12,
    color: '#6b7280',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCube: {
    position: 'relative',
    width: '47%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
    backgroundColor: colors.primaryTint,
    borderRadius: 16,
  },
  categoryEditButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
    zIndex: 1,
  },
  categoryLabel: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  categoryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  modeToggle: {
    flexDirection: 'column',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  modeOption: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
  },
  modeOptionActive: {
    backgroundColor: '#ffffff',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
  },
  modeOptionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  modeOptionTextActive: {
    color: colors.primary,
  },
  categoryInput: {
    flex: 1,
    marginBottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    textAlign: 'center',
  },
  categoryResolved: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  categoryNotDefined: {
    marginTop: 8,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#9ca3af',
    textAlign: 'center',
  },
  categoryProgressWrapper: {
    width: '100%',
    marginTop: 10,
  },
  categorySpentText: {
    marginTop: 4,
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  allocationSummary: {
    marginTop: 4,
    marginBottom: 16,
    gap: 4,
  },
  allocationSummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  allocationSummaryWarning: {
    color: '#dc2626',
  },
  saveButton: {
    marginTop: 0,
  },
});
