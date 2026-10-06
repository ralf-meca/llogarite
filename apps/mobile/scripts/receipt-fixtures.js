// Scores the receipt parser against real receipts.
//
//   npm run receipts:pull    copy the receipts a development build has captured
//                            (lib/receiptCapture.ts) from the phone to this computer
//   npm run receipts:score   run the parser over every one of them and compare the
//                            result with what the receipt really says
//
// The receipts live in docs/receipt-fixtures at the repository root, which git
// ignores: they are real receipts, with shops and purchases on them. Each has
//
//   <id>.json            what the text recognition saw (never edited by hand)
//   <id>.jpg             the photo, for whoever writes the answer
//   <id>.expected.json   the answer: { sellerName, date, total, items: [{ name, quantity, unitPrice }] }
//
// A receipt with no expected file yet is listed with the parser's guess, as a start.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const APP_ID = 'com.rmtech.llogarite';
const DEVICE_DIRECTORY = 'files/receipt-captures';
const MOBILE_ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.resolve(MOBILE_ROOT, '..', '..', 'docs', 'receipt-fixtures');

function adb(args, options = {}) {
  const serial = process.env.ANDROID_SERIAL ? ['-s', process.env.ANDROID_SERIAL] : [];
  return execFileSync('adb', [...serial, ...args], { maxBuffer: 256 * 1024 * 1024, ...options });
}

function pull() {
  fs.mkdirSync(FIXTURES, { recursive: true });
  let listing;
  try {
    listing = adb(['exec-out', 'run-as', APP_ID, 'ls', '-1', DEVICE_DIRECTORY]).toString();
  } catch {
    console.error('Could not list the captures. Is a phone with the development build connected (adb devices)?');
    process.exit(1);
  }
  // Split on any whitespace: some phones list several names to a line whatever is asked.
  const names = listing
    .split(/\s+/)
    .map((name) => name.trim())
    .filter((name) => /^[\w.-]+\.(json|jpg)$/.test(name));
  let copied = 0;
  for (const name of names) {
    const target = path.join(FIXTURES, name);
    if (fs.existsSync(target)) {
      continue;
    }
    fs.writeFileSync(target, adb(['exec-out', 'run-as', APP_ID, 'cat', `${DEVICE_DIRECTORY}/${name}`]));
    copied += 1;
  }
  const receipts = names.filter((name) => name.endsWith('.json')).length;
  console.log(`${receipts} receipt(s) on the phone, ${copied} new file(s) copied to ${FIXTURES}`);
}

// The parser is TypeScript written for the app's bundler. It is compiled here, with
// the one module it needs, into a throwaway folder that plain Node can load.
function loadParser() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'receipt-parser-'));
  for (const name of ['receiptParser', 'date']) {
    const source = fs.readFileSync(path.join(MOBILE_ROOT, 'lib', `${name}.ts`), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    fs.writeFileSync(path.join(out, `${name}.js`), compiled.outputText);
  }
  return require(path.join(out, 'receiptParser.js'));
}

function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function shared(setA, setB) {
  let count = 0;
  for (const entry of setA) {
    if (setB.has(entry)) {
      count += 1;
    }
  }
  return count;
}

// How alike two names are, 0 to 1. The recognition drops the odd word and misreads
// the odd letter ("Sallatc Golosa"), neither of which is the parser's doing, so a
// name counts as the same when either its words or its letter pairs mostly agree.
function similarity(a, b) {
  const textA = normalize(a);
  const textB = normalize(b);
  if (!textA || !textB) {
    return 0;
  }
  const wordsA = new Set(textA.split(' '));
  const wordsB = new Set(textB.split(' '));
  const byWords = shared(wordsA, wordsB) / Math.max(wordsA.size, wordsB.size);

  const pairs = (text) => {
    const compact = text.replace(/ /g, '');
    const set = new Set();
    for (let index = 0; index < compact.length - 1; index += 1) {
      set.add(compact.slice(index, index + 2));
    }
    return set;
  };
  const pairsA = pairs(textA);
  const pairsB = pairs(textB);
  const byPairs = pairsA.size + pairsB.size === 0 ? 0 : (2 * shared(pairsA, pairsB)) / (pairsA.size + pairsB.size);
  // Letter pairs are held to a higher bar: short names share pairs by chance.
  return Math.max(byWords, byPairs >= 0.8 ? byPairs : 0);
}

const sameAmount = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;
const totalOf = (items) => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

// Each expected row is paired with the closest parsed row not already taken. A row
// counts as right when its name is recognisably the same and both numbers agree.
function scoreItems(expected, parsed) {
  const remaining = [...parsed];
  let right = 0;
  const wrong = [];
  for (const want of expected) {
    let best = -1;
    let bestScore = 0;
    remaining.forEach((got, index) => {
      const score = similarity(want.name, got.name) + (sameAmount(want.unitPrice, got.unitPrice) ? 0.25 : 0);
      if (score > bestScore) {
        best = index;
        bestScore = score;
      }
    });
    const got = best >= 0 ? remaining.splice(best, 1)[0] : null;
    const isRight =
      got !== null &&
      similarity(want.name, got.name) >= 0.6 &&
      sameAmount(want.quantity, got.quantity) &&
      sameAmount(want.unitPrice, got.unitPrice);
    if (isRight) {
      right += 1;
    } else {
      wrong.push({ want, got });
    }
  }
  return { right, wrong, extra: remaining };
}

const describeItem = (item) => (item ? `${item.name} | ${item.quantity} x ${item.unitPrice}` : '(nothing)');

function score() {
  if (!fs.existsSync(FIXTURES)) {
    console.error(`No receipts yet in ${FIXTURES}. Run "npm run receipts:pull" first.`);
    process.exit(1);
  }
  const { parseReceipt } = loadParser();
  const ids = fs
    .readdirSync(FIXTURES)
    .filter((name) => /^[\w.-]+\.json$/.test(name) && !name.endsWith('.expected.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();

  const totals = { receipts: 0, seller: 0, date: 0, total: 0, items: 0, itemsWanted: 0, unlabelled: 0 };
  const verbose = process.argv.includes('--verbose');

  for (const id of ids) {
    const capture = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${id}.json`), 'utf8'));
    // The parser logs what it reads as it goes, which is noise here.
    const log = console.log;
    console.log = () => undefined;
    let parsed;
    try {
      parsed = parseReceipt(capture.ocr);
    } catch (error) {
      parsed = { sellerName: null, dateTimeCreated: null, items: [], error: String(error) };
    } finally {
      console.log = log;
    }

    const expectedPath = path.join(FIXTURES, `${id}.expected.json`);
    if (!fs.existsSync(expectedPath)) {
      totals.unlabelled += 1;
      console.log(`\n? ${id}  (no expected file yet - the parser's guess:)`);
      console.log(`    seller: ${parsed.sellerName ?? '-'}   date: ${parsed.dateTimeCreated ?? '-'}   total: ${totalOf(parsed.items)}`);
      parsed.items.forEach((item) => console.log(`    ${describeItem(item)}`));
      continue;
    }

    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
    // A receipt can be missing its seller or date - torn, stained. The right answer
    // is then to find none, not to make one up from a nearby label.
    const sellerRight = expected.sellerName
      ? similarity(expected.sellerName, parsed.sellerName) >= 0.6
      : !parsed.sellerName;
    const dateRight = expected.date
      ? String(parsed.dateTimeCreated ?? '').startsWith(expected.date)
      : !parsed.dateTimeCreated;
    // Looser than a row: weighed goods are rounded line by line on the receipt.
    const totalRight = Math.abs(Number(expected.total) - totalOf(parsed.items)) < 0.06;
    const items = scoreItems(expected.items ?? [], parsed.items);

    totals.receipts += 1;
    totals.seller += sellerRight ? 1 : 0;
    totals.date += dateRight ? 1 : 0;
    totals.total += totalRight ? 1 : 0;
    totals.items += items.right;
    totals.itemsWanted += (expected.items ?? []).length;

    const mark = (ok) => (ok ? 'ok ' : 'NO ');
    const allRight = sellerRight && dateRight && totalRight && items.wrong.length === 0 && items.extra.length === 0;
    console.log(
      `\n${allRight ? 'PASS' : 'FAIL'} ${id}  ${expected.sellerName}` +
        `\n    seller ${mark(sellerRight)} date ${mark(dateRight)} total ${mark(totalRight)}` +
        ` items ${items.right}/${(expected.items ?? []).length}` +
        (items.extra.length > 0 ? `  (+${items.extra.length} that are not on the receipt)` : ''),
    );
    if (!allRight || verbose) {
      if (!sellerRight) console.log(`    seller: wanted "${expected.sellerName}", got "${parsed.sellerName ?? ''}"`);
      if (!dateRight) console.log(`    date:   wanted ${expected.date}, got ${parsed.dateTimeCreated ?? '-'}`);
      if (!totalRight) console.log(`    total:  wanted ${expected.total}, got ${totalOf(parsed.items)}`);
      items.wrong.forEach(({ want, got }) =>
        console.log(`    item:   wanted ${describeItem(want)}\n            got    ${describeItem(got)}`),
      );
      items.extra.forEach((item) => console.log(`    extra:  ${describeItem(item)}`));
    }
  }

  const percent = (part, whole) => (whole === 0 ? '-' : `${Math.round((part / whole) * 100)}%`);
  console.log(
    `\n${totals.receipts} labelled receipt(s)` +
      (totals.unlabelled > 0 ? `, ${totals.unlabelled} waiting for an expected file` : '') +
      `\n  seller ${totals.seller}/${totals.receipts} (${percent(totals.seller, totals.receipts)})` +
      `\n  date   ${totals.date}/${totals.receipts} (${percent(totals.date, totals.receipts)})` +
      `\n  total  ${totals.total}/${totals.receipts} (${percent(totals.total, totals.receipts)})` +
      `\n  items  ${totals.items}/${totals.itemsWanted} (${percent(totals.items, totals.itemsWanted)})`,
  );
}

const command = process.argv[2];
if (command === 'pull') {
  pull();
} else if (command === 'score') {
  score();
} else {
  console.error('Usage: node scripts/receipt-fixtures.js <pull|score> [--verbose]');
  process.exit(1);
}
