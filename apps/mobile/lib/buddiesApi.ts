import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';
import { tr } from './i18n';

export type Buddy = {
  connectionId: string;
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export async function sendBuddyRequest(code: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/buddies/request`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ code }),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(
        response.status,
        { 404: tr('api.buddyCodeUnknown') },
        tr('api.requestSendFailed'),
      ),
    );
  }
}

export async function fetchBuddyRequests(): Promise<Buddy[]> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/buddies/requests`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.requestsLoadFailed')));
  }
  return response.json();
}

export async function respondToBuddyRequest(connectionId: string, accept: boolean): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/buddies/requests/${connectionId}`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ accept }),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.requestReplyFailed')));
  }
}

export type SettleResult = {
  settled: number;
  owedToMe: number;
  owedByMe: number;
};

// Balances what the two owe each other: the smaller total comes off both
// sides, leaving one person owing the difference. A refusal comes with its
// reason, written to be shown as it is.
export async function settleWithBuddy(buddyId: string): Promise<SettleResult> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/buddies/settle/${buddyId}`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    const body: { message?: unknown } | null = await response.json().catch(() => null);
    if (response.status === 400 && typeof body?.message === 'string' && body.message) {
      throw new Error(body.message);
    }
    throw new Error(describeHttpError(response.status, {}, tr('api.settleFailed')));
  }
  return response.json();
}

// Ends the connection for both sides. What was already split with them stays.
export async function removeBuddy(connectionId: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/buddies/${connectionId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    // A refusal comes with the reason, written to be shown as it is - today
    // that there are still unpaid invoices between the two.
    if (response.status === 409) {
      const body: { message?: unknown } | null = await response.json().catch(() => null);
      if (typeof body?.message === 'string' && body.message) {
        throw new Error(body.message);
      }
    }
    throw new Error(describeHttpError(response.status, {}, tr('api.buddyRemoveFailed')));
  }
}

export async function fetchBuddies(): Promise<Buddy[]> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/buddies`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.buddiesLoadFailed')));
  }
  return response.json();
}
