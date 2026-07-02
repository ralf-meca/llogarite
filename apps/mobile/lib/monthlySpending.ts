import type { SavedInvoice } from './savedInvoicesApi';

export type MonthlySpending = {
  key: string;
  label: string;
  total: number;
};

const PIE_SEGMENT_LIMIT = 6;
const OTHER_LABEL = 'Të tjera';

export function groupByMonth(invoices: SavedInvoice[]): MonthlySpending[] {
  const totals = new Map<string, number>();

  for (const invoice of invoices) {
    const date = new Date(invoice.data.dateTimeCreated);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    totals.set(key, (totals.get(key) ?? 0) + invoice.data.totalPrice);
  }

  return Array.from(totals.entries())
    .map(([key, total]) => {
      const [year, month] = key.split('-').map(Number);
      const label = new Date(year, month - 1, 1).toLocaleDateString('sq-AL', { month: 'long', year: 'numeric' });
      return { key, label, total };
    })
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function toPieSegments(monthly: MonthlySpending[]): { label: string; total: number }[] {
  const sorted = [...monthly].sort((a, b) => b.total - a.total);
  if (sorted.length <= PIE_SEGMENT_LIMIT) {
    return sorted;
  }
  const top = sorted.slice(0, PIE_SEGMENT_LIMIT);
  const rest = sorted.slice(PIE_SEGMENT_LIMIT).reduce((sum, item) => sum + item.total, 0);
  return [...top, { label: OTHER_LABEL, total: rest }];
}
