import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { Invoice } from './invoice.entity';

type ComparableItem = {
    name: string;
    quantity: number;
    unitPriceAfterVat: number;
};

// Real fiscal invoices carry many extra fields (vatRate, code, unit, ...) that the manual
// edit form never round-trips, so comparing raw item objects would always see a "change".
// unitPriceBeforeVat is excluded too: the manual form has a single price field per item and
// collapses before/after VAT into the same value on every save, so comparing it would flag
// a "change" even when the user never touched the price. category is excluded because the
// edit form auto-suggests one for any item that doesn't have one yet, so it would flag a
// "change" on the very first edit even though the user never opened a category picker.
// name is trimmed on both sides since the edit form always trims and the source data
// sometimes has incidental leading/trailing whitespace.
function normalizeItems(items: unknown): ComparableItem[] {
    if (!Array.isArray(items)) {
        return [];
    }
    return items.map((item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        return {
            name: typeof record.name === 'string' ? record.name.trim() : '',
            quantity: typeof record.quantity === 'number' ? record.quantity : 0,
            unitPriceAfterVat: typeof record.unitPriceAfterVat === 'number' ? record.unitPriceAfterVat : 0,
        };
    });
}

@Injectable()
export class InvoicesService {
    constructor(
        @InjectRepository(Invoice)
        private readonly invoicesRepository: Repository<Invoice>,
        private readonly usersService: UsersService,
        private readonly notificationsService: NotificationsService,
    ) {}

    async create(userId: string, data: Record<string, unknown>): Promise<Invoice> {
        const iic = data.iic;
        if (typeof iic !== 'string' || !iic) {
            throw new BadRequestException('iic is required');
        }
        const projectId = typeof data.projectId === 'string' ? data.projectId : null;
        const verified = data.verified === true;

        const existing = await this.invoicesRepository.findOne({ where: { userId, iic } });
        if (existing) {
            return existing;
        }

        const invoice = this.invoicesRepository.create({ iic, data, userId, projectId, verified });
        return this.invoicesRepository.save(invoice);
    }

    findAll(userId: string): Promise<Invoice[]> {
        return this.invoicesRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
    }

    async update(userId: string, id: string, data: Record<string, unknown>): Promise<Invoice> {
        const invoice = await this.invoicesRepository.findOne({ where: { id } });
        if (!invoice || invoice.userId !== userId) {
            throw new NotFoundException();
        }
        const projectId = typeof data.projectId === 'string' ? data.projectId : null;
        // Editing the item rows invalidates official-verification status; editing anything
        // else (seller, date, project, buddy split) keeps the existing status.
        const itemsChanged =
            JSON.stringify(normalizeItems(invoice.data.items)) !== JSON.stringify(normalizeItems(data.items));
        const verified = itemsChanged ? false : invoice.verified;
        const updatedData = { ...data, verified };
        await this.invoicesRepository.update(id, { data: updatedData, projectId, verified });
        return { ...invoice, data: updatedData, projectId, verified };
    }

    async setBuddyPaid(userId: string, id: string, buddyUserId: string, paid: boolean): Promise<Invoice> {
        const invoice = await this.invoicesRepository.findOne({ where: { id } });
        if (!invoice || invoice.userId !== userId) {
            throw new NotFoundException();
        }
        const buddies = Array.isArray(invoice.data.buddies)
            ? (invoice.data.buddies as Array<Record<string, unknown>>)
            : [];
        const updatedBuddies = buddies.map((buddy) =>
            buddy.userId === buddyUserId ? { ...buddy, paid } : buddy,
        );
        const data = { ...invoice.data, buddies: updatedBuddies };
        await this.invoicesRepository.update(id, { data });
        return { ...invoice, data };
    }

    findOwedByMe(userId: string): Promise<Invoice[]> {
        return this.invoicesRepository
            .createQueryBuilder('invoice')
            .leftJoinAndSelect('invoice.user', 'owner')
            .where(
                `EXISTS (SELECT 1 FROM jsonb_array_elements(invoice.data->'buddies') AS b WHERE b->>'userId' = :userId)`,
                { userId },
            )
            .orderBy('invoice.createdAt', 'DESC')
            .getMany();
    }

    async notifyPaid(userId: string, id: string): Promise<void> {
        const invoice = await this.invoicesRepository.findOne({ where: { id } });
        if (!invoice) {
            throw new NotFoundException();
        }
        const buddies = Array.isArray(invoice.data.buddies)
            ? (invoice.data.buddies as Array<Record<string, unknown>>)
            : [];
        const isBuddy = buddies.some((buddy) => buddy.userId === userId);
        if (!isBuddy) {
            throw new NotFoundException();
        }

        const [requester, owner] = await Promise.all([
            this.usersService.findById(userId),
            this.usersService.findById(invoice.userId),
        ]);
        await this.notificationsService.send(owner?.pushToken, {
            title: 'Pagesë e njoftuar',
            body: `${requester?.name ?? requester?.email ?? 'Shoku yt'} tha se e ka paguar pjesën e tij të faturës.`,
            data: { type: 'invoice_notify_paid', invoiceId: id },
        });
    }

    async remove(userId: string, id: string): Promise<void> {
        const invoice = await this.invoicesRepository.findOne({ where: { id } });
        if (!invoice || invoice.userId !== userId) {
            throw new NotFoundException();
        }
        await this.invoicesRepository.delete(id);
    }
}
