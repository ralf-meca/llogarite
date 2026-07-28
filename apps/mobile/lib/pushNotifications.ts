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
  type?: 'buddy_request' | 'invoice_notify_paid';
  invoiceId?: string;
};

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

export function addNotificationTapListener(onTap: (data: PushNotificationData) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onTap((response.notification.request.content.data ?? {}) as PushNotificationData);
  });
  return () => subscription.remove();
}

export async function getInitialNotificationData(): Promise<PushNotificationData | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) {
    return null;
  }
  return (response.notification.request.content.data ?? {}) as PushNotificationData;
}
