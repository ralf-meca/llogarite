import { CheckIcon, PencilSimpleIcon } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
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
    drafts[category.id] = { mode: 'amount', value: '' };
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
  // The categories are edited all together or not at all.
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const categoryInputs = useRef<Partial<Record<CategoryId, TextInput | null>>>({});
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
    // Saving ends the typing: the keyboard goes and the field gives up its cursor,
    // which the list would otherwise leave where it was.
    Keyboard.dismiss();
    persistBudget(() => setIsEditingCategories(false));
  };

  // Named rather than left to autoFocus, which would hand the keyboard to
  // whichever input mounted last instead of the first card.
  const focusCategory = (categoryId: CategoryId) => {
    // A frame past the mount. Focus asked for during it is dropped.
    setTimeout(() => categoryInputs.current[categoryId]?.focus(), 80);
  };

  // One control for the whole list: a pass over all the categories is nearly always
  // what is wanted, and a pencil on every row was eight ways of starting it.
  const handleEditAll = () => {
    setIsEditingCategories(true);
    focusCategory(CATEGORIES[0].id);
  };

  // The card of this month's spending is only there once a budget is set, which moves
  // the heading that is to stay in view one place down the list.
  const showsThisMonth = !isLoading && target !== null;

  // Whether the amount in the field is a real one and not the one already saved.
  const typedBudget = parseAmountInput(input);
  const isBudgetDirty = input.trim() !== '' && Number.isFinite(typedBudget) && typedBudget !== target;

  // The categories' heading stays in view while they scroll. It is a second copy laid
  // over the top of the list rather than the scroll view's own pinned header: on
  // Android a pinned header is drawn in its new place but goes on being touched in
  // its old one, so its button stopped answering once the list had moved.
  const [headerTop, setHeaderTop] = useState<number | null>(null);
  const [isHeaderPinned, setIsHeaderPinned] = useState(false);

  const sectionRow = (
    <View style={styles.categorySectionRow}>
      <Text style={styles.sectionLabel} numberOfLines={1}>
        {t('budget.splitByCategory')}
      </Text>
      {isEditingCategories ? (
        <Pressable
          style={[styles.sectionButton, styles.sectionButtonFilled, isSaving && styles.sectionButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          hitSlop={8}
        >
          <CheckIcon size={16} weight="bold" color={colors.white} />
          <Text style={[styles.sectionButtonText, styles.sectionButtonTextFilled]}>
            {isSaving ? t('common.saving') : t('common.save')}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.sectionButton}
          onPress={handleEditAll}
          hitSlop={8}
          accessibilityLabel={t('budget.editAll')}
        >
          <PencilSimpleIcon size={16} weight="bold" color={colors.primary} />
          <Text style={styles.sectionButtonText}>{t('budget.edit')}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={(event) => {
        const isPast = headerTop !== null && event.nativeEvent.contentOffset.y >= headerTop;
        if (isPast !== isHeaderPinned) {
          setIsHeaderPinned(isPast);
        }
      }}
    >
      <Text style={styles.title}>{t('budget.title')}</Text>

      {showsThisMonth && (
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
        {/* Only once the amount differs from the one saved: until then there is
            nothing here to save, and the categories have a save of their own. */}
        {isBudgetDirty && (
          <GlassButton
            label={isSaving ? t('common.saving') : t('common.save')}
            variant="accent"
            style={styles.saveButton}
            onPress={handleSave}
            disabled={isSaving}
          />
        )}
      </GlassView>

      {/* Stays at the top while the categories scroll under it, so the way into
          editing them - and, while editing, the way to save - is always in reach. */}
      {/* Where the heading sits in the list. Once it has scrolled off the top, the copy
          outside the scroll view takes over. */}
      <View style={styles.categorySectionHeader} onLayout={(event) => setHeaderTop(event.nativeEvent.layout.y)}>
        {sectionRow}
      </View>

      <View>
        <Text style={styles.sectionHint}>{t('budget.categoryAllocationHint')}</Text>

        <View style={styles.categoryGrid}>
          {CATEGORIES.map((category, index) => {
            const draft = allocations[category.id];
            const allocation = parsedAllocations[category.id];
            const resolvedAmount = resolveAllocationAmount(allocation, parseAmountInput(input) || 0);
            const categorySpent = spentByCategory.get(category.id) ?? 0;
            const categoryRatio = resolvedAmount > 0 ? categorySpent / resolvedAmount : 0;
            const isEditingCategory = isEditingCategories;
            // The keyboard's next key walks the rows in order; only the last offers done.
            const nextEditingId = CATEGORIES[index + 1]?.id;
            const CategoryIcon = categoryIcon(category.id);

            return (
              // One category to a row: its icon, then its name with what is set aside
              // for it, and under those how much of that is already spent.
              <View key={category.id} style={styles.categoryRow}>
                <View style={styles.categoryIconWrap}>
                  <CategoryIcon size={22} color={colors.primary} />
                </View>

                <View style={styles.categoryBody}>
                  <View style={styles.categoryTopLine}>
                    <Text style={styles.categoryLabel} numberOfLines={1}>
                      {t(categoryLabelKey(category.id))}
                    </Text>

                    {!isEditingCategory && (
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
                      </>
                    )}
                  </View>

                  {/* The field sits under the name, with the row's whole width to itself. */}
                  {isEditingCategory && (
                    <View style={styles.categoryInputRow}>
                      <GlassTextInput
                        style={styles.categoryInput}
                        placeholder={draft.mode === 'percent' ? '0%' : t('budget.amountPlaceholder')}
                        keyboardType="numeric"
                        value={draft.value}
                        onChangeText={(value) => setAllocationValue(category.id, value)}
                        ref={(node) => {
                          categoryInputs.current[category.id] = node;
                        }}
                        returnKeyType={nextEditingId ? 'next' : 'done'}
                        // Keeps the keyboard up between rows; without it every
                        // hop closes and reopens it.
                        submitBehavior={nextEditingId ? 'submit' : 'blurAndSubmit'}
                        onSubmitEditing={() =>
                          nextEditingId ? categoryInputs.current[nextEditingId]?.focus() : handleSave()
                        }
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
                          <Text
                            style={[styles.modeOptionText, draft.mode === 'amount' && styles.modeOptionTextActive]}
                          >
                            {t('budget.amountMode')}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {!isEditingCategory && resolvedAmount > 0 && (
                    <View style={styles.categoryProgressWrapper}>
                      <ProgressBar ratio={categoryRatio} height={6} />
                      <View style={styles.categorySpentLine}>
                        <Text style={styles.categorySpentText} numberOfLines={1}>
                          {formatAmountDisplay(categorySpent)} {t('budget.of')} {formatAmountDisplay(resolvedAmount)}
                        </Text>
                        <Text style={styles.categorySpentText}>{Math.round(categoryRatio * 100)}%</Text>
                      </View>
                    </View>
                  )}
                </View>
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
      </View>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </KeyboardAwareScrollView>

    {isHeaderPinned && <View style={[styles.categorySectionHeader, styles.pinnedHeader]}>{sectionRow}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 12,
  },
  scroll: {
    flex: 1,
  },
  // Over the top edge of the list, with a line under it to part it from the rows.
  pinnedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    marginBottom: 0,
  },
  // Reaches both edges of the screen and is opaque, so the rows passing under it
  // while it is held at the top do not show through.
  categorySectionHeader: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  categorySectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    backgroundColor: colors.primaryTint,
  },
  sectionButtonFilled: {
    backgroundColor: colors.primary,
  },
  sectionButtonDisabled: {
    opacity: 0.6,
  },
  sectionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  sectionButtonTextFilled: {
    color: colors.white,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },
  sectionHint: {
    marginBottom: 14,
    fontSize: 12,
    color: '#6b7280',
  },
  categoryGrid: {
    gap: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.primaryTint,
    borderRadius: 16,
  },
  categoryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  categoryBody: {
    flex: 1,
  },
  // Name on the left taking the slack; the amount, or the field for it, on the right.
  categoryTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 30,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  modeOption: {
    minWidth: 30,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  modeOptionActive: {
    backgroundColor: '#ffffff',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
  },
  modeOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  modeOptionTextActive: {
    color: colors.primary,
  },
  categoryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  categoryInput: {
    flex: 1,
    marginBottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  categoryResolved: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  categoryNotDefined: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#9ca3af',
  },
  categoryProgressWrapper: {
    marginTop: 8,
  },
  categorySpentLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  categorySpentText: {
    fontSize: 11,
    color: '#6b7280',
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
    marginTop: 14,
  },
});
