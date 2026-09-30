import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';
import type { InvoiceVerificationResult } from './invoiceApi';

export const INVOICE_LEGITIMACIES = ['pending', 'accepted', 'denied'] as const;
export type InvoiceLegitimacy = (typeof INVOICE_LEGITIMACIES)[number];

// Carries the owner, unlike anything else the app fetches about an invoice:
// a queue of amounts with no names attached is not reviewable.
export type ReviewInvoice = {
  id: string;
  legitimacy: InvoiceLegitimacy;
  // True only from a real government API verification. Those skip the queue
  // entirely - there is nothing a person can add to a receipt the state has
  // already confirmed - so they appear under accepted without being touched.
  verified: boolean;
  createdAt: string;
  data: InvoiceVerificationResult;
  ownerEmail: string;
  ownerName: string | null;
};

export async function fetchReviewInvoices(status: InvoiceLegitimacy): Promise<ReviewInvoice[]> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/admin/invoices?status=${status}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Leximi i faturave dështoi.'));
  }
  return response.json();
}

export async function setInvoiceLegitimacy(id: string, legitimacy: InvoiceLegitimacy): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/admin/invoices/${id}/legitimacy`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ legitimacy }),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Ruajtja dështoi. Provo përsëri.'));
  }
}
