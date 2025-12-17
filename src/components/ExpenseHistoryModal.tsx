'use client';

import { useState } from 'react';
import { useBudget } from '@/contexts/BudgetContext';

interface ExpenseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'all' | 'expense' | 'income';

interface TransactionItem {
  id: string;
  amount: number;
  date: string;
  timestamp: number;
  type: 'expense' | 'income';
  isDaily?: boolean;
}

export default function ExpenseHistoryModal({ isOpen, onClose }: ExpenseHistoryModalProps) {
  const { expenseHistory, incomeHistory, removeExpense, removeIncome } = useBudget();
  const [activeTab, setActiveTab] = useState<TabType>('all');

  if (!isOpen) return null;

  // Combine and sort all transactions
  const allTransactions: TransactionItem[] = [
    ...expenseHistory.map(r => ({ ...r, type: 'expense' as const, isDaily: false })),
    ...incomeHistory.map(r => ({ ...r, type: 'income' as const })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  // Filter based on active tab
  const filteredTransactions = activeTab === 'all'
    ? allTransactions
    : allTransactions.filter(t => t.type === activeTab);

  // Group by date
  const groupedByDate = filteredTransactions.reduce((acc, record) => {
    if (!acc[record.date]) {
      acc[record.date] = [];
    }
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, TransactionItem[]>);

  const totalExpense = expenseHistory.reduce((sum, record) => sum + record.amount, 0);
  const totalIncome = incomeHistory.reduce((sum, record) => sum + record.amount, 0);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateString === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateString === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  const handleDelete = (record: TransactionItem) => {
    if (record.type === 'expense') {
      removeExpense(record.id, record.amount);
    } else {
      removeIncome(record.id, record.amount);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Transaction History</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600">Expenses</p>
            <p className="text-xl font-bold text-red-700">-¥{totalExpense.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Income</p>
            <p className="text-xl font-bold text-green-700">+¥{totalIncome.toLocaleString()}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mb-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 text-sm font-medium ${
              activeTab === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('expense')}
            className={`flex-1 py-2 text-sm font-medium ${
              activeTab === 'expense'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={`flex-1 py-2 text-sm font-medium ${
              activeTab === 'income'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Income
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {Object.keys(groupedByDate).length === 0 ? (
            <p className="text-gray-500 text-center py-8">No transactions recorded</p>
          ) : (
            Object.entries(groupedByDate).map(([date, records]) => (
              <div key={date} className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">{formatDate(date)}</h3>
                <div className="space-y-2">
                  {records.map((record) => (
                    <div
                      key={record.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        record.type === 'expense' ? 'bg-red-50' : 'bg-green-50'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${
                          record.type === 'expense' ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {record.type === 'expense' ? '-' : '+'}¥{record.amount.toLocaleString()}
                          {record.isDaily && (
                            <span className="ml-2 text-xs font-normal text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                              Daily
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">{formatTime(record.timestamp)}</p>
                      </div>
                      {!record.isDaily && (
                        <button
                          onClick={() => handleDelete(record)}
                          className="text-gray-500 hover:text-gray-700 text-sm"
                          title={record.type === 'expense' ? 'Delete and restore to budget' : 'Delete and deduct from budget'}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
