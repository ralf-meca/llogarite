import { formatAmount, needsCents } from './formatAmount';

// Every amount the app stores is in lek. An invoice written in another
// currency also keeps the rate it was converted at, so the figures printed on
// the receipt can be had back by dividing - nothing is stored twice.
export const CURRENCIES = ['ALL', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<Currency, string> = { ALL: 'ALL', EUR: '€' };

type CurrencyFields = { currency?: Currency | null; exchangeRate?: number | null };

function hasRate(data: CurrencyFields): boolean {
  return typeof data.exchangeRate === 'number' && Number.isFinite(data.exchangeRate) && data.exchangeRate > 0;
}

// The currency an invoice was written in. Lek unless it both names another
// and carries the rate to get back to it.
export function invoiceCurrency(data: CurrencyFields): Currency {
  return data.currency === 'EUR' && hasRate(data) ? 'EUR' : 'ALL';
}

// Lek per one unit of the invoice's currency; 1 for an invoice in lek.
export function invoiceRate(data: CurrencyFields): number {
  return invoiceCurrency(data) === 'ALL' ? 1 : (data.exchangeRate as number);
}

// Lek stay bare, as they are everywhere in the app; anything else is marked.
// Cents follow the amount unless the caller is lining up a column.
export function formatMoney(amount: number, currency: Currency, showCents = needsCents([amount])): string {
  const text = formatAmount(amount, showCents);
  return currency === 'ALL' ? text : `${text} ${CURRENCY_SYMBOL[currency]}`;
}

// A rate as it is typed and shown: decimal comma, no trailing zeros.
export function formatRate(rate: number): string {
  return String(Math.round(rate * 10000) / 10000).replace('.', ',');
}

// Lek per euro by day (YYYY-MM-DD), as fetched for invoices that carry no rate
// of their own.
export type RateBook = Record<string, number>;

type ConvertibleInvoice = CurrencyFields & { dateTimeCreated: string };

export type MoneyConverter = {
  // What the amounts come out in. Lek when that was asked for, and also when
  // euros were asked for but no rate at all could be found to get there.
  currency: Currency;
  // A lek amount belonging to the given invoice, in `currency`.
  convert: (amountInLek: number, invoice: ConvertibleInvoice) => number;
};

// Shows a set of invoices in one currency. An invoice written in euros goes
// back through its own rate. One written in lek uses the rate of its day, and
// failing that the average of the rates that are known - close enough for a
// list, and better than mixing two currencies in one column.
export function moneyConverter(target: Currency, invoices: ConvertibleInvoice[], rates: RateBook): MoneyConverter {
  if (target === 'ALL') {
    return { currency: 'ALL', convert: (amountInLek) => amountInLek };
  }
  const known = [
    ...invoices.filter((invoice) => invoiceCurrency(invoice) === 'EUR').map((invoice) => invoiceRate(invoice)),
    ...Object.values(rates),
  ];
  const fallback = known.length > 0 ? known.reduce((sum, rate) => sum + rate, 0) / known.length : null;
  const rateFor = (invoice: ConvertibleInvoice): number | null =>
    invoiceCurrency(invoice) === 'EUR'
      ? invoiceRate(invoice)
      : (rates[invoice.dateTimeCreated.slice(0, 10)] ?? fallback);

  if (invoices.some((invoice) => rateFor(invoice) === null)) {
    return { currency: 'ALL', convert: (amountInLek) => amountInLek };
  }
  return {
    currency: 'EUR',
    convert: (amountInLek, invoice) => amountInLek / (rateFor(invoice) as number),
  };
}

// The days whose rate has to be fetched to show these invoices in euros: the
// ones written in lek, which carry no rate of their own.
export function datesNeedingRates(invoices: ConvertibleInvoice[]): string[] {
  return [
    ...new Set(
      invoices
        .filter((invoice) => invoiceCurrency(invoice) === 'ALL')
        .map((invoice) => invoice.dateTimeCreated.slice(0, 10)),
    ),
  ];
}
