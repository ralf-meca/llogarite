export function formatAmount(value: number): string {
  const [integerPart, decimalPart = '00'] = value.toFixed(2).split('.');
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${withThousands},${decimalPart}`;
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
