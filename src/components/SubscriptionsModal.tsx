'use client';

import { useState } from 'react';
import { useClipboardCopy } from '@/hooks/useClipboardCopy';
import { useBudget } from '@/contexts/BudgetContext';
import { BillingCycle, Subscription, getDailyCost, getDailySubscriptionTotal } from '@/lib/storage';
import { MAX_SUBSCRIPTION_TITLE_LENGTH, parseSubscriptionTsv, subscriptionsToTsv } from '@/lib/subscriptionTsv';

type CycleFilter = 'all' | BillingCycle;
type SortOrder = 'cost-desc' | 'cost-asc' | 'name' | 'newest';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'cost-desc', label: 'Cost: high to low' },
  { value: 'cost-asc', label: 'Cost: low to high' },
  { value: 'newest', label: 'Newest' },
];

const compareSubscriptions: Record<SortOrder, (a: Subscription, b: Subscription) => number> = {
  'cost-desc': (a, b) => getDailyCost(b) - getDailyCost(a),
  'cost-asc': (a, b) => getDailyCost(a) - getDailyCost(b),
  name: (a, b) => a.title.localeCompare(b.title, 'ja'),
  newest: (a, b) => b.createdAt - a.createdAt,
};

interface SubscriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubscriptionsModal({ isOpen, onClose }: SubscriptionsModalProps) {
  const { subscriptions, addSubscription, removeSubscription, replaceSubscriptions } = useBudget();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { status: copyStatus, copy } = useClipboardCopy();
  const [searchQuery, setSearchQuery] = useState('');
  const [cycleFilter, setCycleFilter] = useState<CycleFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('name');
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCycle, setEditCycle] = useState<BillingCycle>('monthly');
  const [editAmount, setEditAmount] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const bulkCopy = useClipboardCopy();

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
    setEditingId(null);
  };

  const startEditing = (subscription: Subscription) => {
    setEditingId(subscription.id);
    setEditTitle(subscription.title);
    setEditCycle(subscription.cycle);
    setEditAmount(String(subscription.amount));
    setDeleteTargetId(null);
  };

  const parsedEditAmount = Number(editAmount);
  const isEditValid = editTitle.trim() !== '' && Number.isInteger(parsedEditAmount) && parsedEditAmount > 0;

  const handleSaveEdit = (id: string) => {
    if (!isEditValid) return;
    replaceSubscriptions(subscriptions.map(s => (
      s.id === id ? { ...s, title: editTitle.trim(), cycle: editCycle, amount: parsedEditAmount } : s
    )));
    setEditingId(null);
  };

  const handleClose = () => {
    setEditingId(null);
    setIsBulkMode(false);
    onClose();
  };

  const formatYen = (value: number) => `¥${Math.round(value).toLocaleString()}`;

  // Equivalent amount in the other billing cycle
  const formatAlternateCycle = (subscription: Subscription) => (
    subscription.cycle === 'monthly'
      ? `${formatYen(subscription.amount * 12)} / year`
      : `${formatYen(subscription.amount / 12)} / month`
  );

  const handleCopy = () => {
    copy(
      visibleSubscriptions
        .map(s => `${s.title}\t${s.cycle === 'monthly' ? 'Monthly' : 'Yearly'}\t${formatYen(s.amount)}`)
        .join('\n'),
    );
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleSubscriptions = subscriptions
    .filter(s => cycleFilter === 'all' || s.cycle === cycleFilter)
    .filter(s => s.title.toLowerCase().includes(normalizedQuery))
    .sort(compareSubscriptions[sortOrder]);
  const isFiltered = visibleSubscriptions.length !== subscriptions.length;
  // Lets the user notice applied filters even while the panel is hidden
  const hasActiveFilters = normalizedQuery !== '' || cycleFilter !== 'all' || sortOrder !== 'name';

  // Bulk edit: rows with an ID update that subscription, rows without one are added; nothing is deleted
  const bulkResult = isBulkMode && bulkText.trim() !== '' ? parseSubscriptionTsv(bulkText, subscriptions) : null;
  const bulkChangeCount = bulkResult ? bulkResult.updatedCount + bulkResult.addedCount : 0;
  const canApplyBulk = bulkResult !== null && bulkResult.errors.length === 0 && bulkChangeCount > 0;

  const openBulkEdit = () => {
    setEditingId(null);
    setBulkText(subscriptionsToTsv(visibleSubscriptions));
    setIsBulkMode(true);
  };

  const applyBulkEdit = () => {
    if (!bulkResult || !canApplyBulk) return;
    replaceSubscriptions(bulkResult.subscriptions);
    setIsBulkMode(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg p-6 w-full max-w-md mx-4 max-h-[90dvh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Subscriptions</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="p-2 sm:p-3 bg-purple-50 rounded-lg min-w-0">
            <p className="text-xs text-purple-600">Per day</p>
            <p className="text-sm sm:text-base font-bold text-purple-700 whitespace-nowrap">-{formatYen(dailyTotal)}</p>
          </div>
          <div className="p-2 sm:p-3 bg-purple-50 rounded-lg min-w-0">
            <p className="text-xs text-purple-600">Per month</p>
            <p className="text-sm sm:text-base font-bold text-purple-700 whitespace-nowrap">-{formatYen(dailyTotal * 365 / 12)}</p>
          </div>
          <div className="p-2 sm:p-3 bg-purple-50 rounded-lg min-w-0">
            <p className="text-xs text-purple-600">Per year</p>
            <p className="text-sm sm:text-base font-bold text-purple-700 whitespace-nowrap">-{formatYen(dailyTotal * 365)}</p>
          </div>
        </div>

        {!isBulkMode ? (
          <>
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
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 bg-surface"
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
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-500">
              {isFiltered
                ? `${visibleSubscriptions.length} of ${subscriptions.length} subscriptions`
                : `${subscriptions.length} subscriptions`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={openBulkEdit}
                className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              >
                Bulk edit
              </button>
              <button
                onClick={() => setShowFilters(prev => !prev)}
                disabled={subscriptions.length === 0}
                aria-expanded={showFilters}
                aria-controls="subscription-filters"
                className={`relative flex items-center gap-1 px-2 py-1 text-sm rounded-md transition-colors disabled:text-gray-300 disabled:hover:bg-transparent ${
                  showFilters
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter
                {hasActiveFilters && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-full" />
                )}
              </button>
              <button
                onClick={handleCopy}
                disabled={visibleSubscriptions.length === 0}
                className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors disabled:text-gray-300 disabled:hover:bg-transparent"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'failed' ? 'Copy failed' : 'Copy list'}
              </button>
            </div>
          </div>
          {subscriptions.length > 0 && showFilters && (
            <div id="subscription-filters" className="mb-2 space-y-2">
              <div className="flex gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title"
                  className="flex-1 w-0 px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 text-sm"
                />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  aria-label="Sort order"
                  className="px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 bg-surface text-sm"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm">
                {(['all', 'monthly', 'yearly'] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setCycleFilter(value)}
                    className={`flex-1 py-1.5 transition-colors ${
                      cycleFilter === value
                        ? 'bg-purple-500 text-white'
                        : 'bg-surface text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {value === 'all' ? 'All' : value === 'monthly' ? 'Monthly' : 'Yearly'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {subscriptions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No subscriptions registered</p>
            ) : visibleSubscriptions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No matching subscriptions</p>
            ) : (
              <div className="space-y-2">
                {visibleSubscriptions.map((subscription) => (
                  editingId === subscription.id ? (
                    <div key={subscription.id} className="p-3 rounded-lg space-y-2 border-2 border-purple-500 bg-purple-50">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        aria-label="Title"
                        maxLength={MAX_SUBSCRIPTION_TITLE_LENGTH}
                        className="w-full px-3 py-2 bg-surface border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                      />
                      <div className="flex gap-2">
                        <select
                          value={editCycle}
                          onChange={(e) => setEditCycle(e.target.value as BillingCycle)}
                          aria-label="Cycle"
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 bg-surface"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            aria-label="Amount"
                            min="1"
                            step="1"
                            className="w-full pl-7 pr-3 py-2 bg-surface border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        {deleteTargetId === subscription.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(subscription.id)}
                              className="px-2 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                            <button onClick={() => setDeleteTargetId(null)} className="text-sm text-gray-500 hover:text-gray-700">
                              Keep
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteTargetId(subscription.id)} className="text-sm text-red-600 hover:text-red-700">
                            Delete
                          </button>
                        )}
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingId(null)} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(subscription.id)}
                            disabled={!isEditValid}
                            className="px-3 py-1 bg-purple-500 text-white text-sm rounded-md hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={subscription.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-purple-50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{subscription.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatYen(subscription.amount)} / {subscription.cycle === 'monthly' ? 'month' : 'year'}
                          <span className="ml-1 text-gray-400">
                            ({formatAlternateCycle(subscription)})
                          </span>
                        </p>
                        <p className="text-xs text-purple-600">
                          -¥{getDailyCost(subscription).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / day
                        </p>
                      </div>
                      <button
                        onClick={() => startEditing(subscription)}
                        className="text-gray-500 hover:text-gray-700 text-sm shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
          </>
        ) : (
          /* Bulk edit: copy the TSV to any editor or AI, then paste the edited version back */
          <div className="flex-1 flex flex-col min-h-0 gap-2">
            <p className="text-xs text-gray-500">
              Edit Title, Cycle (Monthly / Yearly) or Amount and paste the result back. Rows are matched by ID; leave ID
              empty to add a new subscription. Subscriptions you remove from the text are kept.
            </p>
            <div className="flex justify-end gap-2 text-sm">
              <button
                type="button"
                onClick={() => bulkCopy.copy(bulkText)}
                className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              >
                {bulkCopy.status === 'copied' ? 'Copied!' : bulkCopy.status === 'failed' ? 'Copy failed' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => setBulkText('')}
                disabled={bulkText === ''}
                className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors disabled:text-gray-300 disabled:hover:bg-transparent"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={async () => setBulkText(await navigator.clipboard.readText().catch(() => bulkText))}
                className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              >
                Paste
              </button>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'Paste TSV with a header row, e.g.\nID\tTitle\tCycle\tAmount\n\tNetflix\tMonthly\t1490'}
              aria-label="Subscriptions as TSV"
              spellCheck={false}
              wrap="off"
              className="flex-1 min-h-40 w-full p-2 bg-surface border border-gray-300 rounded-md font-mono text-xs text-gray-800 whitespace-pre overflow-auto focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="text-xs max-h-24 overflow-y-auto">
              {!bulkResult ? (
                <p className="text-gray-500">Only the rows you paste are updated or added.</p>
              ) : bulkResult.errors.length > 0 ? (
                <ul className="text-red-600 space-y-0.5">
                  {bulkResult.errors.slice(0, 5).map(error => <li key={error}>{error}</li>)}
                  {bulkResult.errors.length > 5 && <li>…and {bulkResult.errors.length - 5} more</li>}
                </ul>
              ) : (
                <p className="text-gray-600">
                  {bulkChangeCount === 0 ? 'No changes yet' : `${bulkResult.updatedCount} updated, ${bulkResult.addedCount} added`}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400">
          The daily cost of all subscriptions is deducted from your budget every day.
        </p>

        <div className="mt-4 pt-4 border-t border-gray-200">
          {!isBulkMode ? (
            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setIsBulkMode(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyBulkEdit}
                disabled={!canApplyBulk}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
