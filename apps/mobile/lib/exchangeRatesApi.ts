import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import type { RateBook } from './currency';
import { apiFetch } from './http';

// Rates already fetched this session. A past day's rate never changes, and
// today's moving a little between two screens is not worth a second request.
const cache = new Map<string, number>();

// Lek per euro for each of the given days (YYYY-MM-DD). A day the server has
// no rate for is simply missing from the result; a failed request throws, so
// callers can tell "no rate" from "could not ask".
export async function fetchEurRates(dates: string[]): Promise<RateBook> {
  const wanted = [...new Set(dates)];
  const missing = wanted.filter((date) => !cache.has(date));

  if (missing.length > 0) {
    if (!API_BASE_URL) {
      throw new Error('Serveri nuk është i konfiguruar.');
    }
    const response = await apiFetch(`${API_BASE_URL}/exchange-rates?base=EUR&dates=${missing.join(',')}`, {
      headers: await authHeaders(),
    });
    if (!response.ok) {
      throw new Error('Kursi i këmbimit nuk u mor. Shkruaje me dorë.');
    }
    const body: { rates?: Record<string, number> } = await response.json();
    for (const [date, rate] of Object.entries(body.rates ?? {})) {
      if (typeof rate === 'number' && rate > 0) {
        cache.set(date, rate);
      }
    }
  }

  const rates: RateBook = {};
  for (const date of wanted) {
    const rate = cache.get(date);
    if (rate !== undefined) {
      rates[date] = rate;
    }
  }
  return rates;
}
