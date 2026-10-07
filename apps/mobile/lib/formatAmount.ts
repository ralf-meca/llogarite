export function formatAmount(value: number, showDecimals = true): string {
  if (!showDecimals) {
    // Rounded rather than truncated: a value only reaches here when the table
    // it belongs to has no cents, so 5.999999 is 6 that floating point mangled.
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }
  const [integerPart, decimalPart = '00'] = value.toFixed(2).split('.');
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${withThousands},${decimalPart}`;
}

// A table of whole amounts reads better without a column of ",00". The call is
// made per table, never per value: one amount with cents puts them on all of
// them, so the decimal separators stay in a line down the column.
export function needsCents(values: number[]): boolean {
  return values.some((value) => Number.isFinite(value) && Math.round(value * 100) % 100 !== 0);
}

// Cents only when there are any: 1'595 rather than 1'595,00, while 187,50 keeps
// its 50. Per number, unlike needsCents, which answers for a whole table at
// once so its rows line up - a lone figure has no rows to line up with.
export function formatAmountLoose(value: number): string {
  return formatAmount(value, needsCents([value]));
}

// The most any number field takes. Typing past it leaves the field at this figure,
// which keeps a slipped finger - an extra zero or two - from being saved as an amount.
export const MAX_INPUT_VALUE = 100000;

export function formatAmountInput(raw: string): string {
  const isNegative = raw.trim().startsWith('-');
  const cleaned = raw.replace(/[^0-9,]/g, '');
  const [integerPart = '', decimalPart] = cleaned.split(',');
  const whole = Number(integerPart || '0');
  if (whole > MAX_INPUT_VALUE || (whole === MAX_INPUT_VALUE && Number(decimalPart || '0') > 0)) {
    return `${isNegative ? '-' : ''}${String(MAX_INPUT_VALUE).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`;
  }
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const sign = isNegative ? '-' : '';
  return cleaned.includes(',') ? `${sign}${withThousands},${decimalPart ?? ''}` : `${sign}${withThousands}`;
}

// For a field that is typed as a plain number rather than an amount - a quantity.
export function capNumberInput(raw: string): string {
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value > MAX_INPUT_VALUE ? String(MAX_INPUT_VALUE) : raw;
}

export function parseAmountInput(raw: string): number {
  return Number(raw.replace(/'/g, '').replace(',', '.'));
}
