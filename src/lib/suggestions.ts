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

export const MAX_CATEGORY_LENGTH = 30;
const CATEGORY_WINDOW_DAYS = 365;

export function getFrequentCategories(records: TransactionRecord[]): string[] {
  return getFrequentValues(records, CATEGORY_WINDOW_DAYS, r => r.category);
}

const normalize = (text: string) => text.trim().toLowerCase();

// Category used the last time this memo was recorded, so repeat memos fill themselves in
export function getLastCategoryForNote(records: TransactionRecord[], note: string): string | null {
  const key = normalize(note);
  if (!key) return null;
  let latest: TransactionRecord | null = null;
  for (const r of records) {
    if (r.category && r.note && normalize(r.note) === key && (!latest || r.timestamp > latest.timestamp)) {
      latest = r;
    }
  }
  return latest?.category ?? null;
}

export interface AmountMatch {
  note: string;
  category?: string;
  approximate?: boolean; // matched a nearby amount rather than the exact one
}

// Fares and similar costs vary from day to day (a train ride can be ¥190 one day and ¥320 the
// next, a shinkansen ticket a few hundred yen), so past records within this range also match:
// ±10%, but at least ±¥150 so small fares still find each other
const NEAR_TOLERANCE = 0.1;
const NEAR_MIN_RANGE = 150;
export const MAX_AMOUNT_MATCHES = 3;

const isMemoRecord = (r: TransactionRecord) => !!r.note?.trim() && !r.isDaily && !r.isSubscription;

// Memos recorded with this amount, most frequent first (ties go to the most recent), each with the
// category it was last used with, so typing "800" can offer "駐車場 · Car". Memos used with the
// exact amount come first, then ones used with nearby amounts, marked approximate.
export function getTopEntriesForAmount(records: TransactionRecord[], amount: number, limit = MAX_AMOUNT_MATCHES): AmountMatch[] {
  if (amount <= 0) return [];
  const candidates = records.filter(isMemoRecord);
  const range = Math.max(amount * NEAR_TOLERANCE, NEAR_MIN_RANGE);
  const memos = (matches: TransactionRecord[]) => getFrequentValues(matches, Infinity, r => r.note?.trim() || undefined);
  const exact = memos(candidates.filter(r => r.amount === amount));
  const near = memos(candidates.filter(r => r.amount !== amount && Math.abs(r.amount - amount) <= range))
    .filter(note => !exact.includes(note));
  return [
    ...exact.map(note => ({ note, approximate: false })),
    ...near.map(note => ({ note, approximate: true })),
  ]
    .slice(0, limit)
    .map(({ note, approximate }) => {
      const category = getLastCategoryForNote(records, note);
      return { note, ...(category ? { category } : {}), ...(approximate ? { approximate } : {}) };
    });
}
