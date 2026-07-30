import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';

export type BudgetCategoryAllocation = {
  mode: 'percent' | 'amount';
  value: number;
};

export type Budget = {
  id: string;
  amount: number;
  categoryAllocations: Record<string, BudgetCategoryAllocation> | null;
};

export function resolveAllocationAmount(allocation: BudgetCategoryAllocation, totalBudget: number): number {
  if (allocation.mode === 'percent') {
    return (totalBudget * allocation.value) / 100;
  }
  return allocation.value;
}

export async function fetchBudget(): Promise<Budget | null> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/budget`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Marrja e buxhetit dështoi. Provo përsëri.'));
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function setBudget(
  amount: number,
  categoryAllocations: Record<string, BudgetCategoryAllocation> | null,
): Promise<Budget> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/budget`, {
    method: 'PUT',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ amount, categoryAllocations }),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Ruajtja e buxhetit dështoi. Provo përsëri.'));
  }
  return response.json();
}
