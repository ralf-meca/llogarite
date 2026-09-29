import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PremiumGuard } from '../auth/guards/premium.guard';
import { PricesService, type PricedInvoice } from './prices.service';

@Controller('prices')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class PricesController {
    constructor(private readonly pricesService: PricesService) {}

    @Get()
    findAll(): Promise<PricedInvoice[]> {
        return this.pricesService.findAcceptedForPrices();
    }
}
