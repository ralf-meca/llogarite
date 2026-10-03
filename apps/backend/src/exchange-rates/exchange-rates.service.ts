import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { fetchOfficialFixing, type OfficialFixing } from './bank-of-albania';
import { ExchangeRate } from './exchange-rate.entity';

// The currencies an invoice may be written in besides the lek. Every amount
// the app stores is in lek; a rate here is how many lek one unit buys.
export const FOREIGN_CURRENCIES = ['EUR'] as const;
export type ForeignCurrency = (typeof FOREIGN_CURRENCIES)[number];

const QUOTE = 'ALL';
const REQUEST_TIMEOUT_MS = 8000;
// The bank publishes once a day, around midday. Its page is asked again no
// more often than this, so a burst of requests costs it one visit.
const FIXING_TTL_MS = 30 * 60 * 1000;

const SOURCE_OFFICIAL = 'bank-of-albania';
const SOURCE_FALLBACK = 'frankfurter';

// "Today" as it is in Albania, which is what the bank's dates mean.
function today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tirane' }).format(new Date());
}

@Injectable()
export class ExchangeRatesService {
    private readonly logger = new Logger(ExchangeRatesService.name);
    // The latest fixing per currency, and when it was read.
    private readonly latest = new Map<string, { fixing: OfficialFixing; readAt: number }>();

    constructor(
        @InjectRepository(ExchangeRate)
        private readonly ratesRepository: Repository<ExchangeRate>,
    ) {}

    // Rates for the given days, keyed by the day asked for. A day with no rate
    // to be had is left out rather than guessed at.
    async ratesFor(base: ForeignCurrency, dates: string[]): Promise<Record<string, number>> {
        const rates: Record<string, number> = {};
        // One at a time: several days usually resolve from the same read of
        // the bank's page, which the first one makes and the rest reuse.
        for (const date of dates) {
            const rate = await this.rateOn(base, date);
            if (rate !== null) {
                rates[date] = rate;
            }
        }
        return rates;
    }

    // The Bank of Albania's official fixing is the source. A day that has one
    // on record is answered from the record. Today, and any day since the last
    // fixing (a weekend, or a morning before the bank has published), gets the
    // latest fixing. An older day the record does not cover falls back to
    // another source, as does everything when the bank's page cannot be read.
    private async rateOn(base: ForeignCurrency, requested: string): Promise<number | null> {
        // Nobody publishes tomorrow's rate, so a date ahead of today is today.
        const date = requested > today() ? today() : requested;

        const stored = await this.ratesRepository.findOne({ where: { base, date } });
        if (stored && stored.source === SOURCE_OFFICIAL) {
            return stored.rate;
        }

        const fixing = await this.latestFixing(base);
        if (fixing && date >= fixing.date) {
            return fixing.rate;
        }

        // A past day with no official figure on record.
        if (stored) {
            return stored.rate;
        }
        const fallback = await this.fromFrankfurter(base, date);
        if (fallback !== null) {
            await this.remember(base, date, fallback, SOURCE_FALLBACK);
            return fallback;
        }
        // Better the wrong day's official rate than none: the app shows it as
        // a suggestion the user can correct.
        return fixing?.rate ?? null;
    }

    private async latestFixing(base: ForeignCurrency): Promise<OfficialFixing | null> {
        const cached = this.latest.get(base);
        if (cached && Date.now() - cached.readAt < FIXING_TTL_MS) {
            return cached.fixing;
        }
        const fixing = await fetchOfficialFixing(base);
        if (!fixing) {
            this.logger.warn(`Bank of Albania rate for ${base} could not be read; falling back`);
            // A fixing read earlier is still the bank's own figure.
            return cached?.fixing ?? null;
        }
        this.latest.set(base, { fixing, readAt: Date.now() });
        await this.remember(base, fixing.date, fixing.rate, SOURCE_OFFICIAL);
        return fixing;
    }

    // Written down so that the day can still be answered once the bank's page
    // has moved on. An official figure replaces a fallback one, never the
    // other way round.
    private async remember(base: ForeignCurrency, date: string, rate: number, source: string): Promise<void> {
        try {
            const existing = await this.ratesRepository.findOne({ where: { base, date } });
            if (!existing) {
                await this.ratesRepository.save(this.ratesRepository.create({ base, date, rate, source }));
            } else if (source === SOURCE_OFFICIAL && (existing.source !== SOURCE_OFFICIAL || existing.rate !== rate)) {
                await this.ratesRepository.update(existing.id, { rate, source });
            }
        } catch (error) {
            // Two requests can race to write the same day; the rate is still
            // returned to whoever asked, so this is not worth failing over.
            this.logger.warn(`Could not store the ${base} rate for ${date}: ${(error as Error).message}`);
        }
    }

    // Not the bank's own figure - it is built from other central banks'
    // quotes for the lek - but it answers for past days, on a weekend or
    // holiday with the last rate published before it.
    private async fromFrankfurter(base: ForeignCurrency, date: string): Promise<number | null> {
        const url = `https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${QUOTE}&date=${date}`;
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
            if (!response.ok) {
                this.logger.warn(`${url} answered ${response.status}`);
                return null;
            }
            const body: unknown = await response.json();
            const rate = Array.isArray(body) ? Number(body[0]?.rate) : NaN;
            return Number.isFinite(rate) && rate > 0 ? rate : null;
        } catch (error) {
            this.logger.warn(`${url} failed: ${(error as Error).message}`);
            return null;
        }
    }
}
