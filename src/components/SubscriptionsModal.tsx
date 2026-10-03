'use client';

import { useState } from 'react';
import { useBudget } from '@/contexts/BudgetContext';
import { BillingCycle, getDailyCost, getDailySubscriptionTotal } from '@/lib/storage';

interface SubscriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubscriptionsModal({ isOpen, onClose }: SubscriptionsModalProps) {
  const { subscriptions, addSubscription, removeSubscription } = useBudget();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  if (!isOpen) return null;

  const dailyTotal = getDailySubscriptionTotal(subscriptions);
  const isValid = title.trim() !== '' && Number(amount) > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    addSubscription(title.trim(), Number(amount), cycle);
    setTitle('');
    setAmount('');
  };

  const handleDelete = (id: string) => {
    removeSubscription(id);
    setDeleteTargetId(null);
  };

  const formatYen = (value: number) => `¥${Math.round(value).toLocaleString()}`;

  // Most expensive first, to make reviewing subscriptions easier
  const sortedSubscriptions = [...subscriptions].sort((a, b) => getDailyCost(b) - getDailyCost(a));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Subscriptions</h2>
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
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-purple-600">Per day</p>
            <p className="text-base font-bold text-purple-700 whitespace-nowrap">-{formatYen(dailyTotal)}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-purple-600">Per month</p>
            <p className="text-base font-bold text-purple-700 whitespace-nowrap">-{formatYen(dailyTotal * 365 / 12)}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-purple-600">Per year</p>
            <p className="text-base font-bold text-purple-700 whitespace-nowrap">-{formatYen(dailyTotal * 365)}</p>
          </div>
        </div>

        {/* Add form */}
        <form onSubmit={handleSubmit} className="mb-4 space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Netflix)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
          />
          <div className="flex gap-2">
            <select
              value={cycle}
              onChange={(e) => setCycle(e.target.value as BillingCycle)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 bg-white"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                min="0"
                step="1"
              />
            </div>
            <button
              type="submit"
              disabled={!isValid}
              className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              Add
            </button>
          </div>
        </form>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {sortedSubscriptions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No subscriptions registered</p>
          ) : (
            <div className="space-y-2">
              {sortedSubscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-purple-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{subscription.title}</p>
                    <p className="text-xs text-gray-500">
                      {formatYen(subscription.amount)} / {subscription.cycle === 'monthly' ? 'month' : 'year'}
                      <span className="ml-2 text-purple-600">
                        -¥{getDailyCost(subscription).toFixed(1)} / day
                      </span>
                    </p>
                  </div>
                  {deleteTargetId === subscription.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDelete(subscription.id)}
                        className="px-2 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteTargetId(null)}
                        className="text-gray-500 hover:text-gray-700 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteTargetId(subscription.id)}
                      className="text-gray-500 hover:text-gray-700 text-sm shrink-0"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          The daily cost of all subscriptions is deducted from your budget every day.
        </p>

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
