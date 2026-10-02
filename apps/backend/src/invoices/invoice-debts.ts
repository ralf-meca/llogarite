// Who still owes what on one invoice, worked out the way the app does: each
// buddy's own claimed quantity on a row is theirs, what is left of the row is
// split evenly between the owner and the buddies who claimed nothing on it,
// and whatever someone paid at the till comes off their share.

type Item = { quantity: number; unitPrice: number; buddyQuantities: Record<string, number> };
type BuddyLink = { userId: string; paid: boolean };

// Amounts closer than this are the same amount.
const EPSILON = 0.005;

function readItems(data: Record<string, unknown>): Item[] {
    const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
    return items.map((item) => ({
        quantity: Number(item?.quantity ?? 0) || 0,
        unitPrice: Number(item?.unitPriceAfterVat ?? 0) || 0,
        buddyQuantities:
            item?.buddyQuantities && typeof item.buddyQuantities === 'object'
                ? (item.buddyQuantities as Record<string, number>)
                : {},
    }));
}

function readBuddies(data: Record<string, unknown>): BuddyLink[] {
    const buddies = Array.isArray(data.buddies) ? (data.buddies as Array<Record<string, unknown>>) : [];
    return buddies
        .filter((buddy) => typeof buddy?.userId === 'string')
        .map((buddy) => ({ userId: buddy.userId as string, paid: buddy.paid === true }));
}

function shareOf(items: Item[], buddyId: string, buddyIds: string[]): number {
    let total = 0;
    for (const item of items) {
        const own = Number(item.buddyQuantities[buddyId] ?? 0) || 0;
        total += own * item.unitPrice;

        const assigned = Object.values(item.buddyQuantities).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
        const remaining = Math.max(0, item.quantity - assigned);
        if (remaining <= 0 || own !== 0) {
            continue;
        }
        const sharers = 1 + buddyIds.filter((id) => (Number(item.buddyQuantities[id] ?? 0) || 0) === 0).length;
        total += (remaining * item.unitPrice) / sharers;
    }
    return total;
}

// What each buddy paid at the till. An older invoice names one buddy who paid
// all of it (paidBy) instead of amounts.
function tillPayments(data: Record<string, unknown>, buddyIds: string[], total: number): Record<string, number> {
    const stored: Record<string, unknown> =
        data.payments && typeof data.payments === 'object'
            ? (data.payments as Record<string, unknown>)
            : typeof data.paidBy === 'string' && data.paidBy
              ? { [data.paidBy]: total }
              : {};
    const payments: Record<string, number> = {};
    for (const buddyId of buddyIds) {
        const amount = Number(stored[buddyId]);
        if (Number.isFinite(amount) && amount > EPSILON) {
            payments[buddyId] = amount;
        }
    }
    return payments;
}

// Whether money is still owed, either way, between an invoice's owner and one
// of the buddies on it.
export function hasUnsettledDebtWith(data: Record<string, unknown>, buddyId: string): boolean {
    const buddies = readBuddies(data);
    const link = buddies.find((buddy) => buddy.userId === buddyId);
    if (!link) {
        return false;
    }
    const items = readItems(data);
    const buddyIds = buddies.map((buddy) => buddy.userId);
    const total = Number(data.totalPrice ?? 0) || 0;
    const payments = tillPayments(data, buddyIds, total);

    const share = shareOf(items, buddyId, buddyIds);
    const paidAtTill = payments[buddyId] ?? 0;
    if (share - paidAtTill > EPSILON && !link.paid) {
        return true;
    }

    // The other direction: this buddy put in more than their share, and the
    // owner has not yet covered their own.
    const buddiesShare = buddyIds.reduce((sum, id) => sum + shareOf(items, id, buddyIds), 0);
    const buddiesPaid = Object.values(payments).reduce((sum, amount) => sum + amount, 0);
    const ownerDebt = total - buddiesShare - (total - buddiesPaid);
    return paidAtTill - share > EPSILON && ownerDebt > EPSILON && data.ownerPaid !== true;
}
