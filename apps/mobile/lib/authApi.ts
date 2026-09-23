import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';

export type AuthUser = {
  id: string;
  email: string;
  hasPassword: boolean;
  name: string | null;
  avatarUrl: string | null;
  isPremium: boolean;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export async function register(email: string, password: string, name: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
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
        { 409: 'Ky email është regjistruar tashmë.' },
        'Regjistrimi dështoi. Provo përsëri.',
      ),
    );
  }
  return response.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
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
          401: 'Email ose fjalëkalimi është i gabuar. Nëse nuk ke vendosur fjalëkalim, kyçu me kod.',
        },
        'Kyçja dështoi. Provo përsëri.',
      ),
    );
  }
  return response.json();
}

export async function requestLoginCode(email: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
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
        { 429: 'Prit pak para se të kërkosh një kod tjetër.' },
        'Dërgimi i kodit dështoi. Provo përsëri.',
      ),
    );
  }
}

export async function verifyLoginCode(email: string, code: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
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
        { 401: 'Kodi është i gabuar ose ka skaduar.' },
        'Kyçja dështoi. Provo përsëri.',
      ),
    );
  }
  return response.json();
}

export async function setPassword(newPassword: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
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
        { 409: 'Kjo llogari ka tashmë një fjalëkalim.' },
        'Ruajtja e fjalëkalimit dështoi. Provo përsëri.',
      ),
    );
  }
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Kyçja me Google dështoi. Provo përsëri.'));
  }
  return response.json();
}

export async function forgotPassword(email: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Dërgimi i kodit dështoi. Provo përsëri.'));
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
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
        { 401: 'Fjalëkalimi aktual është i gabuar.' },
        'Ndryshimi i fjalëkalimit dështoi. Provo përsëri.',
      ),
    );
  }
}

export async function deleteAccount(): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/users/me`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Fshirja e llogarisë dështoi. Provo përsëri.'));
  }
}

export async function updateAvatar(imageDataUri: string): Promise<string | null> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/users/me/avatar`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ image: imageDataUri }),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Ndryshimi i fotos dështoi. Provo përsëri.'));
  }
  const data: { avatarUrl: string | null } = await response.json();
  return data.avatarUrl;
}

export async function removeAvatar(): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/users/me/avatar`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Heqja e fotos dështoi. Provo përsëri.'));
  }
}
