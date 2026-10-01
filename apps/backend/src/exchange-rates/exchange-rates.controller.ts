import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExchangeRatesService, FOREIGN_CURRENCIES, type ForeignCurrency } from './exchange-rates.service';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// A project's worth of expense dates fits well inside this; anything beyond
// it is not a screen asking.
const MAX_DATES = 60;

export type ExchangeRatesResponse = {
    base: ForeignCurrency;
    quote: 'ALL';
    // Lek per one unit of `base`, keyed by the day asked for.
    rates: Record<string, number>;
};

@Controller('exchange-rates')
@UseGuards(JwtAuthGuard)
export class ExchangeRatesController {
    constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

    // GET /exchange-rates?base=EUR&dates=2026-09-19,2026-09-20
    @Get()
    async find(@Query('base') base = 'EUR', @Query('dates') dates = ''): Promise<ExchangeRatesResponse> {
        if (!FOREIGN_CURRENCIES.includes(base as ForeignCurrency)) {
            throw new BadRequestException('unsupported base currency');
        }
        const requested = [...new Set(dates.split(',').map((date) => date.trim()).filter(Boolean))];
        if (requested.length === 0 || requested.length > MAX_DATES || !requested.every((date) => DATE_PATTERN.test(date))) {
            throw new BadRequestException(`dates must be 1-${MAX_DATES} days as YYYY-MM-DD`);
        }
        return {
            base: base as ForeignCurrency,
            quote: 'ALL',
            rates: await this.exchangeRatesService.ratesFor(base as ForeignCurrency, requested),
        };
    }
}
