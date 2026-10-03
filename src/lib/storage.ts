// Local storage keys
const STORAGE_KEYS = {
  IS_LOGGED_IN: 'budget_logged_in',
  CURRENT_BUDGET: 'budget_current',
  DAILY_BUDGET: 'budget_daily',
  LAST_UPDATE_DATE: 'budget_last_update',
  EXPENSE_HISTORY: 'budget_expense_history',
  INCOME_HISTORY: 'budget_income_history',
  SUBSCRIPTIONS: 'budget_subscriptions',
} as const;

// Transaction history types
export interface TransactionRecord {
  id: string;
  amount: number;
  date: string; // ISO date string (YYYY-MM-DD)
  timestamp: number; // Unix timestamp for sorting
  isDaily?: boolean; // true if this is a daily budget addition
  isSubscription?: boolean; // true if this is a daily subscription deduction
}

// Alias for backward compatibility
export type ExpenseRecord = TransactionRecord;
export type IncomeRecord = TransactionRecord;

export type BillingCycle = 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  title: string;
  amount: number;
  cycle: BillingCycle;
  createdAt: number;
}

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

// Date utility - Japan timezone (JST, UTC+9)
export function getTodayDateString(): string {
  const now = new Date();
  // Convert to Japan timezone
  const jstOffset = 9 * 60; // JST is UTC+9
  const utcMinutes = now.getTime() / (1000 * 60);
  const jstDate = new Date((utcMinutes + jstOffset) * 60 * 1000);
  return jstDate.toISOString().split('T')[0];
}

export function getDaysDifference(fromDate: string, toDate: string): number {
  // Parse dates as JST midnight
  const from = new Date(fromDate + 'T00:00:00+09:00');
  const to = new Date(toDate + 'T00:00:00+09:00');
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
      if (data.dailyBudget > 0) {
        const addedBudget = daysPassed * data.dailyBudget;
        data.currentBudget += addedBudget;
        // Record daily budget addition to income history
        addDailyBudgetToHistory(addedBudget);
      }

      const subscriptionCost = Math.round(daysPassed * getDailySubscriptionTotal());
      if (subscriptionCost > 0) {
        data.currentBudget -= subscriptionCost;
        // Record subscription deduction to expense history
        addSubscriptionCostToHistory(subscriptionCost);
      }

      data.lastUpdateDate = today;
      saveBudgetData(data);
    }
  }

  return data;
}

// Add daily budget to income history
function addDailyBudgetToHistory(totalAmount: number): void {
  if (typeof window === 'undefined') return;

  const history = getIncomeHistory();
  const now = new Date();

  const record: IncomeRecord = {
    id: `daily-${now.getTime()}-${Math.random().toString(36).substring(2, 11)}`,
    amount: totalAmount,
    date: getTodayDateString(),
    timestamp: now.getTime(),
    isDaily: true,
  };

  history.push(record);

  // Clean up old records (older than 7 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
  const cutoffTimestamp = cutoffDate.getTime();
  const filteredHistory = history.filter(r => r.timestamp >= cutoffTimestamp);

  localStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(filteredHistory));
}

// Add daily subscription deduction to expense history
function addSubscriptionCostToHistory(totalAmount: number): void {
  if (typeof window === 'undefined') return;

  const history = getExpenseHistory();
  const now = new Date();

  const record: ExpenseRecord = {
    id: `sub-${now.getTime()}-${Math.random().toString(36).substring(2, 11)}`,
    amount: totalAmount,
    date: getTodayDateString(),
    timestamp: now.getTime(),
    isSubscription: true,
  };

  history.push(record);
  localStorage.setItem(STORAGE_KEYS.EXPENSE_HISTORY, JSON.stringify(history));
}

// Expense history functions
const DAYS_TO_KEEP = 7;

export function getExpenseHistory(): ExpenseRecord[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(STORAGE_KEYS.EXPENSE_HISTORY);
  if (!stored) return [];

  try {
    const history: ExpenseRecord[] = JSON.parse(stored);
    // Filter to keep only last 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
    const cutoffTimestamp = cutoffDate.getTime();

    return history.filter(record => record.timestamp >= cutoffTimestamp);
  } catch {
    return [];
  }
}

export function addExpenseRecord(amount: number): ExpenseRecord {
  const history = getExpenseHistory();
  const now = new Date();

  const record: ExpenseRecord = {
    id: `${now.getTime()}-${Math.random().toString(36).substring(2, 11)}`,
    amount,
    date: getTodayDateString(),
    timestamp: now.getTime(),
  };

  history.push(record);

  // Clean up old records (older than 7 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
  const cutoffTimestamp = cutoffDate.getTime();
  const filteredHistory = history.filter(r => r.timestamp >= cutoffTimestamp);

  localStorage.setItem(STORAGE_KEYS.EXPENSE_HISTORY, JSON.stringify(filteredHistory));

  return record;
}

export function deleteExpenseRecord(id: string): void {
  const history = getExpenseHistory();
  const filteredHistory = history.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.EXPENSE_HISTORY, JSON.stringify(filteredHistory));
}

// Income history functions
export function getIncomeHistory(): IncomeRecord[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(STORAGE_KEYS.INCOME_HISTORY);
  if (!stored) return [];

  try {
    const history: IncomeRecord[] = JSON.parse(stored);
    // Filter to keep only last 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
    const cutoffTimestamp = cutoffDate.getTime();

    return history.filter(record => record.timestamp >= cutoffTimestamp);
  } catch {
    return [];
  }
}

export function addIncomeRecord(amount: number): IncomeRecord {
  const history = getIncomeHistory();
  const now = new Date();

  const record: IncomeRecord = {
    id: `${now.getTime()}-${Math.random().toString(36).substring(2, 11)}`,
    amount,
    date: getTodayDateString(),
    timestamp: now.getTime(),
  };

  history.push(record);

  // Clean up old records (older than 7 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
  const cutoffTimestamp = cutoffDate.getTime();
  const filteredHistory = history.filter(r => r.timestamp >= cutoffTimestamp);

  localStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(filteredHistory));

  return record;
}

export function deleteIncomeRecord(id: string): void {
  const history = getIncomeHistory();
  const filteredHistory = history.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(filteredHistory));
}

// Subscription functions
export function getSubscriptions(): Subscription[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addSubscriptionRecord(title: string, amount: number, cycle: BillingCycle): Subscription {
  const subscriptions = getSubscriptions();
  const now = Date.now();

  const subscription: Subscription = {
    id: `${now}-${Math.random().toString(36).substring(2, 11)}`,
    title,
    amount,
    cycle,
    createdAt: now,
  };

  subscriptions.push(subscription);
  localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subscriptions));

  return subscription;
}

export function deleteSubscriptionRecord(id: string): void {
  const subscriptions = getSubscriptions().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subscriptions));
}

// Daily cost of a subscription (monthly is annualized to avoid month-length bias)
export function getDailyCost(subscription: Subscription): number {
  const yearlyAmount = subscription.cycle === 'monthly' ? subscription.amount * 12 : subscription.amount;
  return yearlyAmount / 365;
}

export function getDailySubscriptionTotal(subscriptions: Subscription[] = getSubscriptions()): number {
  return subscriptions.reduce((sum, s) => sum + getDailyCost(s), 0);
}
