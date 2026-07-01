import { API_BASE_URL } from './apiConfig';
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
    headers: { 'Content-Type': 'application/json' },
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
  const response = await fetch(`${API_BASE_URL}/invoices`);
  if (!response.ok) {
    throw new Error(`Marrja e faturave dështoi: ${response.status}`);
  }
  return response.json();
}
