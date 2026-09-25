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

export function formatAmountInput(raw: string): string {
  const isNegative = raw.trim().startsWith('-');
  const cleaned = raw.replace(/[^0-9,]/g, '');
  const [integerPart = '', decimalPart] = cleaned.split(',');
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const sign = isNegative ? '-' : '';
  return cleaned.includes(',') ? `${sign}${withThousands},${decimalPart ?? ''}` : `${sign}${withThousands}`;
}

export function parseAmountInput(raw: string): number {
  return Number(raw.replace(/'/g, '').replace(',', '.'));
}
