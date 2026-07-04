import * as Notifications from 'expo-notifications';
import { formatAmount } from './formatAmount';
import type { MonthlyPayment } from './monthlyPaymentsApi';

const REMINDER_HOUR = 9;
const NOTIFICATION_TAG = 'monthly-payment-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') {
    return true;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function occurrenceInMonth(dueDay: number, year: number, month: number): Date {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(dueDay, daysInMonth);
  return new Date(year, month, day, REMINDER_HOUR, 0, 0);
}

function nextOccurrence(dueDay: number, now: Date): Date {
  const thisMonth = occurrenceInMonth(dueDay, now.getFullYear(), now.getMonth());
  if (thisMonth.getTime() > now.getTime()) {
    return thisMonth;
  }
  return occurrenceInMonth(dueDay, now.getFullYear(), now.getMonth() + 1);
}

function dayBefore(date: Date): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - 1);
  return result;
}

export async function scheduleMonthlyPaymentReminders(payments: MonthlyPayment[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.content.data?.tag === NOTIFICATION_TAG)
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)),
  );

  const now = new Date();

  for (const payment of payments) {
    const dueDate = nextOccurrence(payment.dueDay, now);
    if (payment.lastPaidMonth === monthKey(dueDate)) {
      continue;
    }

    const reminderDate = dayBefore(dueDate);
    if (reminderDate.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Pagesë nesër',
          body: `${payment.name} duhet paguar nesër (${formatAmount(payment.amount)}).`,
          data: { tag: NOTIFICATION_TAG, paymentId: payment.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
      });
    }

    if (dueDate.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Pagesë sot',
          body: `${payment.name} duhet paguar sot (${formatAmount(payment.amount)}).`,
          data: { tag: NOTIFICATION_TAG, paymentId: payment.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueDate },
      });
    }
  }
}
