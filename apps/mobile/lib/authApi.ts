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

export async function register(email: string, password: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
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
        { 401: 'Email ose fjalëkalimi është i gabuar.' },
        'Kyçja dështoi. Provo përsëri.',
      ),
    );
  }
  return response.json();
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
