import { ArrowLeftIcon, CheckCircleIcon } from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { computeBuddyShareFromRows } from '../lib/buddyExpenses';
import { toDateLabel } from '../lib/date';
import { formatAmountLoose } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import {
  fetchProjectExpenses,
  markProjectPaid,
  type Project,
  type ProjectExpense,
} from '../lib/projectsApi';
import { colors } from '../lib/theme';
import { GlassButton } from './GlassButton';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';
import { UserAvatar } from './UserAvatar';

type ProjectDetailScreenProps = {
  project: Project;
  currentUserId: string;
  onBack: () => void;
  onSelectExpense?: (expenseId: string) => void;
};

type PersonTotal = {
  userId: string;
  owed: number;
  settled: number;
};

// What each person still owes across the whole project, and what they have
// already covered. Computed from the same row-level split the invoice detail
// uses, so a trip's totals and a single receipt's never disagree.
function totalsByPerson(expenses: ProjectExpense[]): PersonTotal[] {
  const byPerson = new Map<string, PersonTotal>();

  for (const expense of expenses) {
    const buddies = expense.data.buddies ?? [];
    const buddyIds = buddies.map((buddy) => buddy.userId);
    const rows = expense.data.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPriceAfterVat,
      buddyQuantities: item.buddyQuantities ?? {},
    }));

    for (const buddy of buddies) {
      const share = computeBuddyShareFromRows(rows, buddy.userId, buddyIds);
      const entry = byPerson.get(buddy.userId) ?? { userId: buddy.userId, owed: 0, settled: 0 };
      if (buddy.paid) {
        entry.settled += share;
      } else {
        entry.owed += share;
      }
      byPerson.set(buddy.userId, entry);
    }
  }

  return Array.from(byPerson.values()).sort((a, b) => b.owed - a.owed);
}

export function ProjectDetailScreen({
  project,
  currentUserId,
  onBack,
  onSelectExpense,
}: ProjectDetailScreenProps) {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettling, setIsSettling] = useState(false);
  const { toasts, showError, showSuccess, dismissToast } = useToasts();

  const isOwner = project.userId === currentUserId;

  const load = useCallback(() => {
    setIsLoading(true);
    fetchProjectExpenses(project.id)
      .then((result) => {
        setExpenses(result);
        setIsLoading(false);
      })
      .catch((error: Error) => {
        setExpenses([]);
        setIsLoading(false);
        showError(error.message);
      });
  }, [project.id, showError]);

  useEffect(() => {
    load();
    fetchBuddies()
      .then(setBuddies)
      .catch(() => setBuddies([]));
  }, [load]);

  const spent = expenses.reduce((sum, expense) => sum + (expense.data.totalPrice ?? 0), 0);
  const people = totalsByPerson(expenses);
  // Only the caller's own expenses can be settled here, so the button says
  // nothing when there is nothing of theirs left owing.
  const owedOnMyExpenses = expenses
    .filter((expense) => expense.ownerId === currentUserId)
    .flatMap((expense) => expense.data.buddies ?? [])
    .some((buddy) => !buddy.paid);

  const nameFor = (userId: string) => {
    const buddy = buddies.find((candidate) => candidate.id === userId);
    return buddy?.name ?? buddy?.email ?? t('projectDetail.someone');
  };

  const handleSettle = () => {
    setIsSettling(true);
    markProjectPaid(project.id)
      .then(() => {
        setIsSettling(false);
        showSuccess(t('projectDetail.settled'));
        load();
      })
      .catch((error: Error) => {
        setIsSettling(false);
        showError(error.message);
      });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
          <ArrowLeftIcon size={22} color={colors.textDark} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {project.name}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GlassView style={styles.card}>
          {project.details ? <Text style={styles.details}>{project.details}</Text> : null}

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('projects.budget')}</Text>
            <Text style={styles.metaValue}>{formatAmountLoose(project.budget)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('projects.expenses')}</Text>
            <Text style={styles.metaValue}>{formatAmountLoose(spent)}</Text>
          </View>
          {project.endDate ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('projects.endDate')}</Text>
              <Text style={styles.metaValue}>{toDateLabel(new Date(project.endDate))}</Text>
            </View>
          ) : null}
          {!isOwner ? <Text style={styles.sharedNote}>{t('projectDetail.sharedWithYou')}</Text> : null}
        </GlassView>

        {people.length > 0 && (
          <GlassView style={styles.card}>
            <Text style={styles.cardTitle}>{t('projectDetail.whoOwes')}</Text>
            {people.map((person) => (
              <View key={person.userId} style={styles.personRow}>
                <UserAvatar user={buddies.find((b) => b.id === person.userId) ?? null} size={28} />
                <Text style={styles.personName} numberOfLines={1}>
                  {nameFor(person.userId)}
                </Text>
                {person.owed > 0 ? (
                  <Text style={styles.personOwed}>{formatAmountLoose(person.owed)}</Text>
                ) : (
                  <View style={styles.personSettled}>
                    <CheckCircleIcon size={16} weight="fill" color="#059669" />
                    <Text style={styles.personSettledText}>{t('projectDetail.allPaid')}</Text>
                  </View>
                )}
              </View>
            ))}

            {isOwner && owedOnMyExpenses && (
              <GlassButton
                label={isSettling ? t('common.saving') : t('projectDetail.markAllPaid')}
                variant="accent"
                style={styles.settleButton}
                onPress={handleSettle}
                disabled={isSettling}
              />
            )}
          </GlassView>
        )}

        <GlassView style={styles.card}>
          <Text style={styles.cardTitle}>{t('projectDetail.expenses')}</Text>

          {isLoading ? (
            <ActivityIndicator style={styles.loading} color={colors.primary} />
          ) : expenses.length === 0 ? (
            <Text style={styles.emptyText}>{t('projectDetail.noExpenses')}</Text>
          ) : (
            expenses.map((expense) => (
              <Pressable
                key={expense.id}
                style={styles.expenseRow}
                onPress={() => onSelectExpense?.(expense.id)}
              >
                <View style={styles.expenseText}>
                  <Text style={styles.expenseSeller} numberOfLines={1}>
                    {expense.data.seller.name.trim() || t('projectDetail.noSeller')}
                  </Text>
                  <Text style={styles.expenseMeta} numberOfLines={1}>
                    {toDateLabel(new Date(expense.data.dateTimeCreated))} ·{' '}
                    {expense.ownerId === currentUserId
                      ? t('projectDetail.paidByYou')
                      : expense.ownerName ?? expense.ownerEmail}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>{formatAmountLoose(expense.data.totalPrice)}</Text>
              </Pressable>
            ))
          )}
        </GlassView>
      </ScrollView>

      <ToastHost toasts={toasts} onDismiss={dismissToast} bottomOffset={110} />
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
    marginBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
    gap: 12,
  },
  card: {
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  details: {
    fontSize: 14,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  sharedNote: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  personName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  personOwed: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  personSettled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  personSettledText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  settleButton: {
    marginTop: 12,
  },
  loading: {
    marginVertical: 16,
  },
  emptyText: {
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expenseText: {
    flex: 1,
    gap: 2,
  },
  expenseSeller: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  expenseMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
});
