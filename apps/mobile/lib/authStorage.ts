import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'llogarite_auth_token';

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) {
    throw new Error('Nuk jeni i kyçur.');
  }
  return { ...extra, Authorization: `Bearer ${token}` };
}
