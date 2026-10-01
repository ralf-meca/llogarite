import { ArrowLeftIcon, CheckCircleIcon } from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { toDateLabel } from '../lib/date';
import { formatAmountLoose } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import { AMOUNT_EPSILON, invoiceDebts } from '../lib/invoicePayments';
import {
  fetchProjectExpenses,
  markProjectPaid,
  type Project,
  type ProjectExpense,
} from '../lib/projectsApi';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';
import { UserAvatar } from './UserAvatar';

type ProjectDetailScreenProps = {
  project: Project;
  currentUserId: string;
  // The signed-in user, for their own row when they owe a buddy who paid.
  currentUser?: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
  onBack: () => void;
  onSelectExpense?: (expense: ProjectExpense) => void;
};

type PersonTotal = {
  userId: string;
  owed: number;
  settled: number;
  // The part of `owed` that sits on the viewer's own expenses - the only part
  // the viewer can mark as paid back, since they keep those receipts.
  settleable: number;
};

// What each person still owes across the whole project, and what they have
// already covered. Computed from the same row-level split the invoice detail
// uses, so a trip's totals and a single receipt's never disagree.
function totalsByPerson(expenses: ProjectExpense[], viewerId: string): PersonTotal[] {
  const byPerson = new Map<string, PersonTotal>();

  for (const expense of expenses) {
    const buddies = expense.data.buddies ?? [];

    // Normally the owner paid and each buddy owes them a share. Whatever a
    // buddy paid at the till comes off their share, and the owner owes in turn
    // once the others covered more than the owner's own part.
    const isViewers = expense.ownerId === viewerId;
    const add = (userId: string, share: number, paid: boolean) => {
      const entry = byPerson.get(userId) ?? { userId, owed: 0, settled: 0, settleable: 0 };
      if (paid) {
        entry.settled += share;
      } else {
        entry.owed += share;
        if (isViewers) {
          entry.settleable += share;
        }
      }
      byPerson.set(userId, entry);
    };

    const debts = invoiceDebts(expense.data);
    for (const buddy of buddies) {
      const debt = debts.buddies[buddy.userId].debt;
      if (debt > 0) {
        add(buddy.userId, debt, buddy.paid);
      }
    }
    if (debts.owner.debt > 0) {
      add(expense.ownerId, debts.owner.debt, expense.data.ownerPaid === true);
    }
  }

  return Array.from(byPerson.values()).sort((a, b) => b.owed - a.owed);
}

export function ProjectDetailScreen({
  project,
  currentUserId,
  currentUser,
  onBack,
  onSelectExpense,
}: ProjectDetailScreenProps) {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // The buddy whose shares are being settled right now, if any.
  const [settlingId, setSettlingId] = useState<string | null>(null);
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
  const debtors = totalsByPerson(expenses, currentUserId);
  // The project's owner heads the list whenever it is shared, owing or not, so
  // their standing is as visible as everyone else's.
  const isShared = project.buddyIds.length > 0 || debtors.length > 0;
  const people = isShared
    ? [
        debtors.find((person) => person.userId === project.userId) ?? {
          userId: project.userId,
          owed: 0,
          settled: 0,
          settleable: 0,
        },
        ...debtors.filter((person) => person.userId !== project.userId),
      ]
    : [];

  const nameFor = (userId: string) => {
    if (userId === currentUserId) {
      return t('projectDetail.you');
    }
    const buddy = buddies.find((candidate) => candidate.id === userId);
    return buddy?.name ?? buddy?.email ?? t('projectDetail.someone');
  };
  const avatarFor = (userId: string) =>
    userId === currentUserId ? (currentUser ?? null) : (buddies.find((b) => b.id === userId) ?? null);

  // One buddy at a time: people pay back separately, so settling everyone in
  // one tap marked debts paid that were not.
  // Who paid at the till: the owner unless buddies put money in, and everyone
  // who did when the bill was split.
  const payerLabel = (expense: ProjectExpense) => {
    const debts = invoiceDebts(expense.data);
    const payerIds = [
      ...(debts.owner.paidAtTill > AMOUNT_EPSILON ? [expense.ownerId] : []),
      ...Object.keys(debts.buddies).filter((buddyId) => debts.buddies[buddyId].paidAtTill > AMOUNT_EPSILON),
    ];
    if (payerIds.length === 1 && payerIds[0] === currentUserId) {
      return t('projectDetail.paidByYou');
    }
    const names = payerIds.map((payerId) =>
      payerId === expense.ownerId && payerId !== currentUserId
        ? (expense.ownerName ?? expense.ownerEmail)
        : nameFor(payerId),
    );
    return t('projectDetail.paidBy', { name: names.join(', ') });
  };

  const handleSettle = (person: PersonTotal) => {
    Alert.alert(
      t('projectDetail.confirmMarkPaidTitle'),
      person.userId === currentUserId
        ? t('projectDetail.confirmMarkPaidSelf', { amount: formatAmountLoose(person.settleable) })
        : t('projectDetail.confirmMarkPaidMessage', {
            name: nameFor(person.userId),
            amount: formatAmountLoose(person.settleable),
          }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            setSettlingId(person.userId);
            markProjectPaid(project.id, person.userId)
              .then(() => {
                setSettlingId(null);
                showSuccess(t('projectDetail.settled'));
                load();
              })
              .catch((error: Error) => {
                setSettlingId(null);
                showError(error.message);
              });
          },
        },
      ],
    );
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
          {project.kind === 'trip' && project.startDate && project.endDate ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('projects.dates')}</Text>
              <Text style={styles.metaValue}>
                {toDateLabel(new Date(project.startDate))} – {toDateLabel(new Date(project.endDate))}
              </Text>
            </View>
          ) : project.endDate ? (
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
                <UserAvatar user={avatarFor(person.userId)} size={28} />
                <Text style={styles.personName} numberOfLines={1}>
                  {nameFor(person.userId)}
                </Text>
                {person.owed > 0 ? (
                  <>
                    <Text style={styles.personOwed}>{formatAmountLoose(person.owed)}</Text>
                    {/* Only shares on your own expenses are yours to settle. */}
                    {isOwner && person.settleable > 0 && (
                      <Pressable
                        style={[styles.markPaidButton, settlingId !== null && styles.markPaidButtonDisabled]}
                        onPress={() => handleSettle(person)}
                        disabled={settlingId !== null}
                        hitSlop={6}
                      >
                        <Text style={styles.markPaidText}>
                          {settlingId === person.userId ? t('common.saving') : t('projectDetail.markPaid')}
                        </Text>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <View style={styles.personSettled}>
                    <CheckCircleIcon size={16} weight="fill" color="#059669" />
                    <Text style={styles.personSettledText}>{t('projectDetail.allPaid')}</Text>
                  </View>
                )}
              </View>
            ))}

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
                onPress={() => onSelectExpense?.(expense)}
              >
                <View style={styles.expenseText}>
                  <Text style={styles.expenseSeller} numberOfLines={1}>
                    {expense.data.seller.name.trim() || t('projectDetail.noSeller')}
                  </Text>
                  <Text style={styles.expenseMeta} numberOfLines={1}>
                    {toDateLabel(new Date(expense.data.dateTimeCreated))} ·{' '}
                    {payerLabel(expense)}
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
  markPaidButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primaryTint,
  },
  markPaidButtonDisabled: {
    opacity: 0.5,
  },
  markPaidText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
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
