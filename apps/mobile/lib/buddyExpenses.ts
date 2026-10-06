import type { Buddy } from './buddiesApi';
import type { OwedInvoice, SavedInvoice } from './savedInvoicesApi';

export type BuddyInvoiceShare = {
  invoiceId: string;
  sellerName: string;
  dateTimeCreated: string;
  totalPrice: number;
  share: number;
  paid: boolean;
};

export function shareCount(invoice: SavedInvoice): number {
  return (invoice.data.buddies?.length ?? 0) + 1;
}

export type ShareableRow = {
  quantity: number;
  unitPrice: number;
  buddyQuantities: Record<string, number>;
};

// Whether a bill is divided row by row. Invoices saved since the form began to say so carry
// the answer; an older one is divided row by row if anyone was given a quantity on any row.
export function isSplitByItem(rows: ShareableRow[], stored?: boolean | null): boolean {
  if (typeof stored === 'boolean') {
    return stored;
  }
  return rows.some((row) => Object.values(row.buddyQuantities).some((quantity) => quantity > 0));
}

// A bill is divided one of two ways.
//
// Row by row: each buddy owes exactly the quantities put against their name, and nothing on a
// row they were taken off. What nobody was given is the owner's.
//
// Evenly: no row names anyone, and every row is shared equally by the owner and all the
// buddies.
//
// The two must not be mixed. A buddy taken off a row is stored as having no quantity there,
// which is also what "no row names anyone" looks like - so reading it row by row as "shares
// what is left" charged people for rows they had been removed from.
export function computeBuddyShareFromRows(
  rows: ShareableRow[],
  buddyUserId: string,
  allBuddyIds: string[],
  splitByItem?: boolean | null,
): number {
  const byItem = isSplitByItem(rows, splitByItem);
  let total = 0;
  for (const row of rows) {
    const myQuantity = row.buddyQuantities[buddyUserId] ?? 0;
    total += myQuantity * row.unitPrice;
    if (byItem) {
      continue;
    }

    const assignedQuantity = Object.values(row.buddyQuantities).reduce((sum, qty) => sum + qty, 0);
    const remainingQuantity = Math.max(0, row.quantity - assignedQuantity);
    if (remainingQuantity <= 0) {
      continue;
    }

    const participatesInRemainder = (id: string) => (row.buddyQuantities[id] ?? 0) === 0;
    if (!participatesInRemainder(buddyUserId)) {
      continue;
    }
    const participantCount = 1 + allBuddyIds.filter(participatesInRemainder).length;
    total += (remainingQuantity * row.unitPrice) / participantCount;
  }
  return total;
}

export function computeShareForBuddy(invoice: SavedInvoice, buddyUserId: string): number {
  const allBuddyIds = (invoice.data.buddies ?? []).map((buddy) => buddy.userId);
  const rows: ShareableRow[] = (invoice.data.items ?? []).map((item) => ({
    quantity: item.quantity,
    unitPrice: item.unitPriceAfterVat,
    buddyQuantities: item.buddyQuantities ?? {},
  }));
  return computeBuddyShareFromRows(rows, buddyUserId, allBuddyIds, invoice.data.itemSplit);
}

// These lists are all "what a buddy owes the invoice's owner". An invoice a
// buddy paid for turns that around - the debts run to that buddy - so it is
// left out of them and settled from the trip it belongs to instead.
function paidBySomeoneElse(invoice: {
  data: { paidBy?: string | null; payments?: Record<string, number> | null };
}): boolean {
  return Boolean(invoice.data.paidBy) || Object.values(invoice.data.payments ?? {}).some((amount) => amount > 0);
}

// What a buddy still owes on an invoice: their share, less whatever has
// already been balanced away against the owner's debts to them.
function remainingShare(invoice: SavedInvoice, buddyUserId: string): number {
  const settled = invoice.data.buddies?.find((buddy) => buddy.userId === buddyUserId)?.settled ?? 0;
  return Math.max(0, computeShareForBuddy(invoice, buddyUserId) - settled);
}

export function buddyInvoiceShares(invoices: SavedInvoice[], buddyUserId: string): BuddyInvoiceShare[] {
  const shares: BuddyInvoiceShare[] = [];

  for (const invoice of invoices) {
    if (paidBySomeoneElse(invoice)) {
      continue;
    }
    const buddyLink = invoice.data.buddies?.find((buddy) => buddy.userId === buddyUserId);
    if (!buddyLink) {
      continue;
    }
    shares.push({
      invoiceId: invoice.id,
      sellerName: invoice.data.seller.name,
      dateTimeCreated: invoice.data.dateTimeCreated,
      totalPrice: invoice.data.totalPrice,
      share: remainingShare(invoice, buddyUserId),
      paid: buddyLink.paid,
    });
  }

  return shares.sort((a, b) => new Date(b.dateTimeCreated).getTime() - new Date(a.dateTimeCreated).getTime());
}

export function unpaidTotal(shares: BuddyInvoiceShare[]): number {
  return shares.filter((share) => !share.paid).reduce((sum, share) => sum + share.share, 0);
}

export type BuddyInvoiceShareWithBuddy = BuddyInvoiceShare & {
  buddyId: string;
  buddyName: string | null;
  buddyEmail: string;
  buddyAvatarUrl: string | null;
};

export function allBuddyInvoiceShares(invoices: SavedInvoice[], buddies: Buddy[]): BuddyInvoiceShareWithBuddy[] {
  const shares: BuddyInvoiceShareWithBuddy[] = [];

  for (const invoice of invoices) {
    if (paidBySomeoneElse(invoice)) {
      continue;
    }
    for (const buddyLink of invoice.data.buddies ?? []) {
      const info = buddies.find((buddy) => buddy.id === buddyLink.userId);
      shares.push({
        invoiceId: invoice.id,
        sellerName: invoice.data.seller.name,
        dateTimeCreated: invoice.data.dateTimeCreated,
        totalPrice: invoice.data.totalPrice,
        share: remainingShare(invoice, buddyLink.userId),
        paid: buddyLink.paid,
        buddyId: buddyLink.userId,
        buddyName: info?.name ?? null,
        buddyEmail: info?.email ?? '',
        buddyAvatarUrl: info?.avatarUrl ?? null,
      });
    }
  }

  return shares.sort((a, b) => new Date(b.dateTimeCreated).getTime() - new Date(a.dateTimeCreated).getTime());
}

export type OwedShare = {
  invoiceId: string;
  sellerName: string;
  dateTimeCreated: string;
  share: number;
  paid: boolean;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  ownerAvatarUrl: string | null;
};

export function owedByMeShares(invoices: OwedInvoice[], myUserId: string): OwedShare[] {
  const shares: OwedShare[] = [];

  for (const invoice of invoices) {
    if (paidBySomeoneElse(invoice)) {
      continue;
    }
    const myLink = invoice.data.buddies?.find((buddy) => buddy.userId === myUserId);
    if (!myLink) {
      continue;
    }
    shares.push({
      invoiceId: invoice.id,
      sellerName: invoice.data.seller.name,
      dateTimeCreated: invoice.data.dateTimeCreated,
      share: remainingShare(invoice, myUserId),
      paid: myLink.paid,
      ownerId: invoice.user.id,
      ownerName: invoice.user.name,
      ownerEmail: invoice.user.email,
      ownerAvatarUrl: invoice.user.avatarUrl,
    });
  }

  return shares.sort((a, b) => new Date(b.dateTimeCreated).getTime() - new Date(a.dateTimeCreated).getTime());
}
