import { BillingCycle, Subscription } from '@/lib/storage';

// Shared by the web app and the mobile app

export const MAX_SUBSCRIPTION_TITLE_LENGTH = 50;

const HEADERS = ['ID', 'Title', 'Cycle', 'Amount'];

const clean = (value: string | undefined) => (value ?? '').replace(/[\t\r\n]+/g, ' ').trim();

export const cycleLabel = (cycle: BillingCycle) => (cycle === 'monthly' ? 'Monthly' : 'Yearly');

function parseCycle(value: string): BillingCycle | null {
  const normalized = value.trim().toLowerCase();
  if (['monthly', 'month', 'm', '月額', '月'].includes(normalized)) return 'monthly';
  if (['yearly', 'year', 'annual', 'y', '年額', '年'].includes(normalized)) return 'yearly';
  return null;
}

export function subscriptionsToTsv(subscriptions: Subscription[]): string {
  const rows = subscriptions.map(s => [s.id, clean(s.title), cycleLabel(s.cycle), String(s.amount)].join('\t'));
  return [HEADERS.join('\t'), ...rows].join('\n');
}

export interface SubscriptionTsvResult {
  subscriptions: Subscription[]; // the full list after applying the paste
  updatedCount: number;
  addedCount: number;
  errors: string[];
}

// Rows with a known ID update that subscription. Rows with an empty ID add a new one, and rows with an
// unknown ID (e.g. copied from another device) add it under that ID, so pasting the same list again
// updates instead of duplicating. Subscriptions left out of the paste are kept; nothing is deleted.
export function parseSubscriptionTsv(text: string, current: Subscription[], now = Date.now()): SubscriptionTsvResult {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  const empty = (error: string): SubscriptionTsvResult => ({ subscriptions: current, updatedCount: 0, addedCount: 0, errors: [error] });
  if (lines.length === 0) return empty('Paste a TSV with a header row.');

  const header = lines[0].split('\t').map(h => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const [idCol, titleCol, cycleCol, amountCol] = [col('ID'), col('Title'), col('Cycle'), col('Amount')];
  if (idCol === -1 && titleCol === -1) return empty('Header row must include an "ID" or "Title" column.');

  const byId = new Map(current.map(s => [s.id, s]));
  const updates = new Map<string, Subscription>();
  const added: Subscription[] = [];
  const seenIds = new Set<string>();
  const errors: string[] = [];

  lines.slice(1).forEach((line, index) => {
    const lineNo = index + 2;
    const cells = line.split('\t');
    const id = idCol === -1 ? '' : clean(cells[idCol]);
    const existing = id ? byId.get(id) : undefined;
    if (id && seenIds.has(id)) {
      errors.push(`Line ${lineNo}: duplicate ID "${id}"`);
      return;
    }
    if (id) seenIds.add(id);

    // Missing columns keep the current value; new rows need all three
    const title = titleCol === -1 ? existing?.title ?? '' : clean(cells[titleCol]);
    if (!title) {
      errors.push(`Line ${lineNo}: title is required`);
      return;
    }
    if (title.length > MAX_SUBSCRIPTION_TITLE_LENGTH) {
      errors.push(`Line ${lineNo}: title is longer than ${MAX_SUBSCRIPTION_TITLE_LENGTH} characters`);
      return;
    }
    const cycle = cycleCol === -1 ? existing?.cycle ?? null : parseCycle(cells[cycleCol] ?? '');
    if (!cycle) {
      errors.push(`Line ${lineNo}: cycle must be Monthly or Yearly`);
      return;
    }
    let amount = existing?.amount ?? 0;
    if (amountCol !== -1 || !existing) {
      const raw = (amountCol === -1 ? '' : cells[amountCol] ?? '').replace(/[¥,\s]/g, '');
      if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
        errors.push(`Line ${lineNo}: amount must be a positive whole number`);
        return;
      }
      amount = Number(raw);
    }

    if (existing) {
      if (title !== existing.title || cycle !== existing.cycle || amount !== existing.amount) {
        updates.set(existing.id, { ...existing, title, cycle, amount });
      } else {
        updates.set(existing.id, existing);
      }
    } else {
      added.push({ id: id || `${now}-${added.length}-${Math.random().toString(36).substring(2, 8)}`, title, amount, cycle, createdAt: now });
    }
  });

  const updatedCount = [...updates.entries()].filter(([id, s]) => s !== byId.get(id)).length;
  return {
    subscriptions: [...current.map(s => updates.get(s.id) ?? s), ...added],
    updatedCount,
    addedCount: added.length,
    errors,
  };
}
