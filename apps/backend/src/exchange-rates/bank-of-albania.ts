// The Bank of Albania's official exchange rate, read from the page it is
// published on. The bank has no public API: the fixing goes up on this page
// each business day around midday, and that figure is the legal reference for
// tax and accounting in Albania.
//
// Reading a web page is brittle by nature, so everything here fails soft: any
// surprise in the markup yields null and the caller falls back to its other
// source rather than passing on a number that might be wrong.

const PAGE_URL = 'https://www.bankofalbania.org/Tregjet/Kursi_zyrtar_i_kembimit/';
const REQUEST_TIMEOUT_MS = 10000;

// A lek rate outside this band for a major currency means the wrong cell was
// read, not that the market moved.
const PLAUSIBLE_RATE = { min: 20, max: 500 };

export type OfficialFixing = {
    // The day the fixing was published, YYYY-MM-DD.
    date: string;
    // Lek per one unit of the currency.
    rate: number;
};

// Pulls one currency's official rate out of the page. Exported for the sake of
// being checked against a saved copy of the page.
export function parseOfficialFixing(html: string, currency: string): OfficialFixing | null {
    // "Përditesimi i fundit: <b>02.10.2026</b>" - the day the table is for.
    const stamp = html.match(/rditesimi i fundit[\s\S]{0,300}?<b>\s*(\d{2})\.(\d{2})\.(\d{4})\s*<\/b>/i);
    if (!stamp) {
        return null;
    }
    const date = `${stamp[3]}-${stamp[2]}-${stamp[1]}`;

    // The official table is the one headed "Monedha Kryesore"; the page also
    // carries a market bid/ask table further down, whose first figure for the
    // same currency is a buying rate and must not be mistaken for the fixing.
    const tableStart = html.indexOf('Monedha Kryesore');
    if (tableStart === -1) {
        return null;
    }
    const table = html.slice(tableStart, tableStart + 20000);
    const row = table.match(
        new RegExp(`<td[^>]*>\\s*${currency}\\s*</td>\\s*<td[^>]*>\\s*([0-9]+(?:[.,][0-9]+)?)\\s*</td>`, 'i'),
    );
    if (!row) {
        return null;
    }
    const rate = Number(row[1].replace(',', '.'));
    if (!Number.isFinite(rate) || rate < PLAUSIBLE_RATE.min || rate > PLAUSIBLE_RATE.max) {
        return null;
    }
    return { date, rate };
}

export async function fetchOfficialFixing(currency: string): Promise<OfficialFixing | null> {
    try {
        const response = await fetch(PAGE_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Llogarite/1.0; +https://llogarite.site)' },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
            return null;
        }
        return parseOfficialFixing(await response.text(), currency);
    } catch {
        return null;
    }
}
