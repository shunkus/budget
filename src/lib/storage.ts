// Local storage keys
const STORAGE_KEYS = {
  IS_LOGGED_IN: 'budget_logged_in',
  CURRENT_BUDGET: 'budget_current',
  DAILY_BUDGET: 'budget_daily',
  LAST_UPDATE_DATE: 'budget_last_update',
} as const;

export interface BudgetData {
  currentBudget: number;
  dailyBudget: number;
  lastUpdateDate: string; // ISO date string (YYYY-MM-DD)
}

// Auth functions
export function getIsLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN) === 'true';
}

export function setIsLoggedIn(value: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, String(value));
}

// Budget functions
export function getBudgetData(): BudgetData {
  if (typeof window === 'undefined') {
    return { currentBudget: 0, dailyBudget: 0, lastUpdateDate: getTodayDateString() };
  }

  const currentBudget = Number(localStorage.getItem(STORAGE_KEYS.CURRENT_BUDGET)) || 0;
  const dailyBudget = Number(localStorage.getItem(STORAGE_KEYS.DAILY_BUDGET)) || 0;
  const lastUpdateDate = localStorage.getItem(STORAGE_KEYS.LAST_UPDATE_DATE) || getTodayDateString();

  return { currentBudget, dailyBudget, lastUpdateDate };
}

export function saveBudgetData(data: Partial<BudgetData>): void {
  if (typeof window === 'undefined') return;

  if (data.currentBudget !== undefined) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_BUDGET, String(data.currentBudget));
  }
  if (data.dailyBudget !== undefined) {
    localStorage.setItem(STORAGE_KEYS.DAILY_BUDGET, String(data.dailyBudget));
  }
  if (data.lastUpdateDate !== undefined) {
    localStorage.setItem(STORAGE_KEYS.LAST_UPDATE_DATE, data.lastUpdateDate);
  }
}

// Date utility
export function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

export function getDaysDifference(fromDate: string, toDate: string): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const diffTime = to.getTime() - from.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Calculate and update budget based on days passed
export function calculateAndUpdateBudget(): BudgetData {
  const data = getBudgetData();
  const today = getTodayDateString();

  if (data.lastUpdateDate !== today) {
    const daysPassed = getDaysDifference(data.lastUpdateDate, today);
    if (daysPassed > 0) {
      const addedBudget = daysPassed * data.dailyBudget;
      data.currentBudget += addedBudget;
      data.lastUpdateDate = today;
      saveBudgetData(data);
    }
  }

  return data;
}
