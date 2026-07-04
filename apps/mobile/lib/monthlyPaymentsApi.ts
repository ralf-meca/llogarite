import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';

export type MonthlyPayment = {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  lastPaidMonth: string | null;
};

export type MonthlyPaymentInput = {
  name: string;
  amount: number;
  dueDay: number;
};

export async function fetchMonthlyPayments(): Promise<MonthlyPayment[]> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/monthly-payments`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Marrja e pagesave dështoi. Provo përsëri.'));
  }
  return response.json();
}

export async function createMonthlyPayment(data: MonthlyPaymentInput): Promise<MonthlyPayment> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/monthly-payments`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Shtimi i pagesës dështoi. Provo përsëri.'));
  }
  return response.json();
}

export async function updateMonthlyPayment(
  id: string,
  patch: Partial<MonthlyPaymentInput & { lastPaidMonth: string | null }>,
): Promise<MonthlyPayment> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/monthly-payments/${id}`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(response.status, { 404: 'Pagesa nuk u gjet.' }, 'Ndryshimi i pagesës dështoi. Provo përsëri.'),
    );
  }
  return response.json();
}

export async function deleteMonthlyPayment(id: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/monthly-payments/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(response.status, { 404: 'Pagesa nuk u gjet.' }, 'Fshirja e pagesës dështoi. Provo përsëri.'),
    );
  }
}
