'use client';

import { useCallback, useState } from 'react';
import { useBudget } from '@/contexts/BudgetContext';
import { getDateStringDaysAgo, getTodayDateString } from '@/lib/storage';
import { MAX_NOTE_LENGTH, getFrequentNotes } from '@/lib/suggestions';

interface ExpenseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'all' | 'expense' | 'income';
type PeriodType = '7d' | '30d' | '1y' | 'all';

const MAX_NOTE_SUGGESTIONS = 6;

const PERIOD_OPTIONS: { value: PeriodType; label: string; days: number | null }[] = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
  { value: '1y', label: '1 year', days: 365 },
  { value: 'all', label: 'All time', days: null },
];

interface TransactionItem {
  id: string;
  amount: number;
  date: string;
  timestamp: number;
  type: 'expense' | 'income';
  isDaily?: boolean;
  isSubscription?: boolean;
  note?: string;
}

export default function ExpenseHistoryModal({ isOpen, onClose }: ExpenseHistoryModalProps) {
  const { expenseHistory, incomeHistory, removeExpense, removeIncome, editTransaction } = useBudget();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [period, setPeriod] = useState<PeriodType>('7d');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Bring the editor fully into view when it opens near the edge of the list
  const scrollEditorIntoView = useCallback((el: HTMLDivElement | null) => {
    el?.scrollIntoView({ block: 'nearest' });
  }, []);

  if (!isOpen) return null;

  // Calendar days in JST, including today
  const periodDays = PERIOD_OPTIONS.find(p => p.value === period)?.days ?? null;
  const periodStart = periodDays === null ? null : getDateStringDaysAgo(periodDays - 1);

  // Combine and sort all transactions within the selected period
  const allTransactions: TransactionItem[] = [
    ...expenseHistory.map(r => ({ ...r, type: 'expense' as const, isDaily: false })),
    ...incomeHistory.map(r => ({ ...r, type: 'income' as const })),
  ]
    .filter(r => periodStart === null || r.date >= periodStart)
    .sort((a, b) => b.timestamp - a.timestamp);

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

  // Net change per date (income minus expenses), independent of the active tab
  const dailyNet = allTransactions.reduce((acc, record) => {
    const signed = record.type === 'income' ? record.amount : -record.amount;
    acc[record.date] = (acc[record.date] ?? 0) + signed;
    return acc;
  }, {} as Record<string, number>);

  const formatSigned = (amount: number) => {
    const sign = amount > 0 ? '+' : amount < 0 ? '-' : '±';
    return `${sign}¥${Math.abs(amount).toLocaleString()}`;
  };

  const sumOf = (type: TransactionItem['type']) =>
    allTransactions.filter(r => r.type === type).reduce((sum, record) => sum + record.amount, 0);
  const totalExpense = sumOf('expense');
  const totalIncome = sumOf('income');
  const totalNet = totalIncome - totalExpense;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  // Record dates are JST date strings, so compare against JST today/yesterday
  const formatDate = (dateString: string) => {
    const today = getTodayDateString();
    const date = new Date(dateString + 'T00:00:00Z');
    const weekday = date.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' });

    let label: string;
    if (dateString === today) {
      label = 'Today';
    } else if (dateString === getDateStringDaysAgo(1)) {
      label = 'Yesterday';
    } else {
      const isThisYear = dateString.slice(0, 4) === today.slice(0, 4);
      label = date.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        ...(isThisYear ? {} : { year: 'numeric' }),
        month: 'short',
        day: 'numeric',
      });
    }
    return `${label} (${weekday})`;
  };

  // Weekends stand out: Saturday in blue, Sunday in red
  const dateColorClass = (dateString: string) => {
    const day = new Date(dateString + 'T00:00:00Z').getUTCDay();
    if (day === 6) return 'text-blue-500';
    if (day === 0) return 'text-red-500';
    return 'text-gray-500';
  };

  const handleDelete = (record: TransactionItem) => {
    if (record.type === 'expense') {
      removeExpense(record.id, record.amount);
    } else {
      removeIncome(record.id, record.amount);
    }
    setEditingId(null);
  };

  const handleClose = () => {
    setEditingId(null);
    onClose();
  };

  const startEditing = (record: TransactionItem) => {
    setEditingId(record.id);
    setEditAmount(String(record.amount));
    setEditNote(record.note ?? '');
    setConfirmDelete(false);
  };

  const parsedEditAmount = Number(editAmount);
  const isEditValid = editAmount !== '' && Number.isInteger(parsedEditAmount) && parsedEditAmount > 0;

  const handleSaveEdit = (record: TransactionItem) => {
    if (!isEditValid) return;
    editTransaction(record.type, record.id, { amount: parsedEditAmount, note: editNote.trim() || undefined });
    setEditingId(null);
  };

  const trimmedEditNote = editNote.trim();
  const noteSuggestions = getFrequentNotes([...expenseHistory, ...incomeHistory])
    .filter(n => n !== trimmedEditNote && n.toLowerCase().includes(trimmedEditNote.toLowerCase()))
    .slice(0, MAX_NOTE_SUGGESTIONS);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg p-6 w-full max-w-md mx-4 max-h-[90dvh] flex flex-col">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Transaction History</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Period */}
        <div className="mb-3 shrink-0 flex rounded-md border border-gray-300 overflow-hidden text-sm">
          {PERIOD_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
              className={`flex-1 py-1.5 transition-colors ${
                period === option.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-surface text-gray-600 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="mb-4 shrink-0 grid grid-cols-3 gap-2">
          <div className="p-2 bg-red-50 rounded-lg min-w-0">
            <p className="text-xs text-red-600">Expenses</p>
            <p className="text-sm sm:text-base font-bold text-red-700 whitespace-nowrap">-¥{totalExpense.toLocaleString()}</p>
          </div>
          <div className="p-2 bg-green-50 rounded-lg min-w-0">
            <p className="text-xs text-green-600">Income</p>
            <p className="text-sm sm:text-base font-bold text-green-700 whitespace-nowrap">+¥{totalIncome.toLocaleString()}</p>
          </div>
          <div className="p-2 bg-gray-100 rounded-lg min-w-0">
            <p className="text-xs text-gray-600">Net</p>
            <p className={`text-sm sm:text-base font-bold whitespace-nowrap ${
              totalNet > 0 ? 'text-green-700' : totalNet < 0 ? 'text-red-700' : 'text-gray-600'
            }`}>
              {formatSigned(totalNet)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mb-4 shrink-0 border-b border-gray-200">
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
                <div className="flex justify-between items-center mb-2">
                  <h3 className={`text-sm font-medium ${dateColorClass(date)}`}>{formatDate(date)}</h3>
                  <span className={`text-sm font-semibold ${
                    dailyNet[date] > 0 ? 'text-green-600' : dailyNet[date] < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {formatSigned(dailyNet[date])}
                  </span>
                </div>
                <div className="space-y-2">
                  {records.map((record) => editingId === record.id ? (
                    <div
                      key={record.id}
                      ref={scrollEditorIntoView}
                      className={`p-3 rounded-lg space-y-2 border-2 border-blue-500 ${
                        record.type === 'expense' ? 'bg-red-50' : 'bg-green-50'
                      }`}
                    >
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          aria-label="Amount"
                          min="1"
                          step="1"
                          className="w-full pl-7 pr-3 py-2 bg-surface border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                        />
                      </div>
                      <input
                        type="text"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Memo (optional)"
                        aria-label="Memo"
                        maxLength={MAX_NOTE_LENGTH}
                        className="w-full px-3 py-2 bg-surface border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 text-sm"
                      />
                      {noteSuggestions.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                          {noteSuggestions.map(note => (
                            <button
                              key={note}
                              type="button"
                              onClick={() => setEditNote(note)}
                              className="shrink-0 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 hover:bg-blue-100 active:scale-95 transition"
                            >
                              {note}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        {confirmDelete ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(record)}
                              className="px-2 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDelete(false)}
                              className="text-sm text-gray-500 hover:text-gray-700"
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(true)}
                            className="text-sm text-red-600 hover:text-red-700"
                            title={record.type === 'expense' ? 'Delete and restore to budget' : 'Delete and deduct from budget'}
                          >
                            Delete
                          </button>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(record)}
                            disabled={!isEditValid}
                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={record.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        record.type === 'expense' ? 'bg-red-50' : 'bg-green-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`font-medium ${
                          record.type === 'expense' ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {record.type === 'expense' ? '-' : '+'}¥{record.amount.toLocaleString()}
                          {record.isDaily && (
                            <span className="ml-2 text-xs font-normal text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                              Daily
                            </span>
                          )}
                          {record.isSubscription && (
                            <span className="ml-2 text-xs font-normal text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                              Subscriptions
                            </span>
                          )}
                        </p>
                        {record.note && (
                          <p className="text-sm text-gray-700 truncate">{record.note}</p>
                        )}
                        <p className="text-xs text-gray-400">{formatTime(record.timestamp)}</p>
                      </div>
                      {!record.isDaily && !record.isSubscription && (
                        <button
                          onClick={() => startEditing(record)}
                          className="ml-2 shrink-0 text-gray-500 hover:text-gray-700 text-sm"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 shrink-0 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
