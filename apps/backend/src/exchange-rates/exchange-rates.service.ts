import { Injectable, Logger } from '@nestjs/common';

// The currencies an invoice may be written in besides the lek. Every amount
// the app stores is in lek; a rate here is how many lek one unit buys.
export const FOREIGN_CURRENCIES = ['EUR'] as const;
export type ForeignCurrency = (typeof FOREIGN_CURRENCIES)[number];

const QUOTE = 'ALL';
const REQUEST_TIMEOUT_MS = 8000;
// Today's rate can still be published or corrected during the day; a past
// day's is settled and kept for as long as the process lives.
const TODAY_TTL_MS = 6 * 60 * 60 * 1000;

type CachedRate = { rate: number; fetchedAt: number };

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ExchangeRatesService {
    private readonly logger = new Logger(ExchangeRatesService.name);
    private readonly cache = new Map<string, CachedRate>();

    // Rates for the given days, keyed by the day asked for. A day with no rate
    // to be had is left out rather than guessed at.
    async ratesFor(base: ForeignCurrency, dates: string[]): Promise<Record<string, number>> {
        const rates: Record<string, number> = {};
        await Promise.all(
            dates.map(async (date) => {
                const rate = await this.rateOn(base, date);
                if (rate !== null) {
                    rates[date] = rate;
                }
            }),
        );
        return rates;
    }

    private async rateOn(base: ForeignCurrency, requested: string): Promise<number | null> {
        // Nobody publishes tomorrow's rate, so a date ahead of today is today.
        const date = requested > today() ? today() : requested;
        const key = `${base}:${date}`;
        const cached = this.cache.get(key);
        if (cached && (date !== today() || Date.now() - cached.fetchedAt < TODAY_TTL_MS)) {
            return cached.rate;
        }

        const rate = (await this.fromFrankfurter(base, date)) ?? (await this.fromOpenErApi(base, date));
        if (rate === null) {
            // A stale rate beats none: the caller can still correct it by hand.
            return cached?.rate ?? null;
        }
        this.cache.set(key, { rate, fetchedAt: Date.now() });
        return rate;
    }

    // Central-bank data, and it answers for past days - on a weekend or holiday
    // with the last rate published before it.
    private async fromFrankfurter(base: ForeignCurrency, date: string): Promise<number | null> {
        const url = `https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${QUOTE}&date=${date}`;
        const body = await this.getJson(url);
        const rate = Array.isArray(body) ? Number(body[0]?.rate) : NaN;
        return Number.isFinite(rate) && rate > 0 ? rate : null;
    }

    // Only knows the latest rate, so it stands in for today and nothing else.
    private async fromOpenErApi(base: ForeignCurrency, date: string): Promise<number | null> {
        if (date !== today()) {
            return null;
        }
        const body = await this.getJson(`https://open.er-api.com/v6/latest/${base}`);
        const rate = Number((body as { rates?: Record<string, unknown> } | null)?.rates?.[QUOTE]);
        return Number.isFinite(rate) && rate > 0 ? rate : null;
    }

    private async getJson(url: string): Promise<unknown> {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
            if (!response.ok) {
                this.logger.warn(`${url} answered ${response.status}`);
                return null;
            }
            return await response.json();
        } catch (error) {
            this.logger.warn(`${url} failed: ${(error as Error).message}`);
            return null;
        }
    }
}
