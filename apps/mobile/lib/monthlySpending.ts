import type { Language } from './i18n';
import { toPieSegments } from './pieSegments';
import type { SavedInvoice } from './savedInvoicesApi';

export type MonthlySpending = {
  key: string;
  label: string;
  total: number;
};

export { toPieSegments };

const LOCALE_BY_LANGUAGE: Record<Language, string> = { sq: 'sq-AL', en: 'en-US' };

export function monthKeyOf(dateTimeCreated: string): string {
  const date = new Date(dateTimeCreated);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabelOf(key: string, language: Language = 'sq'): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
    month: 'long',
    year: 'numeric',
  });
}

export function groupByMonth(invoices: SavedInvoice[], language: Language = 'sq'): MonthlySpending[] {
  const totals = new Map<string, number>();

  for (const invoice of invoices) {
    const key = monthKeyOf(invoice.data.dateTimeCreated);
    totals.set(key, (totals.get(key) ?? 0) + invoice.data.totalPrice);
  }

  return Array.from(totals.entries())
    .map(([key, total]) => ({ key, label: monthLabelOf(key, language), total }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthTotal(invoices: SavedInvoice[]): number {
  const currentKey = currentMonthKey();
  return invoices.reduce((sum, invoice) => {
    return monthKeyOf(invoice.data.dateTimeCreated) === currentKey ? sum + invoice.data.totalPrice : sum;
  }, 0);
}
