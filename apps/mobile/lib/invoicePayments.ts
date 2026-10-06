import { computeBuddyShareFromRows, type ShareableRow } from './buddyExpenses';
import type { InvoiceVerificationResult } from './invoiceApi';

// Amounts closer than this are the same amount; they only differ by what
// floating point did to an even split.
export const AMOUNT_EPSILON = 0.005;

// Where one person stands on one invoice: what their part of the bill comes
// to, what they handed over at the till, and what that leaves them owing.
export type PersonDebt = {
  share: number;
  paidAtTill: number;
  debt: number;
};

export type InvoiceDebts = {
  owner: PersonDebt;
  buddies: Record<string, PersonDebt>;
  // True when anyone other than the owner put money in at the till.
  hasOtherPayers: boolean;
};

type PaymentData = Pick<
  InvoiceVerificationResult,
  'totalPrice' | 'items' | 'buddies' | 'payments' | 'paidBy' | 'itemSplit'
>;

// What each buddy paid at the till. Only buddies are stored: the owner's part
// is whatever the others did not cover. An older invoice names a single payer
// (paidBy) instead, which reads as that buddy having paid all of it.
export function buddyTillPayments(data: PaymentData): Record<string, number> {
  const stored: Record<string, number> = data.payments ?? (data.paidBy ? { [data.paidBy]: data.totalPrice } : {});
  const payments: Record<string, number> = {};
  for (const buddy of data.buddies ?? []) {
    const amount = stored[buddy.userId];
    if (typeof amount === 'number' && amount > AMOUNT_EPSILON) {
      payments[buddy.userId] = amount;
    }
  }
  return payments;
}

// `settled` is what was already balanced away against the owner's own debts.
function debtOf(share: number, paidAtTill: number, settled = 0): PersonDebt {
  const debt = share - paidAtTill - settled;
  return { share, paidAtTill, debt: debt > AMOUNT_EPSILON ? debt : 0 };
}

// Everyone's position on an invoice. With nothing recorded the owner paid it
// all, so they owe nothing and each buddy owes their share - which is how
// every invoice worked before payers could be named.
export function invoiceDebts(data: PaymentData): InvoiceDebts {
  const buddyIds = (data.buddies ?? []).map((buddy) => buddy.userId);
  const rows: ShareableRow[] = (data.items ?? []).map((item) => ({
    quantity: item.quantity,
    unitPrice: item.unitPriceAfterVat,
    buddyQuantities: item.buddyQuantities ?? {},
  }));
  const payments = buddyTillPayments(data);
  const total = data.totalPrice ?? 0;

  const buddies: Record<string, PersonDebt> = {};
  let buddiesShare = 0;
  let buddiesPaid = 0;
  for (const buddyId of buddyIds) {
    const share = computeBuddyShareFromRows(rows, buddyId, buddyIds, data.itemSplit);
    const paid = payments[buddyId] ?? 0;
    buddiesShare += share;
    buddiesPaid += paid;
    const settled = data.buddies?.find((buddy) => buddy.userId === buddyId)?.settled ?? 0;
    buddies[buddyId] = debtOf(share, paid, settled);
  }

  return {
    owner: debtOf(Math.max(0, total - buddiesShare), Math.max(0, total - buddiesPaid)),
    buddies,
    hasOtherPayers: buddiesPaid > AMOUNT_EPSILON,
  };
}
