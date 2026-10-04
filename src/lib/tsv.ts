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

export interface TsvParseResult {
  edits: TransactionEdit[];
  errors: string[];
  rowCount: number;
  ignoredCount: number; // read-only rows (daily/subscription) skipped silently
}

const isReadOnly = (record: TsvRecord) => Boolean(record.isDaily || record.isSubscription);

// Turn pasted TSV back into edits. Rows are matched by ID against all records; only Amount, Memo and
// Category are applied, a missing column keeps the current value, rows left out of the paste are not
// touched, and read-only rows (e.g. from a pasted "Copy TSV" list) are skipped.
export function parseTsvEdits(text: string, records: TsvRecord[]): TsvParseResult {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  const errors: string[] = [];
  if (lines.length === 0) return { edits: [], errors: ['Paste a TSV with a header row.'], rowCount: 0, ignoredCount: 0 };

  const header = lines[0].split('\t').map(h => h.trim().toLowerCase());
  const column = (name: string) => header.indexOf(name.toLowerCase());
  const idCol = column('ID');
  const amountCol = column('Amount');
  const memoCol = column('Memo');
  const categoryCol = column('Category');
  if (idCol === -1) return { edits: [], errors: ['Header row must include an "ID" column.'], rowCount: 0, ignoredCount: 0 };

  const byId = new Map(records.map(r => [r.id, r]));
  const seen = new Set<string>();
  const edits: TransactionEdit[] = [];
  let ignoredCount = 0;

  lines.slice(1).forEach((line, index) => {
    const lineNo = index + 2;
    const cells = line.split('\t');
    const id = (cells[idCol] ?? '').trim();
    const record = byId.get(id);
    if (!record) {
      errors.push(`Line ${lineNo}: unknown ID "${id}"`);
      return;
    }
    if (isReadOnly(record)) {
      ignoredCount += 1;
      return;
    }
    if (seen.has(id)) {
      errors.push(`Line ${lineNo}: duplicate ID "${id}"`);
      return;
    }
    seen.add(id);

    let amount = record.amount;
    if (amountCol !== -1) {
      const raw = (cells[amountCol] ?? '').replace(/[¥,\s]/g, '');
      const parsed = Number(raw);
      if (!/^\d+$/.test(raw) || parsed <= 0) {
        errors.push(`Line ${lineNo}: amount must be a positive whole number`);
        return;
      }
      amount = parsed;
    }
    const note = memoCol === -1 ? clean(record.note) : clean(cells[memoCol]);
    const category = categoryCol === -1 ? clean(record.category) : clean(cells[categoryCol]);
    if (note.length > MAX_NOTE_LENGTH) {
      errors.push(`Line ${lineNo}: memo is longer than ${MAX_NOTE_LENGTH} characters`);
      return;
    }
    if (category.length > MAX_CATEGORY_LENGTH) {
      errors.push(`Line ${lineNo}: category is longer than ${MAX_CATEGORY_LENGTH} characters`);
      return;
    }

    const unchanged = amount === record.amount && note === clean(record.note) && category === clean(record.category);
    if (!unchanged) {
      edits.push({
        type: record.type,
        id,
        changes: { amount, note: note || undefined, category: category || undefined },
      });
    }
  });

  return { edits, errors, rowCount: lines.length - 1, ignoredCount };
}
