import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';
import type { PricedInvoice } from './productPrices';

// Everyone's accepted invoices, stripped to what a price comparison needs. The
// server shapes them like saved invoices so listProducts and getProductRecords
// keep working unchanged - the price screens only change where they read from.
//
// Not a SavedInvoice: there is no iic and no owner, and nothing here belongs
// to the person looking at it.
export type SharedPriceInvoice = PricedInvoice;

export async function fetchSharedPrices(): Promise<SharedPriceInvoice[]> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/prices`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Leximi i çmimeve dështoi.'));
  }
  return response.json();
}
