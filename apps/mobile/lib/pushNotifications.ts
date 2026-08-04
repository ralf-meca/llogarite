import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch } from './http';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushNotificationData = {
  type?: 'buddy_request' | 'invoice_notify_paid' | 'invoice_buddy_added' | 'monthly_payment_reminder';
  invoiceId?: string;
  buddyId?: string;
  paymentId?: string;
  notificationId?: string;
};

export type PushNotificationPayload = {
  data: PushNotificationData;
  title: string | null;
  body: string | null;
};

function toPayload(content: { title?: string | null; body?: string | null; data?: unknown }): PushNotificationPayload {
  return {
    data: (content.data ?? {}) as PushNotificationData,
    title: content.title ?? null,
    body: content.body ?? null,
  };
}

export async function registerPushToken(): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let status = existingStatus;
    if (status !== 'granted') {
      const response = await Notifications.requestPermissionsAsync();
      status = response.status;
    }
    if (status !== 'granted' || !API_BASE_URL) {
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await apiFetch(`${API_BASE_URL}/users/me/push-token`, {
      method: 'PATCH',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ token }),
    });
  } catch {
    // Best-effort: push tokens are unavailable on simulators/emulators and can fail transiently.
  }
}

export function addNotificationTapListener(onTap: (payload: PushNotificationPayload) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onTap(toPayload(response.notification.request.content));
  });
  return () => subscription.remove();
}

export async function getInitialNotificationData(): Promise<PushNotificationPayload | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) {
    return null;
  }
  return toPayload(response.notification.request.content);
}

// Keeps the app's launcher-icon badge in sync with our own unread count. Server pushes also
// carry a badge number (so it updates even while the app isn't running), but we still set it
// explicitly whenever we know the true count — most importantly to clear it back to 0.
export async function setAppBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Best-effort: badge support varies by Android launcher.
  }
}
