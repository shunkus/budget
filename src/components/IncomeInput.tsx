'use client';

import { useState } from 'react';
import { useBudget } from '@/contexts/BudgetContext';

export default function IncomeInput() {
  const { addIncome } = useBudget();
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const incomeAmount = Number(amount);
    if (!isNaN(incomeAmount) && incomeAmount > 0) {
      addIncome(incomeAmount);
      setAmount('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 text-lg"
          min="0"
          step="1"
        />
      </div>
      <button
        type="submit"
        disabled={!amount || Number(amount) <= 0}
        className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
      >
        Add
      </button>
    </form>
  );
}
