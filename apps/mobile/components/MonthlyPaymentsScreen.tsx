import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { suggestCategory } from '../lib/categories';
import { parseDateLabel, todayLabel, toLocalIsoString } from '../lib/date';
import { formatAmount, formatAmountInput, parseAmountInput } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import {
  createMonthlyPayment,
  deleteMonthlyPayment,
  fetchMonthlyPayments,
  updateMonthlyPayment,
  type MonthlyPayment,
} from '../lib/monthlyPaymentsApi';
import { requestNotificationPermissions, scheduleMonthlyPaymentReminders } from '../lib/paymentNotifications';
import { saveInvoice } from '../lib/savedInvoicesApi';
import { colors } from '../lib/theme';
import { BuddyPicker } from './BuddyPicker';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

type FormState = {
  name: string;
  amount: string;
  dueDay: string;
  buddyIds: string[];
};

function emptyForm(): FormState {
  return { name: '', amount: '', dueDay: '', buddyIds: [] };
}

export function MonthlyPaymentsScreen() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [payDatePayment, setPayDatePayment] = useState<MonthlyPayment | null>(null);
  const [payDateLabel, setPayDateLabel] = useState('');
  const [isConfirmingPay, setIsConfirmingPay] = useState(false);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const { toasts, showError, dismissToast } = useToasts();

  useEffect(() => {
    fetchBuddies()
      .then(setBuddies)
      .catch(() => setBuddies([]));
  }, []);

  const toggleBuddy = (buddyId: string) => {
    setForm((current) => ({
      ...current,
      buddyIds: current.buddyIds.includes(buddyId)
        ? current.buddyIds.filter((id) => id !== buddyId)
        : [...current.buddyIds, buddyId],
    }));
  };

  const load = () => {
    fetchMonthlyPayments()
      .then((data) => {
        setPayments(data);
        setIsLoading(false);
        requestNotificationPermissions().then((granted) => {
          if (granted) {
            scheduleMonthlyPaymentReminders(data);
          }
        });
      })
      .catch((error: Error) => {
        setIsLoading(false);
        showError(error.message);
      });
  };

  useEffect(load, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsModalVisible(true);
  };

  const openEdit = (payment: MonthlyPayment) => {
    setEditingId(payment.id);
    setForm({
      name: payment.name,
      amount: formatAmount(payment.amount),
      dueDay: String(payment.dueDay),
      buddyIds: payment.buddyIds,
    });
    setIsModalVisible(true);
  };

  const handleSubmit = () => {
    const amount = parseAmountInput(form.amount);
    const dueDay = Number(form.dueDay);
    if (!form.name.trim()) {
      showError(t('monthlyPayments.nameRequired'));
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showError(t('monthlyPayments.invalidAmount'));
      return;
    }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      showError(t('monthlyPayments.invalidDueDay'));
      return;
    }

    setIsSaving(true);
    const payload = { name: form.name.trim(), amount, dueDay, buddyIds: form.buddyIds };
    const request = editingId ? updateMonthlyPayment(editingId, payload) : createMonthlyPayment(payload);
    request
      .then(() => {
        setIsSaving(false);
        setIsModalVisible(false);
        load();
      })
      .catch((error: Error) => {
        setIsSaving(false);
        showError(error.message);
      });
  };

  const handleDelete = (id: string) => {
    deleteMonthlyPayment(id)
      .then(load)
      .catch((error: Error) => showError(error.message));
  };

  const handleTogglePaid = (payment: MonthlyPayment) => {
    const isPaid = payment.lastPaidMonth === currentMonthKey();
    if (isPaid) {
      updateMonthlyPayment(payment.id, { lastPaidMonth: null })
        .then(load)
        .catch((error: Error) => showError(error.message));
      return;
    }
    setPayDatePayment(payment);
    setPayDateLabel(todayLabel());
  };

  const handleConfirmPayDate = () => {
    if (!payDatePayment) {
      return;
    }
    const date = parseDateLabel(payDateLabel);
    if (!date) {
      showError(t('monthlyPayments.invalidDate'));
      return;
    }

    setIsConfirmingPay(true);
    const payment = payDatePayment;
    Promise.all([
      updateMonthlyPayment(payment.id, { lastPaidMonth: currentMonthKey() }),
      saveInvoice({
        iic: `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dateTimeCreated: toLocalIsoString(date),
        totalPrice: payment.amount,
        seller: { name: payment.name },
        items: [
          {
            name: payment.name,
            quantity: 1,
            unitPriceBeforeVat: payment.amount,
            unitPriceAfterVat: payment.amount,
            category: suggestCategory(payment.name),
          },
        ],
        buddies: payment.buddyIds.map((userId) => ({ userId, paid: false })),
      }),
    ])
      .then(() => {
        setIsConfirmingPay(false);
        setPayDatePayment(null);
        load();
      })
      .catch((error: Error) => {
        setIsConfirmingPay(false);
        showError(error.message);
      });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('monthlyPayments.title')}</Text>
          <Pressable style={styles.addButton} onPress={openAdd}>
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {!isLoading && payments.length === 0 && (
          <Text style={styles.emptyText}>{t('monthlyPayments.empty')}</Text>
        )}

        {payments.map((payment) => {
          const isPaid = payment.lastPaidMonth === currentMonthKey();
          return (
            <GlassView key={payment.id} style={styles.row}>
              <Pressable style={styles.rowMain} onPress={() => openEdit(payment)}>
                <Text style={styles.rowName}>{payment.name}</Text>
                <Text style={styles.rowMeta}>
                  {formatAmount(payment.amount)} · {t('monthlyPayments.dueDay', { day: payment.dueDay })}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.paidBadge, isPaid ? styles.paidBadgeOn : styles.paidBadgeOff]}
                onPress={() => handleTogglePaid(payment)}
              >
                <Text style={[styles.paidBadgeText, isPaid && styles.paidBadgeTextOn]}>
                  {isPaid ? t('monthlyPayments.paid') : t('monthlyPayments.unpaid')}
                </Text>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={() => handleDelete(payment.id)}>
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
              </Pressable>
            </GlassView>
          );
        })}
      </ScrollView>

      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsModalVisible(false)}>
          <Pressable style={styles.formCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.formTitle}>
              {editingId ? t('monthlyPayments.editPayment') : t('monthlyPayments.addPayment')}
            </Text>
            <GlassTextInput
              style={styles.input}
              placeholder={t('monthlyPayments.namePlaceholder')}
              value={form.name}
              onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
            />
            <GlassTextInput
              style={styles.input}
              placeholder={t('monthlyPayments.amountPlaceholder')}
              keyboardType="numeric"
              value={form.amount}
              onChangeText={(value) => setForm((current) => ({ ...current, amount: formatAmountInput(value) }))}
            />
            <GlassTextInput
              style={styles.input}
              placeholder={t('monthlyPayments.dueDayPlaceholder')}
              keyboardType="numeric"
              value={form.dueDay}
              onChangeText={(value) => setForm((current) => ({ ...current, dueDay: value.replace(/[^0-9]/g, '') }))}
            />
            <View style={styles.buddyRow}>
              <BuddyPicker buddies={buddies} selectedIds={form.buddyIds} onToggle={toggleBuddy} />
            </View>
            <GlassButton
              label={isSaving ? t('common.saving') : t('common.save')}
              variant="accent"
              onPress={handleSubmit}
              disabled={isSaving}
            />
            <Pressable onPress={() => setIsModalVisible(false)}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={payDatePayment !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPayDatePayment(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPayDatePayment(null)}>
          <Pressable style={styles.formCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.formTitle}>
              {t('monthlyPayments.whenWasPaid', { name: payDatePayment?.name ?? '' })}
            </Text>
            <GlassTextInput
              style={styles.input}
              placeholder={t('monthlyPayments.datePlaceholder')}
              value={payDateLabel}
              onChangeText={setPayDateLabel}
            />
            <GlassButton
              label={isConfirmingPay ? t('common.saving') : t('common.confirm')}
              variant="accent"
              onPress={handleConfirmPayDate}
              disabled={isConfirmingPay}
            />
            <Pressable onPress={() => setPayDatePayment(null)}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
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
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    boxShadow: '0px 2px 4px rgba(0,0,0,0.15)',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  rowMain: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  rowMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  paidBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  paidBadgeOn: {
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  paidBadgeOff: {
    backgroundColor: 'rgba(107,114,128,0.12)',
  },
  paidBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  paidBadgeTextOn: {
    color: '#059669',
  },
  deleteButton: {
    padding: 4,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  formCard: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.2)',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  input: {
    marginBottom: 12,
  },
  buddyRow: {
    marginBottom: 16,
  },
  cancelText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
  },
});
