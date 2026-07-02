import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';
import type { InvoiceVerificationResult } from './invoiceApi';

export type SavedInvoice = {
  id: string;
  iic: string;
  data: InvoiceVerificationResult;
  createdAt: string;
};

export async function saveInvoice(data: InvoiceVerificationResult): Promise<SavedInvoice> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/invoices`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Ruajtja e faturës dështoi. Provo përsëri.'));
  }
  return response.json();
}

export async function fetchSavedInvoices(): Promise<SavedInvoice[]> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/invoices`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Marrja e faturave dështoi. Provo përsëri.'));
  }
  return response.json();
}

export async function updateInvoice(id: string, data: InvoiceVerificationResult): Promise<SavedInvoice> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/invoices/${id}`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, { 404: 'Fatura nuk u gjet.' }, 'Ndryshimi dështoi. Provo përsëri.'));
  }
  return response.json();
}

export async function deleteInvoice(id: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/invoices/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, { 404: 'Fatura nuk u gjet.' }, 'Fshirja dështoi. Provo përsëri.'));
  }
}
