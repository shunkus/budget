'use client';

import { useState, useEffect } from 'react';
import { useBudget } from '@/contexts/BudgetContext';
import { useAuth } from '@/contexts/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { budgetData, updateDailyBudget, updateCurrentBudget, updateLastUpdateDate } = useBudget();
  const { logout } = useAuth();
  const [dailyAmount, setDailyAmount] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDailyAmount(String(budgetData.dailyBudget));
      setLastUpdate(budgetData.lastUpdateDate);
      setShowResetConfirm(false);
      setShowLogoutConfirm(false);
    }
  }, [isOpen, budgetData.dailyBudget, budgetData.lastUpdateDate]);

  const handleReset = () => {
    updateCurrentBudget(budgetData.dailyBudget);
    setShowResetConfirm(false);
    onClose();
  };

  const handleSave = () => {
    const amount = Number(dailyAmount);
    if (!isNaN(amount) && amount >= 0) {
      updateDailyBudget(amount);
    }
    if (lastUpdate && lastUpdate !== budgetData.lastUpdateDate) {
      updateLastUpdateDate(lastUpdate);
    }
    onClose();
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

        {/* Last Update Date Section */}
        <div className="mb-4">
          <label htmlFor="lastUpdate" className="block text-sm font-medium text-gray-700 mb-2">
            Last Update Date
          </label>
          <input
            type="date"
            id="lastUpdate"
            value={lastUpdate}
            onChange={(e) => setLastUpdate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
          />
          <p className="text-sm text-gray-500 mt-1">
            Daily budget is calculated from this date.
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

        {/* Logout Section */}
        <div className="mb-6 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Account
          </label>
          {showLogoutConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Are you sure you want to logout?</span>
              <button
                onClick={logout}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
              >
                Yes, Logout
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-3 py-1 text-gray-600 text-sm hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 transition-colors text-sm"
            >
              Logout
            </button>
          )}
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
