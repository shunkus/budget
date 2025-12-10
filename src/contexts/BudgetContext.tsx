'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BudgetData, getBudgetData, saveBudgetData, calculateAndUpdateBudget } from '@/lib/storage';

interface BudgetContextType {
  budgetData: BudgetData;
  isLoading: boolean;
  updateDailyBudget: (amount: number) => void;
  updateCurrentBudget: (amount: number) => void;
  updateLastUpdateDate: (date: string) => void;
  refreshBudget: () => void;
}

const BudgetContext = createContext<BudgetContextType | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [budgetData, setBudgetData] = useState<BudgetData>({
    currentBudget: 0,
    dailyBudget: 0,
    lastUpdateDate: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshBudget = useCallback(() => {
    const updatedData = calculateAndUpdateBudget();
    setBudgetData(updatedData);
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

  return (
    <BudgetContext.Provider
      value={{ budgetData, isLoading, updateDailyBudget, updateCurrentBudget, updateLastUpdateDate, refreshBudget }}
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
