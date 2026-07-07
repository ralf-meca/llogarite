import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';

export type RedeemDiscountCodeResult = {
  discountPercent: number;
  isPremium: boolean;
};

export async function redeemDiscountCode(code: string): Promise<RedeemDiscountCodeResult> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/discount-codes/redeem`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ code }),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(
        response.status,
        { 404: 'Kodi nuk ekziston.', 400: 'Ky kod është përdorur tashmë.' },
        'Nuk u aplikua dot kodi. Provo përsëri.',
      ),
    );
  }
  return response.json();
}
