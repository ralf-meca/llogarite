import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';
import { tr } from './i18n';

export type MonthlyPayment = {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  lastPaidMonth: string | null;
  buddyIds: string[];
};

export type MonthlyPaymentInput = {
  name: string;
  amount: number;
  dueDay: number;
  buddyIds: string[];
};

export async function fetchMonthlyPayments(): Promise<MonthlyPayment[]> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/monthly-payments`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.paymentsLoadFailed')));
  }
  return response.json();
}

export async function createMonthlyPayment(data: MonthlyPaymentInput): Promise<MonthlyPayment> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/monthly-payments`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, tr('api.paymentAddFailed')));
  }
  return response.json();
}

export async function updateMonthlyPayment(
  id: string,
  patch: Partial<MonthlyPaymentInput & { lastPaidMonth: string | null }>,
): Promise<MonthlyPayment> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/monthly-payments/${id}`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(response.status, { 404: tr('api.paymentNotFound') }, tr('api.paymentChangeFailed')),
    );
  }
  return response.json();
}

export async function deleteMonthlyPayment(id: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error(tr('api.noConnection'));
  }
  const response = await apiFetch(`${API_BASE_URL}/monthly-payments/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(response.status, { 404: tr('api.paymentNotFound') }, tr('api.paymentDeleteFailed')),
    );
  }
}
