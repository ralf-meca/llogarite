import { categoryLabel, DEFAULT_CATEGORY } from './categories';
import type { SavedInvoice } from './savedInvoicesApi';

export type CategorySpending = {
  key: string;
  label: string;
  total: number;
};

export function groupByCategory(invoices: SavedInvoice[]): CategorySpending[] {
  const totals = new Map<string, number>();

  for (const invoice of invoices) {
    for (const item of invoice.data.items) {
      const categoryId = item.category ?? DEFAULT_CATEGORY;
      const lineTotal = item.unitPriceAfterVat * item.quantity;
      totals.set(categoryId, (totals.get(categoryId) ?? 0) + lineTotal);
    }
  }

  return Array.from(totals.entries())
    .map(([key, total]) => ({ key, label: categoryLabel(key), total }))
    .sort((a, b) => b.total - a.total);
}

export function dominantCategory(invoice: SavedInvoice): string {
  const totals = new Map<string, number>();
  for (const item of invoice.data.items) {
    const categoryId = item.category ?? DEFAULT_CATEGORY;
    const lineTotal = item.unitPriceAfterVat * item.quantity;
    totals.set(categoryId, (totals.get(categoryId) ?? 0) + lineTotal);
  }

  let best: string = DEFAULT_CATEGORY;
  let bestTotal = -Infinity;
  for (const [id, total] of totals) {
    if (total > bestTotal) {
      bestTotal = total;
      best = id;
    }
  }
  return best;
}
