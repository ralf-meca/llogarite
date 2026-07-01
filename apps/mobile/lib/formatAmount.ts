export function formatAmount(value: number): string {
  const [integerPart, decimalPart = '00'] = value.toFixed(2).split('.');
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${withThousands},${decimalPart}`;
}
