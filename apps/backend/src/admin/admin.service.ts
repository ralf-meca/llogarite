import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    awaitingReviewWhere,
    Invoice,
    trustedInvoiceWhere,
    type InvoiceLegitimacy,
} from '../invoices/invoice.entity';

// The reviewer needs to know whose receipt they are looking at - a name makes a
// list of otherwise identical amounts reviewable - so unlike the price feed,
// this one is deliberately not anonymous. It is only ever served to an admin.
export type ReviewInvoice = {
    id: string;
    legitimacy: InvoiceLegitimacy;
    // Set only by a real government API verification, and forced back to false
    // on any edit. The reviewer sees it so an untouched row in "accepted" is
    // explicable.
    verified: boolean;
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

    // The tabs answer "what needs me", "what is being shown" and "what did I
    // pull" - not the raw column, which would put state-verified invoices in a
    // queue there is no decision to make about.
    async findByLegitimacy(legitimacy: InvoiceLegitimacy): Promise<ReviewInvoice[]> {
        const where =
            legitimacy === 'pending'
                ? awaitingReviewWhere()
                : legitimacy === 'accepted'
                  ? trustedInvoiceWhere()
                  : { legitimacy: 'denied' as InvoiceLegitimacy };

        const invoices = await this.invoicesRepository.find({
            where,
            relations: { user: true },
            order: { createdAt: 'DESC' },
        });

        return invoices.map((invoice) => ({
            id: invoice.id,
            legitimacy: invoice.legitimacy,
            createdAt: invoice.createdAt,
            data: invoice.data,
            verified: invoice.verified,
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
