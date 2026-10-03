'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BudgetData, BillingCycle, ExpenseRecord, IncomeRecord, Subscription, saveBudgetData, calculateAndUpdateBudget, getExpenseHistory, addExpenseRecord, deleteExpenseRecord, getIncomeHistory, addIncomeRecord, deleteIncomeRecord, getSubscriptions, addSubscriptionRecord, deleteSubscriptionRecord } from '@/lib/storage';

interface BudgetContextType {
  budgetData: BudgetData;
  expenseHistory: ExpenseRecord[];
  incomeHistory: IncomeRecord[];
  subscriptions: Subscription[];
  isLoading: boolean;
  updateDailyBudget: (amount: number) => void;
  updateCurrentBudget: (amount: number) => void;
  updateLastUpdateDate: (date: string) => void;
  addExpense: (amount: number) => void;
  removeExpense: (id: string, amount: number) => void;
  addIncome: (amount: number) => void;
  removeIncome: (id: string, amount: number) => void;
  addSubscription: (title: string, amount: number, cycle: BillingCycle) => void;
  removeSubscription: (id: string) => void;
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

  const addExpense = (amount: number) => {
    // Add to history
    const record = addExpenseRecord(amount);
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

  const addIncome = (amount: number) => {
    // Add to history
    const record = addIncomeRecord(amount);
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

  const addSubscription = (title: string, amount: number, cycle: BillingCycle) => {
    const subscription = addSubscriptionRecord(title, amount, cycle);
    setSubscriptions(prev => [...prev, subscription]);
  };

  const removeSubscription = (id: string) => {
    deleteSubscriptionRecord(id);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  return (
    <BudgetContext.Provider
      value={{ budgetData, expenseHistory, incomeHistory, subscriptions, isLoading, updateDailyBudget, updateCurrentBudget, updateLastUpdateDate, addExpense, removeExpense, addIncome, removeIncome, addSubscription, removeSubscription, refreshBudget }}
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
