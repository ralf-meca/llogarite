import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export async function register(email: string, password: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Regjistrimi dështoi: ${response.status}`);
  }
  return response.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Kyçja dështoi: ${response.status}`);
  }
  return response.json();
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await fetch(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw new Error(`Kyçja me Google dështoi: ${response.status}`);
  }
  return response.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await fetch(`${API_BASE_URL}/auth/password`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (response.status === 401) {
    throw new Error('Fjalëkalimi aktual është i gabuar.');
  }
  if (!response.ok) {
    throw new Error(`Ndryshimi i fjalëkalimit dështoi: ${response.status}`);
  }
}
