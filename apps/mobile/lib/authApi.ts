import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';
import { tr } from './i18n';

export type AuthUser = {
  id: string;
  email: string;
  hasPassword: boolean;
  name: string | null;
  avatarUrl: string | null;
  isPremium: boolean;
  isAdmin: boolean;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export async function register(email: string, password: string, name: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(
        response.status,
        { 409: tr('api.emailTaken') },
        tr('api.registerFailed'),
      ),
    );
  }
  return response.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(
        response.status,
        {
          401: tr('api.wrongCredentials'),
        },
        tr('api.signInFailed'),
      ),
    );
  }
  return response.json();
}

export async function requestLoginCode(email: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(
        response.status,
        { 429: tr('api.codeTooSoon') },
        tr('api.codeSendFailed'),
      ),
    );
  }
}

export async function verifyLoginCode(email: string, code: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(
        response.status,
        { 401: tr('api.codeInvalid') },
        tr('api.signInFailed'),
      ),
    );
  }
  return response.json();
}

export async function setPassword(newPassword: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/set-password`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ newPassword }),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(
        response.status,
        { 409: tr('api.passwordAlreadySet') },
        tr('api.passwordSaveFailed'),
      ),
    );
  }
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.googleFailed')));
  }
  return response.json();
}

export async function loginWithApple(
  identityToken: string,
  name: string | null,
  authorizationCode: string | null,
): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identityToken,
      ...(name ? { name } : {}),
      ...(authorizationCode ? { authorizationCode } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.appleFailed')));
  }
  return response.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/password`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(
        response.status,
        { 401: tr('api.currentPasswordWrong') },
        tr('api.passwordChangeFailed'),
      ),
    );
  }
}

export async function deleteAccount(): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/users/me`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.accountDeleteFailed')));
  }
}

export async function updateAvatar(imageDataUri: string): Promise<string | null> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/users/me/avatar`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ image: imageDataUri }),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.photoChangeFailed')));
  }
  const data: { avatarUrl: string | null } = await response.json();
  return data.avatarUrl;
}

export async function removeAvatar(): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/users/me/avatar`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.photoRemoveFailed')));
  }
}
