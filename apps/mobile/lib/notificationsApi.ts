import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
};

export async function fetchNotifications(): Promise<AppNotification[]> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/notifications`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Marrja e njoftimeve dështoi. Provo përsëri.'));
  }
  return response.json();
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!API_BASE_URL) {
    return;
  }
  await apiFetch(`${API_BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: await authHeaders(),
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!API_BASE_URL) {
    return;
  }
  await apiFetch(`${API_BASE_URL}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: await authHeaders(),
  });
}

// Best-effort sync for locally-scheduled monthly-payment reminders, which fire entirely
// on-device with no backend event to hook a Notification row into otherwise. The backend
// dedupes by (user, paymentId, day), so this is safe to call both when the reminder fires
// and again when it's tapped.
export async function syncMonthlyPaymentReminder(params: {
  paymentId: string;
  title: string;
  body: string;
}): Promise<AppNotification | null> {
  if (!API_BASE_URL) {
    return null;
  }
  const response = await apiFetch(`${API_BASE_URL}/notifications/monthly-payment-reminder-sync`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}
