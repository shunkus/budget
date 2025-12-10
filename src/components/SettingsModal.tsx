'use client';

import { useState, useEffect } from 'react';
import { useBudget } from '@/contexts/BudgetContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { budgetData, updateDailyBudget, updateCurrentBudget } = useBudget();
  const [dailyAmount, setDailyAmount] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDailyAmount(String(budgetData.dailyBudget));
      setShowResetConfirm(false);
    }
  }, [isOpen, budgetData.dailyBudget]);

  const handleReset = () => {
    updateCurrentBudget(budgetData.dailyBudget);
    setShowResetConfirm(false);
    onClose();
  };

  const handleSave = () => {
    const amount = Number(dailyAmount);
    if (!isNaN(amount) && amount >= 0) {
      updateDailyBudget(amount);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Settings</h2>
        <div className="mb-4">
          <label htmlFor="dailyBudget" className="block text-sm font-medium text-gray-700 mb-2">
            Daily Budget (Yen)
          </label>
          <input
            type="number"
            id="dailyBudget"
            value={dailyAmount}
            onChange={(e) => setDailyAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            min="0"
            step="1"
          />
          <p className="text-sm text-gray-500 mt-1">
            This amount will be added to your budget every day.
          </p>
        </div>

        {/* Reset Budget Section */}
        <div className="mb-6 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reset Budget
          </label>
          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">Are you sure?</span>
              <button
                onClick={handleReset}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
              >
                Yes, Reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1 text-gray-600 text-sm hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors text-sm"
            >
              Reset Budget
            </button>
          )}
          <p className="text-sm text-gray-500 mt-1">
            This will reset your budget to today&apos;s daily amount (¥{budgetData.dailyBudget.toLocaleString()}).
          </p>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
