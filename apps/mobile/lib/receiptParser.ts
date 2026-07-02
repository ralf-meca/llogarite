import type { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { toLocalIsoString } from './date';
import type { InvoiceQrParams } from './invoiceApi';

export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

export type ParsedReceipt = {
  iic: string | null;
  tin: string | null;
  dateTimeCreated: string | null;
  sellerName: string | null;
  items: ParsedReceiptItem[];
};

type OcrCell = {
  text: string;
  top: number;
  left: number;
  height: number;
};

const IIC_PATTERN = /\b(?:IIC|NSLF)\b\s*[:#]?\s*([A-Z0-9]{16,}(?:-[A-Z0-9]{4,})*)/i;
const TIN_LABELED_PATTERN = /\b(?:NIPT|NUIS|TIN)\b\s*[:#]?\s*([A-Z][0-9]{8}[A-Z])/i;
const TIN_BARE_PATTERN = /\b([A-Z][0-9]{8}[A-Z])\b/;

const DATE_TIME_PATTERN = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})[,\s]+(\d{1,2})[:.\s](\d{2})(?::(\d{2}))?/;
const DATE_ONLY_PATTERN = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/;

const SELLER_LABEL_PATTERN = /njesia\s*e\s*biznesit/i;
const NON_NAME_LABEL_PATTERN =
  /(fatur[eë]|tatimore|shitje|artikull|rruga|^nr$|^[a-z]$|dat[eè]|or[eè]|lloji|pageses|operator|njesia|biznesit|sasi|[cç]mim|vlere|total)/i;
const DECIMAL_LINE_PATTERN = /^(\d{1,4})[.,\s](\d{2})$/;
const PURE_NUMBER_PATTERN = /^\d+(?:[.,]\d+)?$/;
const NAME_LETTERS_PATTERN = /[a-zëç]{2,}/i;

function toIsoDate(text: string): string | null {
  const withTime = text.match(DATE_TIME_PATTERN);
  if (withTime) {
    const [, day, month, year, hour, minute, second] = withTime;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0));
    return Number.isNaN(date.getTime()) ? null : toLocalIsoString(date);
  }
  const dateOnly = text.match(DATE_ONLY_PATTERN);
  if (dateOnly) {
    const [, day, month, year] = dateOnly;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : toLocalIsoString(date);
  }
  return null;
}

function parseNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function isLikelySellerName(line: string): boolean {
  return line.length > 2 && NAME_LETTERS_PATTERN.test(line) && !NON_NAME_LABEL_PATTERN.test(line);
}

function extractSellerName(lines: string[]): string | null {
  const labelIndex = lines.findIndex((line) => SELLER_LABEL_PATTERN.test(line));
  if (labelIndex !== -1) {
    const nameLine = lines.slice(labelIndex + 1).find(isLikelySellerName);
    if (nameLine) {
      return nameLine;
    }
  }
  return lines.find(isLikelySellerName) ?? (lines.length > 0 ? lines[0] : null);
}

function extractTotalWithVat(lines: string[]): number | null {
  const decimalLines = lines.filter((line) => DECIMAL_LINE_PATTERN.test(line));
  if (decimalLines.length < 3) {
    return null;
  }
  const totalLine = decimalLines[decimalLines.length - 3];
  const match = totalLine.match(DECIMAL_LINE_PATTERN);
  if (!match) {
    return null;
  }
  const [, whole, fraction] = match;
  return Number(`${whole}.${fraction}`);
}

function flattenCells(result: TextRecognitionResult): OcrCell[] {
  const cells: OcrCell[] = [];
  for (const block of result.blocks) {
    for (const line of block.lines) {
      if (!line.frame) {
        continue;
      }
      cells.push({ text: line.text, top: line.frame.top, left: line.frame.left, height: line.frame.height });
    }
  }
  return cells;
}

function groupIntoRows(cells: OcrCell[]): OcrCell[][] {
  const sorted = [...cells].sort((a, b) => a.top + a.height / 2 - (b.top + b.height / 2));
  const rows: OcrCell[][] = [];

  for (const cell of sorted) {
    const center = cell.top + cell.height / 2;
    const row = rows.find((candidate) => {
      const avgCenter = candidate.reduce((sum, c) => sum + c.top + c.height / 2, 0) / candidate.length;
      const avgHeight = candidate.reduce((sum, c) => sum + c.height, 0) / candidate.length;
      const tolerance = Math.max(avgHeight, cell.height) * 0.6;
      return Math.abs(center - avgCenter) <= tolerance;
    });
    if (row) {
      row.push(cell);
    } else {
      rows.push([cell]);
    }
  }

  return rows.map((row) => row.sort((a, b) => a.left - b.left));
}

function isLikelyItemNameFragment(text: string): boolean {
  return NAME_LETTERS_PATTERN.test(text) && !NON_NAME_LABEL_PATTERN.test(text);
}

const ROW_INDEX_PATTERN = /^\d{1,3}$/;

function tryExtractItem(row: OcrCell[], pendingNamePrefix: string): ParsedReceiptItem | null {
  const numberCells: string[] = [];
  let firstNumberIndex = -1;
  row.forEach((cell, index) => {
    const trimmed = cell.text.trim();
    if (PURE_NUMBER_PATTERN.test(trimmed)) {
      numberCells.push(trimmed);
      if (firstNumberIndex === -1) {
        firstNumberIndex = index;
      }
    }
  });

  if (numberCells.length < 2 || firstNumberIndex < 1) {
    return null;
  }

  const namePart = row
    .slice(0, firstNumberIndex)
    .map((cell) => cell.text)
    .join(' ')
    .trim();
  const name = [pendingNamePrefix, namePart].filter(Boolean).join(' ').trim();
  if (!NAME_LETTERS_PATTERN.test(name)) {
    return null;
  }

  const unitPrice = parseNumber(numberCells[numberCells.length - 1]);
  if (!Number.isFinite(unitPrice)) {
    return null;
  }

  return { name, quantity: 1, unitPrice };
}

function extractItemsFromRows(rows: OcrCell[][]): ParsedReceiptItem[] {
  const items: ParsedReceiptItem[] = [];
  let pendingNamePrefix = '';

  for (const row of rows) {
    const hasNumbers = row.some((cell) => PURE_NUMBER_PATTERN.test(cell.text.trim()));

    if (!hasNumbers) {
      const rowText = row
        .map((cell) => cell.text)
        .join(' ')
        .trim();
      pendingNamePrefix = isLikelyItemNameFragment(rowText) ? rowText : '';
      continue;
    }

    let item = tryExtractItem(row, pendingNamePrefix);
    if (!item && row.length > 1 && ROW_INDEX_PATTERN.test(row[0].text.trim())) {
      item = tryExtractItem(row.slice(1), pendingNamePrefix);
    }
    pendingNamePrefix = '';

    if (item) {
      items.push(item);
    }
  }

  return items;
}

export function parseReceipt(result: TextRecognitionResult): ParsedReceipt {
  const text = result.text;
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const iicMatch = text.match(IIC_PATTERN);
  const tinMatch = text.match(TIN_LABELED_PATTERN) ?? text.match(TIN_BARE_PATTERN);
  const dateTimeCreated = toIsoDate(text);
  const sellerName = extractSellerName(lines);

  const rows = groupIntoRows(flattenCells(result));
  console.log(
    '[OCR rows]',
    JSON.stringify(rows.map((row) => row.map((cell) => cell.text))),
  );
  let items = extractItemsFromRows(rows);

  if (items.length === 0) {
    const totalWithVat = extractTotalWithVat(lines);
    if (totalWithVat !== null) {
      items = [{ name: 'Artikuj (rishiko detajet)', quantity: 1, unitPrice: totalWithVat }];
    }
  }

  return {
    iic: iicMatch ? iicMatch[1] : null,
    tin: tinMatch ? tinMatch[1].toUpperCase() : null,
    dateTimeCreated,
    sellerName,
    items,
  };
}

export function toQrParams(parsed: ParsedReceipt): InvoiceQrParams | null {
  if (!parsed.iic || !parsed.tin || !parsed.dateTimeCreated) {
    return null;
  }
  return { iic: parsed.iic, tin: parsed.tin, dateTimeCreated: parsed.dateTimeCreated };
}
