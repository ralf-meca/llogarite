import type { SavedInvoice } from './savedInvoicesApi';

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
