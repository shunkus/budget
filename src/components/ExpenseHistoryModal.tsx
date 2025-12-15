'use client';

import { useBudget } from '@/contexts/BudgetContext';

interface ExpenseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExpenseHistoryModal({ isOpen, onClose }: ExpenseHistoryModalProps) {
  const { expenseHistory, removeExpense } = useBudget();

  if (!isOpen) return null;

  // Sort by timestamp descending (newest first)
  const sortedHistory = [...expenseHistory].sort((a, b) => b.timestamp - a.timestamp);

  // Group by date
  const groupedByDate = sortedHistory.reduce((acc, record) => {
    if (!acc[record.date]) {
      acc[record.date] = [];
    }
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, typeof sortedHistory>);

  const totalExpense = expenseHistory.reduce((sum, record) => sum + record.amount, 0);

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Expense History</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-500">Total (Last 7 days)</p>
          <p className="text-2xl font-bold text-gray-800">¥{totalExpense.toLocaleString()}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {Object.keys(groupedByDate).length === 0 ? (
            <p className="text-gray-500 text-center py-8">No expenses recorded</p>
          ) : (
            Object.entries(groupedByDate).map(([date, records]) => (
              <div key={date} className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">{formatDate(date)}</h3>
                <div className="space-y-2">
                  {records.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-800">¥{record.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{formatTime(record.timestamp)}</p>
                      </div>
                      <button
                        onClick={() => removeExpense(record.id, record.amount)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        title="Delete and restore to budget"
                      >
                        Delete
                      </button>
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
