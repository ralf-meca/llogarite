// Who still owes what on one invoice, worked out the way the app does. A bill
// is divided either row by row - each buddy owes the quantities against their
// name and nothing on a row they were taken off - or evenly, every row shared
// by the owner and all the buddies. Whatever someone paid at the till comes
// off their share.

type Item = { quantity: number; unitPrice: number; buddyQuantities: Record<string, number> };
// `settled` is what has already been taken off this buddy's share by balancing
// it against what the owner owed them elsewhere - a share can be part settled.
type BuddyLink = { userId: string; paid: boolean; settled: number };

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
        .map((buddy) => ({
            userId: buddy.userId as string,
            paid: buddy.paid === true,
            settled: Math.max(0, Number(buddy.settled) || 0),
        }));
}

// Whether the bill is divided row by row. Invoices saved since the app began
// to say so carry the answer (itemSplit); an older one is divided row by row
// if anyone was given a quantity on any row.
function isSplitByItem(data: Record<string, unknown>, items: Item[]): boolean {
    if (typeof data.itemSplit === 'boolean') {
        return data.itemSplit;
    }
    return items.some((item) => Object.values(item.buddyQuantities).some((qty) => (Number(qty) || 0) > 0));
}

function shareOf(items: Item[], buddyId: string, buddyIds: string[], byItem: boolean): number {
    let total = 0;
    for (const item of items) {
        const own = Number(item.buddyQuantities[buddyId] ?? 0) || 0;
        total += own * item.unitPrice;
        // Row by row, a buddy with nothing against their name on a row owes
        // nothing for it: what is left of the row is the owner's.
        if (byItem) {
            continue;
        }

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

    const byItem = isSplitByItem(data, items);
    const share = shareOf(items, buddyId, buddyIds, byItem);
    const paidAtTill = payments[buddyId] ?? 0;
    if (share - paidAtTill - link.settled > EPSILON && !link.paid) {
        return true;
    }

    // The other direction: this buddy put in more than their share, and the
    // owner has not yet covered their own.
    const buddiesShare = buddyIds.reduce((sum, id) => sum + shareOf(items, id, buddyIds, byItem), 0);
    const buddiesPaid = Object.values(payments).reduce((sum, amount) => sum + amount, 0);
    const ownerDebt = total - buddiesShare - (total - buddiesPaid);
    return paidAtTill - share > EPSILON && ownerDebt > EPSILON && data.ownerPaid !== true;
}

// What one buddy still owes the owner on an invoice the owner paid for in
// full: their share, less anything already balanced away. Nothing when they
// are not on it, are marked paid, or when buddies paid at the till - those
// debts do not run simply buddy-to-owner, so they are left out of balancing,
// the same as they are left out of the "owed" lists in the app.
export function remainingBuddyDebt(data: Record<string, unknown>, buddyId: string): number {
    const buddies = readBuddies(data);
    const link = buddies.find((buddy) => buddy.userId === buddyId);
    if (!link || link.paid) {
        return 0;
    }
    const buddyIds = buddies.map((buddy) => buddy.userId);
    const total = Number(data.totalPrice ?? 0) || 0;
    if (Object.keys(tillPayments(data, buddyIds, total)).length > 0) {
        return 0;
    }
    const items = readItems(data);
    const debt = shareOf(items, buddyId, buddyIds, isSplitByItem(data, items)) - link.settled;
    return debt > EPSILON ? debt : 0;
}

// Takes `amount` off a buddy's debt on an invoice, marking the share paid when
// that clears it. Returns the invoice data to store.
export function settleBuddyDebt(
    data: Record<string, unknown>,
    buddyId: string,
    amount: number,
): Record<string, unknown> {
    const remaining = remainingBuddyDebt(data, buddyId);
    const buddies = Array.isArray(data.buddies) ? (data.buddies as Array<Record<string, unknown>>) : [];
    return {
        ...data,
        buddies: buddies.map((buddy) => {
            if (buddy.userId !== buddyId) {
                return buddy;
            }
            const settled = (Math.max(0, Number(buddy.settled) || 0)) + amount;
            return remaining - amount <= EPSILON ? { ...buddy, settled, paid: true } : { ...buddy, settled };
        }),
    };
}
