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

export function computeShare(invoice: SavedInvoice): number {
  return invoice.data.totalPrice / shareCount(invoice);
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
      share: computeShare(invoice),
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
        share: computeShare(invoice),
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
    const count = (invoice.data.buddies?.length ?? 0) + 1;
    shares.push({
      invoiceId: invoice.id,
      sellerName: invoice.data.seller.name,
      dateTimeCreated: invoice.data.dateTimeCreated,
      share: invoice.data.totalPrice / count,
      paid: myLink.paid,
      ownerId: invoice.user.id,
      ownerName: invoice.user.name,
      ownerEmail: invoice.user.email,
      ownerAvatarUrl: invoice.user.avatarUrl,
    });
  }

  return shares.sort((a, b) => new Date(b.dateTimeCreated).getTime() - new Date(a.dateTimeCreated).getTime());
}
