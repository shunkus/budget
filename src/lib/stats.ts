import { TransactionRecord, getDateStringDaysAgo, getDaysDifference, getTodayDateString } from '@/lib/storage';

export type StatsPeriod = '7d' | '30d' | '12m';

const PERIOD_DAYS: Partial<Record<StatsPeriod, number>> = { '7d': 7, '30d': 30 };

// Daily periods chart one bar per day; '12m' charts one bar per month
export const isDailyPeriod = (period: StatsPeriod) => period !== '12m';

export interface Bucket {
  key: string; // YYYY-MM-DD for days, YYYY-MM for months
  amount: number;
}

export interface GroupTotal {
  label: string;
  amount: number;
  count: number;
}

export const SUBSCRIPTIONS_LABEL = 'Subscriptions';
export const NO_MEMO_LABEL = 'No memo';
const MAX_CATEGORIES = 5;

// First day (JST date string) included in the period
export function getPeriodStart(period: StatsPeriod): string {
  const days = PERIOD_DAYS[period];
  if (days) return getDateStringDaysAgo(days - 1);
  // Current month plus the 11 before it
  const [year, month] = getTodayDateString().split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1 - 11, 1));
  return start.toISOString().split('T')[0];
}

export function filterByPeriod(records: TransactionRecord[], period: StatsPeriod): TransactionRecord[] {
  const start = getPeriodStart(period);
  return records.filter(r => r.date >= start);
}

// One bucket per day (7d/30d) or per month (12m), oldest first, including empty ones
export function getBuckets(records: TransactionRecord[], period: StatsPeriod): Bucket[] {
  const keyOf = (date: string) => (isDailyPeriod(period) ? date : date.slice(0, 7));
  const totals = new Map<string, number>();
  for (const r of records) {
    totals.set(keyOf(r.date), (totals.get(keyOf(r.date)) ?? 0) + r.amount);
  }

  const keys: string[] = [];
  const days = PERIOD_DAYS[period];
  if (days) {
    for (let i = days - 1; i >= 0; i--) keys.push(getDateStringDaysAgo(i));
  } else {
    const [year, month] = getTodayDateString().split('-').map(Number);
    for (let i = 11; i >= 0; i--) {
      keys.push(new Date(Date.UTC(year, month - 1 - i, 1)).toISOString().slice(0, 7));
    }
  }
  return keys.map(key => ({ key, amount: totals.get(key) ?? 0 }));
}

// Days actually covered: the period, or less if history starts later (keeps averages honest)
export function getCoveredDays(records: TransactionRecord[], period: StatsPeriod): number {
  const today = getTodayDateString();
  const periodDays = getDaysDifference(getPeriodStart(period), today) + 1;
  if (records.length === 0) return periodDays;
  const earliest = records.reduce((min, r) => (r.date < min ? r.date : min), today);
  return Math.min(periodDays, getDaysDifference(earliest, today) + 1);
}

// Average spending per weekday (0 = Sunday), dividing by how many of that weekday were covered
export function getWeekdayAverages(records: TransactionRecord[], coveredDays: number): number[] {
  const totals = Array(7).fill(0);
  for (const r of records) {
    totals[new Date(r.date + 'T00:00:00Z').getUTCDay()] += r.amount;
  }
  const occurrences = Array(7).fill(0);
  for (let i = 0; i < coveredDays; i++) {
    occurrences[new Date(getDateStringDaysAgo(i) + 'T00:00:00Z').getUTCDay()] += 1;
  }
  return totals.map((total, day) => (occurrences[day] > 0 ? total / occurrences[day] : 0));
}

// Spending grouped by memo, largest first; the tail folds into "Other"
export function getMemoTotals(records: TransactionRecord[]): GroupTotal[] {
  const groups = new Map<string, GroupTotal>();
  for (const r of records) {
    const label = r.isSubscription ? SUBSCRIPTIONS_LABEL : (r.note ?? NO_MEMO_LABEL);
    const group = groups.get(label) ?? { label, amount: 0, count: 0 };
    group.amount += r.amount;
    group.count += 1;
    groups.set(label, group);
  }
  const sorted = [...groups.values()].sort((a, b) => b.amount - a.amount);
  if (sorted.length <= MAX_CATEGORIES + 1) return sorted;

  const tail = sorted.slice(MAX_CATEGORIES);
  return [
    ...sorted.slice(0, MAX_CATEGORIES),
    {
      label: 'Other',
      amount: tail.reduce((sum, c) => sum + c.amount, 0),
      count: tail.reduce((sum, c) => sum + c.count, 0),
    },
  ];
}

export const UNCATEGORIZED_LABEL = 'Uncategorized';

// Spending grouped by resolved category, largest first (the category list is short, so no folding)
export function getTotalsByCategory(
  records: TransactionRecord[],
  categoryOf: (record: TransactionRecord) => string | null,
): GroupTotal[] {
  const groups = new Map<string, GroupTotal>();
  for (const r of records) {
    const label = categoryOf(r) ?? UNCATEGORIZED_LABEL;
    const group = groups.get(label) ?? { label, amount: 0, count: 0 };
    group.amount += r.amount;
    group.count += 1;
    groups.set(label, group);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

// Round the axis maximum up to a clean number with an even half (e.g. 12K -> 6K midpoint)
export function getNiceMax(value: number): number {
  if (value <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find(s => s * magnitude >= value) ?? 10;
  return step * magnitude;
}
