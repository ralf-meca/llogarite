import type { Language } from './i18n';
import type { SavedInvoice } from './savedInvoicesApi';

const LOCALE_BY_LANGUAGE: Record<Language, string> = { sq: 'sq-AL', en: 'en-US' };

export type ProductSummary = {
  key: string;
  name: string;
};

export type PriceRecord = {
  date: Date;
  price: number;
};

export type PriceStats = {
  average: number;
  lowest: number;
  highest: number;
  count: number;
};

export type ChartPoint = {
  label: string;
  value: number;
};

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

export function listProducts(invoices: SavedInvoice[]): ProductSummary[] {
  const latestByKey = new Map<string, { name: string; date: Date }>();

  for (const invoice of invoices) {
    const date = new Date(invoice.data.dateTimeCreated);
    for (const item of invoice.data.items) {
      const key = normalizeKey(item.name);
      if (!key) {
        continue;
      }
      const existing = latestByKey.get(key);
      if (!existing || date.getTime() > existing.date.getTime()) {
        latestByKey.set(key, { name: item.name.trim(), date });
      }
    }
  }

  return Array.from(latestByKey.entries())
    .map(([key, entry]) => ({ key, name: entry.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'sq'));
}

export function getProductRecords(invoices: SavedInvoice[], productKey: string): PriceRecord[] {
  const records: PriceRecord[] = [];

  for (const invoice of invoices) {
    const date = new Date(invoice.data.dateTimeCreated);
    for (const item of invoice.data.items) {
      if (normalizeKey(item.name) === productKey) {
        records.push({ date, price: item.unitPriceAfterVat });
      }
    }
  }

  return records.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function last30DaysStats(records: PriceRecord[]): PriceStats {
  const cutoff = daysAgo(30);
  const recent = records.filter((record) => record.date.getTime() >= cutoff.getTime());

  if (recent.length === 0) {
    return { average: 0, lowest: 0, highest: 0, count: 0 };
  }

  const prices = recent.map((record) => record.price);
  return {
    average: prices.reduce((sum, price) => sum + price, 0) / prices.length,
    lowest: Math.min(...prices),
    highest: Math.max(...prices),
    count: prices.length,
  };
}

export function monthlyChartPoints(records: PriceRecord[]): ChartPoint[] {
  const cutoff = daysAgo(30);
  return records
    .filter((record) => record.date.getTime() >= cutoff.getTime())
    .map((record) => ({
      label: `${String(record.date.getDate()).padStart(2, '0')}/${String(record.date.getMonth() + 1).padStart(2, '0')}`,
      value: record.price,
    }));
}

export function yearlyChartPoints(records: PriceRecord[], language: Language = 'sq'): ChartPoint[] {
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  cursor.setMonth(cursor.getMonth() - 11);
  const startTime = cursor.getTime();

  const byMonth = new Map<string, number[]>();
  for (const record of records) {
    if (record.date.getTime() < startTime) {
      continue;
    }
    const key = `${record.date.getFullYear()}-${String(record.date.getMonth() + 1).padStart(2, '0')}`;
    const list = byMonth.get(key) ?? [];
    list.push(record.price);
    byMonth.set(key, list);
  }

  const points: ChartPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const prices = byMonth.get(key);
    if (prices && prices.length > 0) {
      points.push({
        label: cursor.toLocaleDateString(LOCALE_BY_LANGUAGE[language], { month: 'short' }),
        value: prices.reduce((sum, price) => sum + price, 0) / prices.length,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}
