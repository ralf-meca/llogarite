import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { fetchBudget, setBudget as saveBudget } from '../lib/budgetApi';
import { formatAmount, formatAmountInput, parseAmountInput } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import { currentMonthTotal } from '../lib/monthlySpending';
import type { SavedInvoice } from '../lib/savedInvoicesApi';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ProgressBar } from './ProgressBar';
import { ToastHost } from './ToastHost';

type BudgetScreenProps = {
  invoices: SavedInvoice[];
};

export function BudgetScreen({ invoices }: BudgetScreenProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toasts, showError, dismissToast } = useToasts();

  useEffect(() => {
    fetchBudget()
      .then((budget) => {
        setTarget(budget?.amount ?? null);
        setInput(budget ? formatAmount(budget.amount) : '');
        setIsLoading(false);
      })
      .catch((error: Error) => {
        setIsLoading(false);
        showError(error.message);
      });
  }, []);

  const spent = currentMonthTotal(invoices);
  const ratio = target && target > 0 ? spent / target : 0;

  const handleSave = () => {
    const amount = parseAmountInput(input);
    if (!Number.isFinite(amount) || amount < 0) {
      showError(t('budget.invalidAmount'));
      return;
    }
    setIsSaving(true);
    saveBudget(amount)
      .then((budget) => {
        setIsSaving(false);
        setTarget(budget.amount);
        setInput(formatAmount(budget.amount));
      })
      .catch((error: Error) => {
        setIsSaving(false);
        showError(error.message);
      });
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{t('budget.title')}</Text>

      {!isLoading && target !== null && (
        <GlassView style={styles.card}>
          <Text style={styles.cardLabel}>{t('budget.thisMonth')}</Text>
          <Text style={styles.amountText}>
            {formatAmount(spent)}{' '}
            <Text style={styles.amountTarget}>
              {t('budget.of')} {formatAmount(target)}
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
        <GlassButton
          label={isSaving ? t('common.saving') : t('common.save')}
          variant="accent"
          onPress={handleSave}
          disabled={isSaving}
        />
      </GlassView>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
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
});
