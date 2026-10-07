import { TransactionEdit, TransactionRecord } from '@/lib/storage';
import { MAX_CATEGORY_LENGTH, MAX_NOTE_LENGTH } from '@/lib/suggestions';

export type TransactionKind = 'expense' | 'income';

export interface TsvRecord extends TransactionRecord {
  type: TransactionKind;
}

const HEADERS = ['ID', 'Date', 'Time', 'Type', 'Amount', 'Memo', 'Category'];

// Tabs and line breaks would break the TSV layout
const clean = (value: string | undefined) => (value ?? '').replace(/[\t\r\n]+/g, ' ').trim();

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

function typeLabel(record: TsvRecord): string {
  if (record.isDaily) return 'daily';
  if (record.isSubscription) return 'subscription';
  return record.type;
}

export function toTsv(records: TsvRecord[]): string {
  const rows = records.map(r =>
    [r.id, r.date, formatTime(r.timestamp), typeLabel(r), String(r.amount), clean(r.note), clean(r.category)].join('\t'),
  );
  return [HEADERS.join('\t'), ...rows].join('\n');
}

export interface TsvAddition {
  type: TransactionKind;
  record: TransactionRecord;
}

export interface TsvParseResult {
  edits: TransactionEdit[];
  additions: TsvAddition[]; // rows with an empty or unknown ID, recorded as history
  errors: string[];
  rowCount: number;
  ignoredCount: number; // known read-only rows (daily/subscription) skipped silently
}

const isReadOnly = (record: TsvRecord) => Boolean(record.isDaily || record.isSubscription);

const DEFAULT_TIME = '12:00';

function parseAmount(raw: string | undefined): number | null {
  const digits = (raw ?? '').replace(/[¥,\s]/g, '');
  const amount = Number(digits);
  return /^\d+$/.test(digits) && amount > 0 ? amount : null;
}

// Type labels as written by toTsv (and a few natural alternatives) -> kind and generated flags
function parseType(raw: string | undefined): { type: TransactionKind; flags: Partial<TransactionRecord> } | null {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'expense': case '支出': return { type: 'expense', flags: {} };
    case 'income': case '収入': return { type: 'income', flags: {} };
    case 'daily': return { type: 'income', flags: { isDaily: true } };
    case 'subscription': return { type: 'expense', flags: { isSubscription: true } };
    default: return null;
  }
}

// Calendar date in JST plus optional HH:MM, validated by round-tripping through Date
function parseTimestamp(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(':');
  const timestamp = Date.parse(`${date}T${hours.padStart(2, '0')}:${minutes}:00+09:00`);
  if (Number.isNaN(timestamp)) return null;
  const roundTrip = new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return roundTrip === date ? timestamp : null;
}

const newId = (timestamp: number, index: number) => `${timestamp}-${index}-${Math.random().toString(36).substring(2, 8)}`;

// Turn pasted TSV back into changes. Rows with a known ID update Amount, Memo and Category (a missing
// column keeps the current value); known daily/subscription rows are skipped. Rows with an empty or
// unknown ID (e.g. copied from another device) are added as history, keeping the ID so a re-paste does
// not duplicate them. Records left out of the paste are not touched.
export function parseTsvEdits(text: string, records: TsvRecord[]): TsvParseResult {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  const empty = (error: string): TsvParseResult => ({ edits: [], additions: [], errors: [error], rowCount: 0, ignoredCount: 0 });
  if (lines.length === 0) return empty('Paste a TSV with a header row.');

  const header = lines[0].split('\t').map(h => h.trim().toLowerCase());
  const column = (name: string) => header.indexOf(name.toLowerCase());
  const [idCol, dateCol, timeCol, typeCol, amountCol, memoCol, categoryCol] =
    ['ID', 'Date', 'Time', 'Type', 'Amount', 'Memo', 'Category'].map(column);
  if (idCol === -1 && amountCol === -1) return empty('Header row must include an "ID" or "Amount" column.');

  const byId = new Map(records.map(r => [r.id, r]));
  const seen = new Set<string>();
  const edits: TransactionEdit[] = [];
  const additions: TsvAddition[] = [];
  const errors: string[] = [];
  let ignoredCount = 0;

  lines.slice(1).forEach((line, index) => {
    const lineNo = index + 2;
    const cells = line.split('\t');
    const id = idCol === -1 ? '' : clean(cells[idCol]);
    if (id && seen.has(id)) {
      errors.push(`Line ${lineNo}: duplicate ID "${id}"`);
      return;
    }
    if (id) seen.add(id);

    const record = id ? byId.get(id) : undefined;
    if (record && isReadOnly(record)) {
      ignoredCount += 1;
      return;
    }

    const note = memoCol === -1 ? clean(record?.note) : clean(cells[memoCol]);
    const category = categoryCol === -1 ? clean(record?.category) : clean(cells[categoryCol]);
    if (note.length > MAX_NOTE_LENGTH) {
      errors.push(`Line ${lineNo}: memo is longer than ${MAX_NOTE_LENGTH} characters`);
      return;
    }
    if (category.length > MAX_CATEGORY_LENGTH) {
      errors.push(`Line ${lineNo}: category is longer than ${MAX_CATEGORY_LENGTH} characters`);
      return;
    }

    if (record) {
      const amount = amountCol === -1 ? record.amount : parseAmount(cells[amountCol]);
      if (amount === null) {
        errors.push(`Line ${lineNo}: amount must be a positive whole number`);
        return;
      }
      const unchanged = amount === record.amount && note === clean(record.note) && category === clean(record.category);
      if (!unchanged) {
        edits.push({ type: record.type, id, changes: { amount, note: note || undefined, category: category || undefined } });
      }
      return;
    }

    // New record: needs a type, a date and an amount
    const kind = parseType(typeCol === -1 ? undefined : cells[typeCol]);
    if (!kind) {
      errors.push(`Line ${lineNo}: new rows need Type (expense, income, daily or subscription)`);
      return;
    }
    const date = dateCol === -1 ? '' : clean(cells[dateCol]);
    const time = timeCol === -1 ? DEFAULT_TIME : clean(cells[timeCol]) || DEFAULT_TIME;
    const timestamp = parseTimestamp(date, time);
    if (timestamp === null) {
      errors.push(`Line ${lineNo}: new rows need Date as YYYY-MM-DD (and Time as HH:MM)`);
      return;
    }
    const amount = parseAmount(amountCol === -1 ? undefined : cells[amountCol]);
    if (amount === null) {
      errors.push(`Line ${lineNo}: amount must be a positive whole number`);
      return;
    }
    additions.push({
      type: kind.type,
      record: {
        id: id || newId(timestamp, index),
        amount,
        date,
        timestamp,
        ...kind.flags,
        ...(note ? { note } : {}),
        ...(category ? { category } : {}),
      },
    });
  });

  return { edits, additions, errors, rowCount: lines.length - 1, ignoredCount };
}
