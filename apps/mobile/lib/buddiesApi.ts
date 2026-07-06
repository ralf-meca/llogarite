import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';

export type Buddy = {
  connectionId: string;
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export async function sendBuddyRequest(code: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
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
        { 404: 'Nuk u gjet asnjë përdorues me këtë kod.' },
        'Dërgimi i kërkesës dështoi. Provo përsëri.',
      ),
    );
  }
}

export async function fetchBuddyRequests(): Promise<Buddy[]> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/buddies/requests`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Marrja e kërkesave dështoi. Provo përsëri.'));
  }
  return response.json();
}

export async function respondToBuddyRequest(connectionId: string, accept: boolean): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/buddies/requests/${connectionId}`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ accept }),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Përgjigja ndaj kërkesës dështoi. Provo përsëri.'));
  }
}

export async function fetchBuddies(): Promise<Buddy[]> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/buddies`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Marrja e shokëve dështoi. Provo përsëri.'));
  }
  return response.json();
}
