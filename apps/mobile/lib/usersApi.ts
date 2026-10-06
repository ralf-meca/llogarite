import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';
import { tr } from './i18n';

export type AccountStatus = { isPremium: boolean; isAdmin: boolean };

// What the server says the account is entitled to right now. Null when it
// cannot be asked, or when the server is too old to say - in which case what
// the app already holds is left alone rather than read as "not premium".
export async function fetchAccountStatus(): Promise<AccountStatus | null> {
  if (!API_BASE_URL) {
    return null;
  }
  const response = await apiFetch(`${API_BASE_URL}/users/me`, { headers: await authHeaders() });
  if (!response.ok) {
    return null;
  }
  const body: { isPremium?: unknown; isAdmin?: unknown } = await response.json();
  if (typeof body.isPremium !== 'boolean') {
    return null;
  }
  return { isPremium: body.isPremium, isAdmin: body.isAdmin === true };
}

export async function fetchMyCode(): Promise<string> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/users/me`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.codeLoadFailed')));
  }
  const body: { code: string } = await response.json();
  return body.code;
}
