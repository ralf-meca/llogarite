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
  sellerName: string;
};

export type PriceStats = {
  average: number;
  lowest: number;
  lowestSeller: string | null;
  highest: number;
  highestSeller: string | null;
  count: number;
};

export type ChartPoint = {
  label: string;
  value: number;
};

export function normalizeKey(name: string): string {
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
        records.push({ date, price: item.unitPriceAfterVat, sellerName: invoice.data.seller.name });
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

export function priceStats(records: PriceRecord[]): PriceStats {
  if (records.length === 0) {
    return { average: 0, lowest: 0, lowestSeller: null, highest: 0, highestSeller: null, count: 0 };
  }

  const prices = records.map((record) => record.price);
  const lowestRecord = records.reduce((min, record) => (record.price < min.price ? record : min));
  const highestRecord = records.reduce((max, record) => (record.price > max.price ? record : max));

  return {
    average: prices.reduce((sum, price) => sum + price, 0) / prices.length,
    lowest: lowestRecord.price,
    lowestSeller: lowestRecord.sellerName,
    highest: highestRecord.price,
    highestSeller: highestRecord.sellerName,
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
