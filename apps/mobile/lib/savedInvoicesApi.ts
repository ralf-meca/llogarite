import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
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
  const response = await fetch(`${API_BASE_URL}/invoices`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Ruajtja dështoi: ${response.status}`);
  }
  return response.json();
}

export async function fetchSavedInvoices(): Promise<SavedInvoice[]> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await fetch(`${API_BASE_URL}/invoices`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(`Marrja e faturave dështoi: ${response.status}`);
  }
  return response.json();
}

export async function deleteInvoice(id: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await fetch(`${API_BASE_URL}/invoices/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Fshirja dështoi: ${response.status}`);
  }
}
