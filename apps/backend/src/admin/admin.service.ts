import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, type InvoiceLegitimacy } from '../invoices/invoice.entity';

// The reviewer needs to know whose receipt they are looking at - a name makes a
// list of otherwise identical amounts reviewable - so unlike the price feed,
// this one is deliberately not anonymous. It is only ever served to an admin.
export type ReviewInvoice = {
    id: string;
    legitimacy: InvoiceLegitimacy;
    createdAt: Date;
    data: Record<string, unknown>;
    ownerEmail: string;
    ownerName: string | null;
};

@Injectable()
export class AdminService {
    constructor(
        @InjectRepository(Invoice)
        private readonly invoicesRepository: Repository<Invoice>,
    ) {}

    async findByLegitimacy(legitimacy: InvoiceLegitimacy): Promise<ReviewInvoice[]> {
        const invoices = await this.invoicesRepository.find({
            where: { legitimacy },
            relations: { user: true },
            order: { createdAt: 'DESC' },
        });

        return invoices.map((invoice) => ({
            id: invoice.id,
            legitimacy: invoice.legitimacy,
            createdAt: invoice.createdAt,
            data: invoice.data,
            ownerEmail: invoice.user.email,
            ownerName: invoice.user.name ?? null,
        }));
    }

    async setLegitimacy(id: string, legitimacy: InvoiceLegitimacy): Promise<void> {
        const result = await this.invoicesRepository.update({ id }, { legitimacy });
        if (!result.affected) {
            throw new NotFoundException();
        }
    }
}
