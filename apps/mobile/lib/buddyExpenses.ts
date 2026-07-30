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

// Each buddy's own claimed quantity on a row is entirely their share. Whatever quantity is
// left unclaimed on that row is pooled and divided evenly across the owner + whichever buddies
// did NOT claim a specific quantity on that row themselves — a buddy who already took their
// own cut of a row doesn't also get a slice of what's left.
export function computeBuddyShareFromRows(rows: ShareableRow[], buddyUserId: string, allBuddyIds: string[]): number {
  let total = 0;
  for (const row of rows) {
    const myQuantity = row.buddyQuantities[buddyUserId] ?? 0;
    total += myQuantity * row.unitPrice;

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
  return computeBuddyShareFromRows(rows, buddyUserId, allBuddyIds);
}

export function buddyInvoiceShares(invoices: SavedInvoice[], buddyUserId: string): BuddyInvoiceShare[] {
  const shares: BuddyInvoiceShare[] = [];

  for (const invoice of invoices) {
    const buddyLink = invoice.data.buddies?.find((buddy) => buddy.userId === buddyUserId);
    if (!buddyLink) {
      continue;
    }
    shares.push({
      invoiceId: invoice.id,
      sellerName: invoice.data.seller.name,
      dateTimeCreated: invoice.data.dateTimeCreated,
      totalPrice: invoice.data.totalPrice,
      share: computeShareForBuddy(invoice, buddyUserId),
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
    for (const buddyLink of invoice.data.buddies ?? []) {
      const info = buddies.find((buddy) => buddy.id === buddyLink.userId);
      shares.push({
        invoiceId: invoice.id,
        sellerName: invoice.data.seller.name,
        dateTimeCreated: invoice.data.dateTimeCreated,
        totalPrice: invoice.data.totalPrice,
        share: computeShareForBuddy(invoice, buddyLink.userId),
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
    const myLink = invoice.data.buddies?.find((buddy) => buddy.userId === myUserId);
    if (!myLink) {
      continue;
    }
    shares.push({
      invoiceId: invoice.id,
      sellerName: invoice.data.seller.name,
      dateTimeCreated: invoice.data.dateTimeCreated,
      share: computeShareForBuddy(invoice, myUserId),
      paid: myLink.paid,
      ownerId: invoice.user.id,
      ownerName: invoice.user.name,
      ownerEmail: invoice.user.email,
      ownerAvatarUrl: invoice.user.avatarUrl,
    });
  }

  return shares.sort((a, b) => new Date(b.dateTimeCreated).getTime() - new Date(a.dateTimeCreated).getTime());
}
