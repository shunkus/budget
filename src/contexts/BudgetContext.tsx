'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BudgetData, ExpenseRecord, IncomeRecord, getBudgetData, saveBudgetData, calculateAndUpdateBudget, getExpenseHistory, addExpenseRecord, deleteExpenseRecord, getIncomeHistory, addIncomeRecord, deleteIncomeRecord } from '@/lib/storage';

interface BudgetContextType {
  budgetData: BudgetData;
  expenseHistory: ExpenseRecord[];
  incomeHistory: IncomeRecord[];
  isLoading: boolean;
  updateDailyBudget: (amount: number) => void;
  updateCurrentBudget: (amount: number) => void;
  updateLastUpdateDate: (date: string) => void;
  addExpense: (amount: number) => void;
  removeExpense: (id: string, amount: number) => void;
  addIncome: (amount: number) => void;
  removeIncome: (id: string, amount: number) => void;
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
  const [isLoading, setIsLoading] = useState(true);

  const refreshBudget = useCallback(() => {
    const updatedData = calculateAndUpdateBudget();
    setBudgetData(updatedData);
    setExpenseHistory(getExpenseHistory());
    setIncomeHistory(getIncomeHistory());
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

  return (
    <BudgetContext.Provider
      value={{ budgetData, expenseHistory, incomeHistory, isLoading, updateDailyBudget, updateCurrentBudget, updateLastUpdateDate, addExpense, removeExpense, addIncome, removeIncome, refreshBudget }}
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
