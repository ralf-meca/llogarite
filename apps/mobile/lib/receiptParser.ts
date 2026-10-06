import type { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { toLocalIsoString } from './date';
import type { InvoiceQrParams } from './invoiceApi';

// Reads a receipt out of what the text recognition saw in a photo of it.
//
// Every rule here was written against real receipts and is scored against them:
// `npm run receipts:score` (scripts/receipt-fixtures.js). Change a rule, run the
// score - a fix for one shop's layout easily breaks another's.

export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

export type ParsedReceipt = {
  iic: string | null;
  tin: string | null;
  dateTimeCreated: string | null;
  sellerName: string | null;
  items: ParsedReceiptItem[];
};

// One recognised line of text and where it sits in the photo.
type Cell = {
  text: string;
  left: number;
  right: number;
  height: number;
  // Vertical centre: what lines on the same printed row share, give or take.
  cy: number;
};

type Row = { cy: number; cells: Cell[] };

const IIC_PATTERN = /\b(?:IIC|NSLF)\b\s*[:#]?\s*([A-Z0-9]{16,}(?:-[A-Z0-9]{4,})*)/i;
const TIN_LABELED_PATTERN = /\b(?:NIPT|NUIS|TIN)\b\s*[:#]?\s*([A-Z][0-9]{8}[A-Z])/i;
const TIN_BARE_PATTERN = /\b([A-Z][0-9]{8}[A-Z])\b/;
const TIN_VALUE_PATTERN = /[A-Z]\d{8}[A-Z]/;
const TIN_LABEL_PATTERN = /^n[iı1l]pt\b/i;

// The row that heads the table of articles, and the row that closes it.
const TABLE_HEADER_PATTERN = /artiku|sas[il]|p[eë]rshkrim|[cç]\s?m[iı]m|vler[eë]/i;
const TOTAL_PATTERN = /per\s*t.?u\s*paguar|^\s*total|totali/i;

// "0.48 x 180.00", "1 cope X 340.00", "0.080 X (645 00": a quantity, the times
// sign, and usually the price. Anchored to the start so that an "x" inside a
// name - "Reglan 10 mg x 40 tab" - is not taken for one.
const QTY_TIMES_PATTERN = /^(\d+(?:[.,\s]\d{1,3})?)\s*(?:cop[eë]?|kg|l|pako)?\s*[xX×]\s*\(?\s*(.*)$/i;
// "X 66.7": the times sign and the price, the quantity having been read as a line of its own.
const TIMES_PRICE_PATTERN = /^[xX×]\s*\(?\s*(\d.*)$/;
// "1.00 Cope 700.00 0.00%": quantity, unit, price, with the name on the row below.
const QTY_UNIT_PRICE_PATTERN = /^(-?\d+[.,]\d+)\s+(?:cop[eë]?|kg|l|pako)\s+(\d[\d.,\s]*)/i;

const DISCOUNT_PATTERN = /zbritje|ulje|skonto|sconto|discount/i;
// Words that label a field rather than name a shop or an article.
const LABEL_PATTERN =
  /fatur|tatimore|n[iı]pt|nuis|\btel\b|adres|rrug|dat[eë]?\b|data|or[eë]\b|lloji|pages|operator|njesi|biznes|bleres|monedh|kursi|artiku|sasi|[cç]mim|vler|vleft|total|tvsh|kodi|business|tcr|\bnr\b|\bbu\b|\bop\b|nslf|nivf|www\.|faleminderit/i;
// Keys of a keyboard the receipt is lying on. They are sharp, high-contrast text,
// and the recognition reads them more confidently than the receipt itself.
const KEYBOARD_PATTERN =
  /^(f\d{1,2}|esc|tab|alt|ctrl|shift|enter|caps\s*lock|num\s*lock|scroll\s*lock|print\s*screen|pause\s*break|sys\s*rq|insert|delete|home|end|ins|del|page\s*(up|down)|backspace)$/i;

const letterCount = (text: string) => (text.match(/[a-zëç]/gi) ?? []).length;

// ---------------------------------------------------------------- numbers

// A printed amount, as the recognition tends to return it: "1,650", "2,208.80",
// "194 70" for 194.70, "50. 00", "86.4(" at the receipt's cut edge. Reads the number
// at the start of the text and ignores what follows it. Null when there is none.
function parseAmount(raw: string): number | null {
  const text = raw.trim().replace(/^[|(\s]+/, '');
  const forms: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^(-?[1-9]\d{0,2}),(\d{3})\.(\d{1,2})/, (m) => `${m[1]}${m[2]}.${m[3]}`],
    [/^(-?[1-9]\d{0,2})\s(\d{3})[.,](\d{1,2})/, (m) => `${m[1]}${m[2]}.${m[3]}`],
    [/^(-?[1-9]\d{0,2}),(\d{3})(?!\d)/, (m) => `${m[1]}${m[2]}`],
    [/^(-?\d+)[.,]\s?(\d{1,3})(?!\d)/, (m) => `${m[1]}.${m[2]}`],
    [/^(-?\d+)\s(\d{2})(?!\d)/, (m) => `${m[1]}.${m[2]}`],
    // Five digits and no separator is an amount whose point was not read: 59900, 13547.
    [/^(-?\d{3,})(\d{2})(?!\d)/, (m) => `${m[1]}.${m[2]}`],
    [/^(-?\d+)/, (m) => m[1]],
  ];
  for (const [pattern, build] of forms) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(build(match));
      return Number.isFinite(value) ? value : null;
    }
  }
  return null;
}

// A cell that is an amount and nothing else, allowing the stray character the
// receipt's edge leaves behind ("29.C", "100.0(").
function isAmountCell(text: string): boolean {
  return /^[-|(\s]*\d[\d.,\s]*[a-z(:;]?$/i.test(text.trim());
}

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

// Quantity and price as read, checked against the row's printed value. They are
// kept when they multiply out to it. When they do not, and dividing the value by
// the quantity gives a round figure, a digit of the price was lost - "050.00" for
// 3,050.00 - and the figure is the price.
function reconcile(quantity: number, unitPrice: number | null, value: number | null): ParsedReceiptItem['unitPrice'] | null {
  if (unitPrice === null) {
    return value !== null && quantity !== 0 ? round(value / quantity, 2) : null;
  }
  if (value === null || quantity === 0) {
    return unitPrice;
  }
  const expected = quantity * unitPrice;
  if (Math.abs(expected - value) <= Math.max(1, Math.abs(value) * 0.015)) {
    return unitPrice;
  }
  const implied = value / quantity;
  return Math.abs(implied - Math.round(implied)) < 0.02 ? Math.round(implied) : unitPrice;
}

// ---------------------------------------------------------------- layout

type Corner = { x: number; y: number };

function toCells(result: TextRecognitionResult): Cell[] {
  const cells: Cell[] = [];
  // How much each line of text climbs or drops across its width. A receipt is rarely
  // photographed dead level, and over its width even a degree puts the figures at
  // the right a whole line above or below the name they belong to at the left.
  const slopes: { slope: number; width: number }[] = [];
  for (const block of result.blocks) {
    for (const line of block.lines) {
      if (!line.frame || !line.text.trim()) {
        continue;
      }
      const { left, top, width, height } = line.frame;
      cells.push({ text: line.text.trim(), left, right: left + width, height, cy: top + height / 2 });
      const corners = (line as { cornerPoints?: Corner[] }).cornerPoints;
      if (corners && corners.length >= 2 && corners[1].x > corners[0].x) {
        slopes.push({ slope: (corners[1].y - corners[0].y) / (corners[1].x - corners[0].x), width });
      }
    }
  }

  // The longer lines measure the tilt best; the middle one of them is taken, so the
  // odd line at an angle of its own does not count.
  const widest = slopes.reduce((max, entry) => Math.max(max, entry.width), 0);
  const long = slopes
    .filter((entry) => entry.width >= widest * 0.3)
    .map((entry) => entry.slope)
    .sort((a, b) => a - b);
  const tilt = long.length > 0 ? long[Math.floor(long.length / 2)] : 0;
  if (tilt === 0) {
    return cells;
  }
  // Levelled: every line is put where it would sit had the photo been straight.
  return cells.map((cell) => ({ ...cell, cy: cell.cy - tilt * ((cell.left + cell.right) / 2) }));
}

// Only what is on the receipt. A photo takes in the table it lies on, other
// receipts, a keyboard; the receipt's own widest lines - its fiscal codes - run
// nearly edge to edge, so they give its left and right sides.
function onReceipt(cells: Cell[]): { cells: Cell[]; left: number; right: number } {
  const widest = cells.reduce((max, cell) => Math.max(max, cell.right - cell.left), 0);
  const wide = cells.filter((cell) => cell.right - cell.left >= widest * 0.55);
  if (wide.length === 0) {
    return { cells, left: 0, right: Number.MAX_SAFE_INTEGER };
  }
  const margin = widest * 0.06;
  const left = Math.min(...wide.map((cell) => cell.left)) - margin;
  const right = Math.max(...wide.map((cell) => cell.right)) + margin;
  return {
    cells: cells.filter((cell) => {
      const centre = (cell.left + cell.right) / 2;
      return centre >= left && centre <= right && !KEYBOARD_PATTERN.test(cell.text);
    }),
    left,
    right,
  };
}

function toRows(cells: Cell[]): Row[] {
  const rows: Row[] = [];
  let rowHeight = 0;
  for (const cell of [...cells].sort((a, b) => a.cy - b.cy)) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.cy - cell.cy) <= Math.max(rowHeight, cell.height) * 0.55) {
      last.cells.push(cell);
    } else {
      rows.push({ cy: cell.cy, cells: [cell] });
      rowHeight = cell.height;
    }
  }
  for (const row of rows) {
    row.cells.sort((a, b) => a.left - b.left);
  }
  return rows;
}

const rowText = (row: Row) => row.cells.map((cell) => cell.text).join(' ');

const isQtyRow = (row: Row) =>
  row.cells.some(
    (cell) =>
      QTY_TIMES_PATTERN.test(cell.text) || TIMES_PRICE_PATTERN.test(cell.text) || QTY_UNIT_PRICE_PATTERN.test(cell.text),
  );

// Where the articles are: from the table's heading down to the total. A photo can
// hold part of a second receipt above the one meant, so the heading used is the
// last one before the total that follows it.
function findZones(rows: Row[]): { headerStart: number; itemsStart: number; itemsEnd: number } {
  let itemsEnd = rows.length;
  let itemsStart = 0;
  let sawHeader = false;
  for (let index = 0; index < rows.length; index += 1) {
    const text = rowText(rows[index]);
    // A heading has words and no figures: "Zbritje artikulli -100.00" is a row, not one.
    const isHeader =
      TABLE_HEADER_PATTERN.test(text) &&
      !isQtyRow(rows[index]) &&
      letterCount(text) >= 4 &&
      !rows[index].cells.some((cell) => isAmountCell(cell.text));
    if (isHeader) {
      itemsStart = index + 1;
      sawHeader = true;
      continue;
    }
    if (sawHeader && TOTAL_PATTERN.test(text) && index > itemsStart) {
      itemsEnd = index;
      break;
    }
  }
  if (!sawHeader) {
    // No heading printed: the articles run from the first quantity row's name to the total.
    const firstQty = rows.findIndex(isQtyRow);
    itemsStart = Math.max(0, firstQty - 1);
    const total = rows.findIndex((row, index) => index > itemsStart && TOTAL_PATTERN.test(rowText(row)));
    itemsEnd = total === -1 ? rows.length : total;
  }
  // The receipt's own heading starts after whatever of another receipt lies above it.
  let headerStart = 0;
  for (let index = itemsStart - 1; index >= 0; index -= 1) {
    if (isQtyRow(rows[index]) || (TOTAL_PATTERN.test(rowText(rows[index])) && !TABLE_HEADER_PATTERN.test(rowText(rows[index])))) {
      headerStart = index + 1;
      break;
    }
  }
  return { headerStart, itemsStart, itemsEnd };
}

// ---------------------------------------------------------------- seller

// The shop's name is printed at the head of the receipt, above its tax number.
// Some receipts label it instead ("Shitesi: ...").
function extractSellerName(headerRows: Row[]): string | null {
  for (const row of headerRows) {
    for (const cell of row.cells) {
      const labelled = cell.text.match(/^shites[iı]\s*[:.]?\s*(.+)$/i);
      if (labelled && letterCount(labelled[1]) >= 2) {
        return labelled[1].trim();
      }
    }
  }

  const compact = (row: Row) => rowText(row).replace(/\s/g, '').toUpperCase();
  let tinRow = headerRows.findIndex((row) => TIN_VALUE_PATTERN.test(compact(row)));
  if (tinRow === -1) {
    tinRow = headerRows.findIndex((row) => row.cells.some((cell) => TIN_LABEL_PATTERN.test(cell.text)));
  }
  if (tinRow === -1) {
    tinRow = headerRows.findIndex((row) => /fatur|dat[eë]?\s*[/:]/i.test(rowText(row)));
  }
  const above = tinRow === -1 ? headerRows : headerRows.slice(0, tinRow);

  for (const row of above) {
    for (const cell of row.cells) {
      // Six letters: fewer is a scrap of something else - a key, a torn edge.
      if (letterCount(cell.text) >= 6 && !LABEL_PATTERN.test(cell.text) && !TIN_VALUE_PATTERN.test(cell.text)) {
        return cell.text;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- date

const isValidDay = (day: number, month: number) => month >= 1 && month <= 12 && day >= 1 && day <= 31;

// The year a fiscal invoice number carries: "156904/2026", "16115/2026/cl053ub088".
function invoiceYear(text: string): number | null {
  const withoutDates = text.replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g, ' ');
  const match = withoutDates.match(/(?:^|[^\d/])\d{1,8}\s*\/\s*(20\d{2})(?!\d)/);
  return match ? Number(match[1]) : null;
}

function parseDate(text: string, fallbackYear: number | null): string | null {
  const thisYear = new Date().getFullYear();
  // Day first, except where the time is printed with AM/PM, which goes with month first.
  const monthFirst = /\d\s*[AP]M\b/.test(text);
  const build = (first: number, other: number, year: number, time: string) => {
    const [day, month] = monthFirst ? [other, first] : [first, other];
    if (!isValidDay(day, month)) {
      return null;
    }
    const clock = time.match(/^\D{0,3}(\d{1,2})[:.\s](\d{2})(?:[:.\s](\d{2}))?/);
    const hour = clock ? Number(clock[1]) : 0;
    const minute = clock ? Number(clock[2]) : 0;
    const second = clock && clock[3] ? Number(clock[3]) : 0;
    const hasClock = clock !== null && hour <= 23 && minute <= 59 && second <= 59;
    const date = hasClock ? new Date(year, month - 1, day, hour, minute, second) : new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : toLocalIsoString(date);
  };

  const full = text.match(/(?:^|\D)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(.*)$/);
  if (full) {
    let year = Number(full[3]);
    // A year that cannot be right is a misreading; the invoice number has the real one.
    if ((year < 2000 || year > thisYear + 1) && fallbackYear !== null) {
      year = fallbackYear;
    }
    if (year >= 2000 && year <= thisYear + 1) {
      return build(Number(full[1]), Number(full[2]), year, full[4]);
    }
  }
  // Day and month readable, the year not.
  const partial = text.match(/(?:^|\D)(\d{1,2})[./-](\d{1,2})[./-]/);
  if (partial && fallbackYear !== null) {
    return build(Number(partial[1]), Number(partial[2]), fallbackYear, '');
  }
  return null;
}

function extractDate(headerRows: Row[], allText: string): string | null {
  const year = invoiceYear(allText);
  for (const row of headerRows) {
    for (const cell of row.cells) {
      const date = parseDate(cell.text, year);
      if (date) {
        return date;
      }
    }
  }
  for (const line of allText.split('\n')) {
    const date = parseDate(line, year);
    if (date) {
      return date;
    }
  }
  return null;
}

// ---------------------------------------------------------------- articles

// A cell that could be (part of) an article's name: has letters, is not a label,
// a unit standing alone at the right, or a run of figures.
function isNameCell(cell: Cell, receiptLeft: number, receiptRight: number): boolean {
  const startsLeft = cell.left < receiptLeft + (receiptRight - receiptLeft) * 0.45;
  if (!startsLeft || letterCount(cell.text) < 2) {
    return false;
  }
  if (isAmountCell(cell.text) || QTY_TIMES_PATTERN.test(cell.text) || QTY_UNIT_PRICE_PATTERN.test(cell.text)) {
    return false;
  }
  // Two amounts on one line is a row of figures the name was read into.
  return !/\d+[.,]\d{2}\D+\d+[.,]\d{2}/.test(cell.text);
}

const cleanName = (parts: string[]) =>
  parts
    .join(' ')
    .replace(/^\d{1,2}\s+(?=\D)/, '')
    .replace(/\s*\($/, '')
    .replace(/\s+/g, ' ')
    .trim();

// The rightmost amount beside an anchor: the row's value, in its last column.
function valueBeside(anchor: Cell, cells: Cell[]): number | null {
  const band = Math.max(anchor.height, 28);
  const beside = cells
    .filter((cell) => cell !== anchor && cell.left > anchor.right && Math.abs(cell.cy - anchor.cy) <= band && isAmountCell(cell.text))
    .sort((a, b) => b.right - a.right);
  return beside.length > 0 ? parseAmount(beside[0].text) : null;
}

// Receipts that print "quantity x price" under (or beside) each article's name.
function extractTimesItems(rows: Row[], cells: Cell[], left: number, right: number): ParsedReceiptItem[] {
  const items: ParsedReceiptItem[] = [];
  const used = new Set<Cell>();

  rows.forEach((row, rowIndex) => {
    for (const anchor of row.cells) {
      const withQty = anchor.text.match(QTY_TIMES_PATTERN);
      const priceOnly = withQty ? null : anchor.text.match(TIMES_PRICE_PATTERN);
      if (!withQty && !priceOnly) {
        continue;
      }
      const band = Math.max(anchor.height, 28);
      const near = cells.filter((cell) => cell !== anchor && Math.abs(cell.cy - anchor.cy) <= band);

      let quantity: number | null = withQty ? parseAmount(withQty[1]) : null;
      if (quantity === null) {
        // The quantity, read as its own line just left of the times sign.
        const lone = near
          .filter((cell) => cell.right <= anchor.left + anchor.height && /^\d+([.,]\d+)?$/.test(cell.text))
          .sort((a, b) => b.right - a.right)[0];
        quantity = lone ? parseAmount(lone.text) : null;
      }
      if (quantity === null || quantity <= 0) {
        continue;
      }

      const afterTimes = withQty ? withQty[2] : (priceOnly as RegExpMatchArray)[1];
      let unitPrice = /\d/.test(afterTimes) ? parseAmount(afterTimes.replace(/^[^\d-]+/, '')) : null;
      if (unitPrice === null) {
        // The price, read as its own line to the right of the times sign.
        const next = near
          .filter((cell) => cell.left >= anchor.right - anchor.height && /\d/.test(cell.text))
          .sort((a, b) => a.left - b.left)[0];
        unitPrice = next ? parseAmount(next.text.replace(/^[^\d-]+/, '')) : null;
      }
      const reconciled = reconcile(quantity, unitPrice, valueBeside(anchor, cells));
      if (reconciled === null) {
        continue;
      }

      // The name: on the same row to the left, or else the lines just above.
      const sameRow = row.cells.filter((cell) => cell.right <= anchor.left && isNameCell(cell, left, right));
      const nameParts: string[] = [];
      if (sameRow.length > 0) {
        sameRow.forEach((cell) => {
          nameParts.push(cell.text);
          used.add(cell);
        });
      } else {
        let lastCy: number | null = null;
        for (let index = rowIndex - 1; index >= 0; index -= 1) {
          const above = rows[index];
          if (isQtyRow(above)) {
            break;
          }
          const names = above.cells.filter((cell) => isNameCell(cell, left, right) && !used.has(cell));
          if (names.length === 0) {
            continue;
          }
          // A second line of the same name sits right on top of the first; anything
          // further up belongs to something else.
          const reach: number = lastCy === null ? band * 4 : band * 1.3;
          if ((lastCy ?? anchor.cy) - above.cy > reach) {
            break;
          }
          nameParts.unshift(names.map((cell) => cell.text).join(' '));
          names.forEach((cell) => used.add(cell));
          lastCy = above.cy;
        }
      }
      const name = cleanName(nameParts);
      if (letterCount(name) < 2) {
        continue;
      }
      items.push({ name, quantity, unitPrice: reconciled });
    }
  });

  // Rows with no times sign: a discount ("Zbritje artikulli  -100.00"), or a name with
  // its price and value side by side, the quantity of one having gone unread.
  for (const row of rows) {
    if (isQtyRow(row)) {
      continue;
    }
    const names = row.cells.filter((cell) => isNameCell(cell, left, right) && !used.has(cell));
    const amounts = row.cells
      .filter((cell) => isAmountCell(cell.text))
      .map((cell) => parseAmount(cell.text))
      .filter((amount): amount is number => amount !== null);
    if (names.length === 0 || amounts.length === 0) {
      continue;
    }
    const name = cleanName(names.map((cell) => cell.text));
    const negative = amounts.find((amount) => amount < 0);
    if (DISCOUNT_PATTERN.test(name) && negative !== undefined) {
      items.push({ name, quantity: 1, unitPrice: negative });
      names.forEach((cell) => used.add(cell));
    } else if (amounts.length >= 2 && amounts[amounts.length - 1] === amounts[amounts.length - 2]) {
      items.push({ name, quantity: 1, unitPrice: amounts[amounts.length - 1] });
      names.forEach((cell) => used.add(cell));
    }
  }

  // Names still unclaimed: the "quantity x price" under them was printed over, or read
  // as nonsense. The row's value at the far right usually survives, so the article is
  // kept as one of that amount - the total then still adds up, and it can be corrected.
  const valuesFrom = left + (right - left) * 0.55;
  const valueOn = (row: Row | undefined) => {
    const cell = row?.cells.filter((entry) => entry.left >= valuesFrom && isAmountCell(entry.text)).sort((a, b) => b.right - a.right)[0];
    return cell ? parseAmount(cell.text) : null;
  };
  let pending: string[] = [];
  rows.forEach((row, rowIndex) => {
    const names = row.cells.filter((cell) => isNameCell(cell, left, right) && !used.has(cell));
    if (names.length === 0 || isQtyRow(row)) {
      pending = [];
      return;
    }
    pending.push(names.map((cell) => cell.text).join(' '));
    const next = rows[rowIndex + 1];
    const nextContinues =
      next !== undefined && !isQtyRow(next) && next.cells.some((cell) => isNameCell(cell, left, right) && !used.has(cell));
    const value = valueOn(row) ?? (nextContinues || (next && isQtyRow(next)) ? null : valueOn(next));
    if (value !== null) {
      items.push({ name: cleanName(pending), quantity: 1, unitPrice: value });
      pending = [];
    } else if (!nextContinues) {
      pending = [];
    }
  });
  return items;
}

// Receipts that print "quantity unit price ... value" with the name on the row below.
function extractUnitPriceItems(rows: Row[], cells: Cell[], left: number, right: number): ParsedReceiptItem[] {
  const items: ParsedReceiptItem[] = [];
  rows.forEach((row, rowIndex) => {
    const anchor = row.cells.find((cell) => QTY_UNIT_PRICE_PATTERN.test(cell.text));
    const match = anchor?.text.match(QTY_UNIT_PRICE_PATTERN);
    if (!anchor || !match) {
      return;
    }
    const quantity = parseAmount(match[1]);
    if (quantity === null || quantity === 0) {
      return;
    }
    const unitPrice = reconcile(quantity, parseAmount(match[2]), valueBeside(anchor, cells));
    const nameParts: string[] = [];
    for (let index = rowIndex + 1; index < rows.length && !isQtyRow(rows[index]); index += 1) {
      const names = rows[index].cells.filter((cell) => letterCount(cell.text) >= 2 && !isAmountCell(cell.text));
      if (names.length > 0) {
        nameParts.push(names.map((cell) => cell.text).join(' '));
      }
    }
    const name = cleanName(nameParts);
    if (unitPrice === null || letterCount(name) < 2) {
      return;
    }
    // A discount is printed as a negative quantity of a positive price; it is kept
    // as one row of a negative amount, which is what the rest of the app expects.
    items.push(quantity < 0 ? { name, quantity: -quantity, unitPrice: -unitPrice } : { name, quantity, unitPrice });
  });
  return items;
}

// Receipts laid out as a ruled table: number, article, quantity, price, value. The
// figures sit in columns; a long name wraps onto a second line beside them.
function extractTableItems(rows: Row[], left: number, right: number, printedTotal: number | null): ParsedReceiptItem[] {
  const cells = rows.flatMap((row) => row.cells);
  const figuresFrom = left + (right - left) * 0.45;
  const figures = cells.filter((cell) => cell.left >= figuresFrom && isAmountCell(cell.text));
  if (figures.length === 0) {
    return [];
  }

  // The columns, found as clusters of where the figures sit across the page.
  const centre = (cell: Cell) => (cell.left + cell.right) / 2;
  const gap = (right - left) * 0.07;
  const columns: Cell[][] = [];
  for (const cell of [...figures].sort((a, b) => centre(a) - centre(b))) {
    const last = columns[columns.length - 1];
    if (last && centre(cell) - centre(last[last.length - 1]) <= gap) {
      last.push(cell);
    } else {
      columns.push([cell]);
    }
  }
  const valueColumn = columns[columns.length - 1];
  const priceColumn = columns.length >= 2 ? columns[columns.length - 2] : [];
  const quantityColumn = columns.length >= 3 ? columns[columns.length - 3] : [];
  const lineHeight = [...valueColumn].sort((a, b) => a.height - b.height)[Math.floor(valueColumn.length / 2)].height;

  // Every article has a value, so the values are what the rows are built around.
  const values = [...valueColumn].sort((a, b) => a.cy - b.cy);
  const nearestValue = (cell: Cell) =>
    values.reduce((best, value) => (Math.abs(value.cy - cell.cy) < Math.abs(best.cy - cell.cy) ? value : best));
  const besideValue = (column: Cell[], value: Cell) => {
    const beside = column
      .filter((cell) => Math.abs(cell.cy - value.cy) <= lineHeight * 1.1 && nearestValue(cell) === value)
      .sort((a, b) => Math.abs(a.cy - value.cy) - Math.abs(b.cy - value.cy))[0];
    return beside ? parseAmount(beside.text) : null;
  };

  const nameCells = cells.filter(
    (cell) => cell.left < figuresFrom && !/^\d{1,2}$/.test(cell.text) && /[a-zëç(/]/i.test(cell.text),
  );

  const items: ParsedReceiptItem[] = [];
  // Rows whose quantity was not read but worked out, as value over price.
  const worked = new Set<ParsedReceiptItem>();
  for (const valueCell of values) {
    const value = parseAmount(valueCell.text);
    if (value === null) {
      continue;
    }
    let unitPrice = besideValue(priceColumn, valueCell);
    let quantity = besideValue(quantityColumn, valueCell);
    const isWorked = quantity === null && unitPrice !== null;
    if (unitPrice === null && quantity === null) {
      quantity = 1;
      unitPrice = value;
    } else if (unitPrice === null) {
      unitPrice = round(value / (quantity as number), 2);
    } else if (quantity === null) {
      // The recognition often misses a lone "1" in the quantity column.
      quantity = unitPrice === 0 ? 1 : round(value / unitPrice, 3);
    }
    const name = cleanName(
      nameCells
        .filter((cell) => nearestValue(cell) === valueCell)
        .sort((a, b) => a.cy - b.cy || a.left - b.left)
        .map((cell) => cell.text),
    );
    if (letterCount(name) < 2 || quantity === null || quantity <= 0) {
      continue;
    }
    const item = { name, quantity, unitPrice };
    items.push(item);
    if (isWorked) {
      worked.add(item);
    }
  }

  // A worked-out quantity that is no whole number, on a receipt that does not add up
  // to its printed total, comes of a misread value ("|80.00" for 180.00). If what the
  // total leaves for that row is a whole number of its price, that is the quantity.
  if (printedTotal !== null) {
    const sum = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
    const odd = items.filter((item) => worked.has(item) && Math.abs(item.quantity - Math.round(item.quantity)) > 0.01);
    if (odd.length === 1 && Math.abs(sum - printedTotal) > 0.5 && odd[0].unitPrice > 0) {
      const leftOver = printedTotal - (sum - odd[0].quantity * odd[0].unitPrice);
      const count = leftOver / odd[0].unitPrice;
      if (count > 0 && Math.abs(count - Math.round(count)) < 0.01) {
        odd[0].quantity = Math.round(count);
      }
    }
  }
  return items;
}

function extractTotal(rows: Row[]): number | null {
  for (const row of rows) {
    if (!TOTAL_PATTERN.test(rowText(row)) || TABLE_HEADER_PATTERN.test(rowText(row))) {
      continue;
    }
    const amounts = row.cells
      .filter((cell) => isAmountCell(cell.text))
      .sort((a, b) => b.right - a.right)
      .map((cell) => parseAmount(cell.text));
    if (amounts.length > 0 && amounts[0] !== null) {
      return amounts[0];
    }
  }
  return null;
}

export function parseReceipt(result: TextRecognitionResult): ParsedReceipt {
  const text = result.text;
  const iicMatch = text.match(IIC_PATTERN);
  const tinMatch = text.match(TIN_LABELED_PATTERN) ?? text.match(TIN_BARE_PATTERN);

  const receipt = onReceipt(toCells(result));
  const rows = toRows(receipt.cells);
  const zones = findZones(rows);
  const headerRows = rows.slice(zones.headerStart, zones.itemsStart);
  const itemRows = rows.slice(zones.itemsStart, zones.itemsEnd);
  const itemCells = itemRows.flatMap((row) => row.cells);

  // Which of the three layouts this is shows in how the figures are printed.
  let items: ParsedReceiptItem[];
  if (itemCells.some((cell) => QTY_TIMES_PATTERN.test(cell.text) || TIMES_PRICE_PATTERN.test(cell.text))) {
    items = extractTimesItems(itemRows, itemCells, receipt.left, receipt.right);
  } else if (itemCells.some((cell) => QTY_UNIT_PRICE_PATTERN.test(cell.text))) {
    items = extractUnitPriceItems(itemRows, itemCells, receipt.left, receipt.right);
  } else {
    items = extractTableItems(itemRows, receipt.left, receipt.right, extractTotal(rows.slice(zones.itemsEnd)));
  }

  if (items.length === 0) {
    // Nothing made out row by row: the total at least, as one line to be reviewed.
    const total = extractTotal(rows);
    if (total !== null) {
      items = [{ name: 'Artikuj (rishiko detajet)', quantity: 1, unitPrice: total }];
    }
  }

  return {
    iic: iicMatch ? iicMatch[1] : null,
    tin: tinMatch ? tinMatch[1].toUpperCase() : null,
    dateTimeCreated: extractDate(headerRows, text),
    sellerName: extractSellerName(headerRows),
    items,
  };
}

export function toQrParams(parsed: ParsedReceipt): InvoiceQrParams | null {
  if (!parsed.iic || !parsed.tin || !parsed.dateTimeCreated) {
    return null;
  }
  return { iic: parsed.iic, tin: parsed.tin, dateTimeCreated: parsed.dateTimeCreated };
}
