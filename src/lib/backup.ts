// Shared by the web app and the mobile app: both store the same keys with the same shapes,
// so a backup taken on one can be restored on the other.

const APP_ID = 'budget-manager';
const VERSION = 1;

// Data only; device preferences (theme, keypad size) and login state stay on each device
export const BACKUP_KEYS = [
  'budget_current',
  'budget_daily',
  'budget_last_update',
  'budget_expense_history',
  'budget_income_history',
  'budget_subscriptions',
] as const;

interface Backup {
  app: typeof APP_ID;
  version: number;
  exportedAt: string;
  data: Record<string, string | null>;
}

export function createBackup(read: (key: string) => string | null): string {
  const backup: Backup = {
    app: APP_ID,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(BACKUP_KEYS.map(key => [key, read(key)])),
  };
  return JSON.stringify(backup);
}

export interface BackupSummary {
  exportedAt: string;
  expenseCount: number;
  incomeCount: number;
  subscriptionCount: number;
  currentBudget: number;
}

export type ParsedBackup = { data: Record<string, string | null>; summary: BackupSummary } | { error: string };

const countItems = (raw: string | null | undefined) => {
  const parsed = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) throw new Error('not a list');
  return parsed.length;
};

// Validate a pasted backup before anything is overwritten
export function parseBackup(text: string): ParsedBackup {
  let backup: Partial<Backup>;
  try {
    backup = JSON.parse(text.trim());
  } catch {
    return { error: 'This is not a Budget Manager backup (invalid JSON).' };
  }
  if (backup.app !== APP_ID || typeof backup.data !== 'object' || backup.data === null) {
    return { error: 'This is not a Budget Manager backup.' };
  }
  if (typeof backup.version !== 'number' || backup.version > VERSION) {
    return { error: 'This backup was made by a newer version of the app.' };
  }
  const data = backup.data;
  try {
    return {
      data: Object.fromEntries(BACKUP_KEYS.map(key => [key, typeof data[key] === 'string' ? data[key] : null])),
      summary: {
        exportedAt: backup.exportedAt ?? '',
        expenseCount: countItems(data.budget_expense_history),
        incomeCount: countItems(data.budget_income_history),
        subscriptionCount: countItems(data.budget_subscriptions),
        currentBudget: Number(data.budget_current) || 0,
      },
    };
  } catch {
    return { error: 'The backup is damaged and cannot be restored.' };
  }
}

// Replace every backed-up key; keys missing from the backup are cleared
export function restoreBackup(
  data: Record<string, string | null>,
  write: (key: string, value: string) => void,
  remove: (key: string) => void,
): void {
  for (const key of BACKUP_KEYS) {
    const value = data[key];
    if (value === null || value === undefined) remove(key);
    else write(key, value);
  }
}
