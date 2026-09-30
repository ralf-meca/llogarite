import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, trustedInvoiceWhere } from '../invoices/invoice.entity';

type PricedItem = {
    name: string;
    quantity: number;
    unitPriceAfterVat: number;
};

// Shaped like the saved invoices the app already aggregates client side, so the
// price screens keep the functions they have instead of growing a second set
// for a different shape.
export type PricedInvoice = {
    id: string;
    data: {
        dateTimeCreated: string;
        verified: boolean;
        seller: { name: string };
        items: PricedItem[];
    };
};

@Injectable()
export class PricesService {
    constructor(
        @InjectRepository(Invoice)
        private readonly invoicesRepository: Repository<Invoice>,
    ) {}

    // Everyone's trustworthy invoices, and only the four things a price
    // comparison needs: when, where, what, how much. No user id, no email, no
    // name, no project, no buddy splits. Shoppers get to see what things cost
    // and where, never who bought them.
    async findAcceptedForPrices(): Promise<PricedInvoice[]> {
        const invoices = await this.invoicesRepository.find({
            where: trustedInvoiceWhere(),
            order: { createdAt: 'DESC' },
        });

        return invoices.map((invoice) => {
            const data = invoice.data as Record<string, any>;
            const items: PricedItem[] = Array.isArray(data?.items)
                ? data.items.map((item: Record<string, any>) => ({
                      name: String(item?.name ?? ''),
                      quantity: Number(item?.quantity ?? 0),
                      unitPriceAfterVat: Number(item?.unitPriceAfterVat ?? 0),
                  }))
                : [];

            return {
                id: invoice.id,
                data: {
                    dateTimeCreated: String(data?.dateTimeCreated ?? invoice.createdAt.toISOString()),
                    verified: Boolean(invoice.verified),
                    seller: { name: String(data?.seller?.name ?? '') },
                    items,
                },
            };
        });
    }
}
