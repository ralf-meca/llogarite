import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { CURRENCY_SYMBOL, formatMoney, invoiceCurrency, invoiceRate, type Currency } from './currency';
import { fetchEurRates } from './exchangeRatesApi';
import { formatAmount, needsCents, parseAmountInput } from './formatAmount';

// The currency the app shows its amounts in. Everything is stored in lek; with euros
// chosen, a lek amount is shown divided by today's rate, as the server gives it.
//
// Like night mode, this is read where an amount is drawn rather than passed down to
// every screen, and Root.tsx draws the app again when it changes.

const CURRENCY_KEY = 'display_currency';
const RATE_KEY = 'display_eur_rate';
// How long to leave it before asking again after a request for the rate has failed.
const RETRY_AFTER_MS = 30 * 1000;

let chosen: Currency = 'ALL';
// Lek per euro. The last one fetched is kept on the phone, so that euros can still be
// shown with no connection - at a rate a little out of date rather than not at all.
let rate: number | null = null;
let rateDay: string | null = null;
let isAsking = false;
let lastAskedAt = 0;

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Asks for today's rate, unless it is already in hand or was asked for a moment ago.
function refreshRate(): void {
  const day = today();
  if (chosen !== 'EUR' || isAsking || rateDay === day || Date.now() - lastAskedAt < RETRY_AFTER_MS) {
    return;
  }
  isAsking = true;
  lastAskedAt = Date.now();
  fetchEurRates([day])
    .then((rates) => {
      const fetched = rates[day];
      if (typeof fetched !== 'number' || fetched <= 0) {
        return;
      }
      const hasChanged = fetched !== rate;
      rate = fetched;
      rateDay = day;
      SecureStore.setItemAsync(RATE_KEY, JSON.stringify({ rate: fetched, day })).catch(() => undefined);
      if (hasChanged) {
        notify();
      }
    })
    // No connection, or not signed in yet: asked again the next time an amount is drawn.
    .catch(() => undefined)
    .finally(() => {
      isAsking = false;
    });
}

// What the switch is set to.
export function chosenDisplayCurrency(): Currency {
  return chosen;
}

// What amounts actually come out in: lek when euros were chosen but there is not yet
// any rate to get there with.
export function displayCurrency(): Currency {
  if (chosen !== 'EUR') {
    return 'ALL';
  }
  refreshRate();
  return rate === null ? 'ALL' : 'EUR';
}

// A lek amount in the currency on show. Lek stay bare, as they always have been.
export function showMoney(amountInLek: number, showCents = true): string {
  if (displayCurrency() === 'EUR') {
    return formatMoney(amountInLek / (rate as number), 'EUR', true);
  }
  return formatAmount(amountInLek, showCents);
}

// Cents only when the amount has any - for a lone figure rather than a column.
export function showMoneyLoose(amountInLek: number): string {
  return showMoney(amountInLek, needsCents([amountInLek]));
}

// A lek amount belonging to one invoice. An invoice written in euros goes back
// through its own rate, so it reads exactly as it did on the receipt.
export function showInvoiceMoney(
  amountInLek: number,
  invoice: { currency?: Currency | null; exchangeRate?: number | null },
  showCents = true,
): string {
  if (displayCurrency() === 'EUR' && invoiceCurrency(invoice) === 'EUR') {
    return formatMoney(amountInLek / invoiceRate(invoice), 'EUR', true);
  }
  return showMoney(amountInLek, showCents);
}

// A lek amount as the text of a field, in the currency on show: no symbol, and no
// cents unless there are some.
export function moneyInputText(amountInLek: number): string {
  const shown = displayCurrency() === 'EUR' ? amountInLek / (rate as number) : amountInLek;
  return formatAmount(shown).replace(/,00$/, '');
}

// What was typed into such a field, in lek. Given the amount the field started from,
// a field left as it was answers with that amount exactly: going to euros and back
// rounds, and a figure nobody touched must not come back a few qindarka off.
export function moneyFromInput(text: string, startedFromLek?: number | null): number {
  if (typeof startedFromLek === 'number' && text === moneyInputText(startedFromLek)) {
    return startedFromLek;
  }
  const typed = parseAmountInput(text);
  if (displayCurrency() !== 'EUR' || !Number.isFinite(typed)) {
    return typed;
  }
  return Math.round(typed * (rate as number) * 100) / 100;
}

// The mark to put beside a field that takes an amount.
export function moneyInputSymbol(): string {
  return CURRENCY_SYMBOL[displayCurrency()];
}

export async function restoreDisplayCurrency(): Promise<void> {
  try {
    chosen = (await SecureStore.getItemAsync(CURRENCY_KEY)) === 'EUR' ? 'EUR' : 'ALL';
    const saved = JSON.parse((await SecureStore.getItemAsync(RATE_KEY)) ?? 'null') as {
      rate?: unknown;
      day?: unknown;
    } | null;
    if (saved && typeof saved.rate === 'number' && saved.rate > 0 && typeof saved.day === 'string') {
      rate = saved.rate;
      rateDay = saved.day;
    }
  } catch {
    // Nothing saved that can be read: lek, as before.
  }
  refreshRate();
  // The rate changes once a day, and the app can sit open across midnight.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      refreshRate();
    }
  });
}

export function setDisplayCurrency(currency: Currency): void {
  if (currency === chosen) {
    return;
  }
  chosen = currency;
  SecureStore.setItemAsync(CURRENCY_KEY, currency).catch(() => undefined);
  // Asked for straight away, whatever was tried a moment ago.
  lastAskedAt = 0;
  refreshRate();
  notify();
}

export function onDisplayCurrencyChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
