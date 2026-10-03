import { TransactionRecord } from '@/lib/storage';

export const MAX_NOTE_LENGTH = 50;

const DAY_MS = 24 * 60 * 60 * 1000;
// Recent windows keep suggestions relevant now that history spans years
export const AMOUNT_WINDOW_DAYS = 30;
const NOTE_WINDOW_DAYS = 90;

// Most frequent values among recent records, ties broken by most recent use
export function getFrequentValues<T>(records: TransactionRecord[], windowDays: number, pick: (r: TransactionRecord) => T | undefined): T[] {
  const cutoff = Date.now() - windowDays * DAY_MS;
  const stats = new Map<T, { count: number; lastUsed: number }>();
  for (const record of records) {
    const value = pick(record);
    if (record.timestamp < cutoff || value === undefined) continue;
    const stat = stats.get(value) ?? { count: 0, lastUsed: 0 };
    stats.set(value, { count: stat.count + 1, lastUsed: Math.max(stat.lastUsed, record.timestamp) });
  }
  return [...stats.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed)
    .map(([value]) => value);
}

export function getFrequentNotes(records: TransactionRecord[]): string[] {
  return getFrequentValues(records, NOTE_WINDOW_DAYS, r => r.note);
}
