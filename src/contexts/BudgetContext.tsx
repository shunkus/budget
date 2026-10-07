'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BudgetData, BillingCycle, ExpenseRecord, IncomeRecord, Subscription, saveBudgetData, calculateAndUpdateBudget, getExpenseHistory, addExpenseRecord, deleteExpenseRecord, getIncomeHistory, addIncomeRecord, deleteIncomeRecord, updateExpenseRecord, updateIncomeRecord, applyRecordChanges, RecordChanges, TransactionEdit, saveExpenseHistory, saveIncomeHistory, getSubscriptions, addSubscriptionRecord, deleteSubscriptionRecord, saveSubscriptions } from '@/lib/storage';
import { restoreBackup } from '@/lib/backup';
import type { TsvAddition } from '@/lib/tsv';

interface BudgetContextType {
  budgetData: BudgetData;
  expenseHistory: ExpenseRecord[];
  incomeHistory: IncomeRecord[];
  subscriptions: Subscription[];
  isLoading: boolean;
  updateDailyBudget: (amount: number) => void;
  updateCurrentBudget: (amount: number) => void;
  updateLastUpdateDate: (date: string) => void;
  addExpense: (amount: number, note?: string, category?: string) => void;
  removeExpense: (id: string, amount: number) => void;
  addIncome: (amount: number, note?: string, category?: string) => void;
  removeIncome: (id: string, amount: number) => void;
  editTransaction: (type: 'expense' | 'income', id: string, changes: RecordChanges) => void;
  bulkEditTransactions: (edits: TransactionEdit[], additions?: TsvAddition[]) => void;
  addSubscription: (title: string, amount: number, cycle: BillingCycle) => void;
  removeSubscription: (id: string) => void;
  replaceSubscriptions: (subscriptions: Subscription[]) => void;
  restoreData: (data: Record<string, string | null>) => void;
  refreshBudget: () => void;
}

const BudgetContext = createContext<BudgetContextType | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [budgetData, setBudgetData] = useState<BudgetData>({
    currentBudget: 0,
    dailyBudget: 0,
    lastUpdateDate: '',
  });
  const [expenseHistory, setExpenseHistory] = useState<ExpenseRecord[]>([]);
  const [incomeHistory, setIncomeHistory] = useState<IncomeRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshBudget = useCallback(() => {
    const updatedData = calculateAndUpdateBudget();
    setBudgetData(updatedData);
    setExpenseHistory(getExpenseHistory());
    setIncomeHistory(getIncomeHistory());
    setSubscriptions(getSubscriptions());
  }, []);

  useEffect(() => {
    refreshBudget();
    setIsLoading(false);
  }, [refreshBudget]);

  const updateDailyBudget = (amount: number) => {
    const newData = { ...budgetData, dailyBudget: amount };
    saveBudgetData({ dailyBudget: amount });
    setBudgetData(newData);
  };

  const updateCurrentBudget = (amount: number) => {
    const newData = { ...budgetData, currentBudget: amount };
    saveBudgetData({ currentBudget: amount });
    setBudgetData(newData);
  };

  const updateLastUpdateDate = (date: string) => {
    const newData = { ...budgetData, lastUpdateDate: date };
    saveBudgetData({ lastUpdateDate: date });
    setBudgetData(newData);
  };

  const addExpense = (amount: number, note?: string, category?: string) => {
    // Add to history
    const record = addExpenseRecord(amount, note, category);
    setExpenseHistory(prev => [...prev, record]);
    // Deduct from budget
    const newBudget = budgetData.currentBudget - amount;
    const newData = { ...budgetData, currentBudget: newBudget };
    saveBudgetData({ currentBudget: newBudget });
    setBudgetData(newData);
  };

  const removeExpense = (id: string, amount: number) => {
    // Remove from history
    deleteExpenseRecord(id);
    setExpenseHistory(prev => prev.filter(r => r.id !== id));
    // Restore to budget
    const newBudget = budgetData.currentBudget + amount;
    const newData = { ...budgetData, currentBudget: newBudget };
    saveBudgetData({ currentBudget: newBudget });
    setBudgetData(newData);
  };

  const addIncome = (amount: number, note?: string, category?: string) => {
    // Add to history
    const record = addIncomeRecord(amount, note, category);
    setIncomeHistory(prev => [...prev, record]);
    // Add to budget
    const newBudget = budgetData.currentBudget + amount;
    const newData = { ...budgetData, currentBudget: newBudget };
    saveBudgetData({ currentBudget: newBudget });
    setBudgetData(newData);
  };

  const removeIncome = (id: string, amount: number) => {
    // Remove from history
    deleteIncomeRecord(id);
    setIncomeHistory(prev => prev.filter(r => r.id !== id));
    // Deduct from budget
    const newBudget = budgetData.currentBudget - amount;
    const newData = { ...budgetData, currentBudget: newBudget };
    saveBudgetData({ currentBudget: newBudget });
    setBudgetData(newData);
  };

  const editTransaction = (type: 'expense' | 'income', id: string, changes: RecordChanges) => {
    const history = type === 'expense' ? expenseHistory : incomeHistory;
    const original = history.find(r => r.id === id);
    if (!original) return;

    if (type === 'expense') {
      updateExpenseRecord(id, changes);
    } else {
      updateIncomeRecord(id, changes);
    }
    if (type === 'expense') {
      setExpenseHistory(prev => applyRecordChanges(prev, id, changes));
    } else {
      setIncomeHistory(prev => applyRecordChanges(prev, id, changes));
    }

    // Adjust budget by the difference: a larger expense lowers it, a larger income raises it
    const diff = changes.amount - original.amount;
    if (diff !== 0) {
      const newBudget = budgetData.currentBudget + (type === 'expense' ? -diff : diff);
      saveBudgetData({ currentBudget: newBudget });
      setBudgetData({ ...budgetData, currentBudget: newBudget });
    }
  };

  // Apply many edits at once (e.g. from a pasted TSV): one write per history and one budget update
  // Added rows (e.g. history copied from another device) are recorded as history only; the budget
  // moves just by the amount differences of edited records
  const bulkEditTransactions = (edits: TransactionEdit[], additions: TsvAddition[] = []) => {
    let nextExpenses = expenseHistory;
    let nextIncome = incomeHistory;
    let budgetDelta = 0;

    for (const { type, id, changes } of edits) {
      const history = type === 'expense' ? nextExpenses : nextIncome;
      const original = history.find(r => r.id === id);
      if (!original) continue;
      const diff = changes.amount - original.amount;
      budgetDelta += type === 'expense' ? -diff : diff;
      if (type === 'expense') {
        nextExpenses = applyRecordChanges(nextExpenses, id, changes);
      } else {
        nextIncome = applyRecordChanges(nextIncome, id, changes);
      }
    }
    for (const { type, record } of additions) {
      if (type === 'expense') {
        nextExpenses = [...nextExpenses, record];
      } else {
        nextIncome = [...nextIncome, record];
      }
    }

    saveExpenseHistory(nextExpenses);
    saveIncomeHistory(nextIncome);
    setExpenseHistory(nextExpenses);
    setIncomeHistory(nextIncome);
    if (budgetDelta !== 0) {
      const newBudget = budgetData.currentBudget + budgetDelta;
      saveBudgetData({ currentBudget: newBudget });
      setBudgetData({ ...budgetData, currentBudget: newBudget });
    }
  };

  const addSubscription = (title: string, amount: number, cycle: BillingCycle) => {
    const subscription = addSubscriptionRecord(title, amount, cycle);
    setSubscriptions(prev => [...prev, subscription]);
  };

  const removeSubscription = (id: string) => {
    deleteSubscriptionRecord(id);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  // Used by single edits and TSV bulk edits, which produce the full updated list
  const replaceSubscriptions = (next: Subscription[]) => {
    saveSubscriptions(next);
    setSubscriptions(next);
  };

  // Replace all data with a backup, then catch up on days passed since its last update
  const restoreData = (data: Record<string, string | null>) => {
    restoreBackup(data, (key, value) => localStorage.setItem(key, value), key => localStorage.removeItem(key));
    refreshBudget();
  };

  return (
    <BudgetContext.Provider
      value={{ budgetData, expenseHistory, incomeHistory, subscriptions, isLoading, updateDailyBudget, updateCurrentBudget, updateLastUpdateDate, addExpense, removeExpense, addIncome, removeIncome, editTransaction, bulkEditTransactions, addSubscription, removeSubscription, replaceSubscriptions, restoreData, refreshBudget }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
}
