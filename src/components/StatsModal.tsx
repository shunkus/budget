'use client';

import { useState } from 'react';
import { useBudget } from '@/contexts/BudgetContext';
import {
  StatsPeriod,
  filterByPeriod,
  getBuckets,
  GroupTotal,
  getMemoTotals,
  getTotalsByCategory,
  getCoveredDays,
  getNiceMax,
  getWeekdayAverages,
  isDailyPeriod,
} from '@/lib/stats';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '12m', label: '12 months' },
];

// Monday first, matching how a week is usually read
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatYen = (value: number) => `¥${Math.round(value).toLocaleString()}`;

// Compact axis ticks: ¥12,000 -> ¥12K
const formatTick = (value: number) =>
  value >= 1000 ? `¥${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K` : `¥${value}`;

function formatBucketLabel(key: string, withWeekday = false): string {
  if (key.length === 7) {
    return new Date(key + '-01T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' });
  }
  return new Date(key + 'T00:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(withWeekday ? { weekday: 'short' } : {}),
  });
}

function formatAxisLabel(key: string): string {
  if (key.length === 7) {
    return new Date(key + '-01T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' });
  }
  return formatBucketLabel(key);
}

export default function StatsModal({ isOpen, onClose }: StatsModalProps) {
  const { expenseHistory, budgetData } = useBudget();
  const [period, setPeriod] = useState<StatsPeriod>('30d');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const records = filterByPeriod(expenseHistory, period);
  const buckets = getBuckets(records, period);
  const total = records.reduce((sum, r) => sum + r.amount, 0);
  const coveredDays = getCoveredDays(records, period);
  const averagePerDay = total / coveredDays;
  const peak = buckets.reduce((max, b) => (b.amount > max.amount ? b : max), buckets[0]);
  const weekdayAverages = getWeekdayAverages(records, coveredDays);
  const weekdayMax = Math.max(...weekdayAverages);
  // Subscription deductions have no category of their own; group them under one label
  const categoryTotals = getTotalsByCategory(records, r => r.category ?? (r.isSubscription ? 'Subscriptions' : null));
  const memoTotals = getMemoTotals(records);

  // The daily budget only makes sense as a reference against daily bars
  const isDaily = isDailyPeriod(period);
  const referenceLine = isDaily && budgetData.dailyBudget > 0 ? budgetData.dailyBudget : null;
  const axisMax = getNiceMax(Math.max(peak.amount, referenceLine ?? 0));
  const selected = selectedIndex !== null ? buckets[selectedIndex] : null;
  const axisLabelIndexes = [0, Math.floor((buckets.length - 1) / 2), buckets.length - 1];

  // Horizontal bars scaled to the largest group, with count and share of the total
  const renderBreakdown = (title: string, groups: GroupTotal[]) => {
    const max = groups[0]?.amount ?? 0;
    return (
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
        <div className="space-y-2">
          {groups.map(group => (
            <div key={group.label} className="text-xs">
              <div className="flex justify-between mb-0.5">
                <span className="text-gray-700 truncate">
                  {group.label}
                  <span className="ml-1 text-gray-400">×{group.count}</span>
                </span>
                <span className="ml-2 shrink-0 text-gray-700 tabular-nums">
                  {formatYen(group.amount)}
                  <span className="ml-1 text-gray-400">{Math.round((group.amount / total) * 100)}%</span>
                </span>
              </div>
              <div className="h-2">
                <div className="h-full bg-blue-500 rounded-r" style={{ width: `${(group.amount / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const changePeriod = (value: StatsPeriod) => {
    setPeriod(value);
    setSelectedIndex(null);
  };

  const handleClose = () => {
    setSelectedIndex(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg p-6 w-full max-w-md mx-4 max-h-[90dvh] flex flex-col">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Statistics</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Period */}
        <div className="mb-4 shrink-0 flex rounded-md border border-gray-300 overflow-hidden text-sm">
          {PERIOD_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => changePeriod(option.value)}
              aria-pressed={period === option.value}
              className={`flex-1 py-1.5 transition-colors ${
                period === option.value ? 'bg-blue-500 text-white' : 'bg-surface text-gray-600 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Key figures */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-gray-100 rounded-lg min-w-0">
              <p className="text-xs text-gray-500">Spent</p>
              <p className="text-sm sm:text-base font-semibold text-gray-800 whitespace-nowrap">{formatYen(total)}</p>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg min-w-0">
              <p className="text-xs text-gray-500">Avg / day</p>
              <p className="text-sm sm:text-base font-semibold text-gray-800 whitespace-nowrap">{formatYen(averagePerDay)}</p>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg min-w-0">
              <p className="text-xs text-gray-500">{isDaily ? 'Top day' : 'Top month'}</p>
              <p className="text-sm sm:text-base font-semibold text-gray-800 whitespace-nowrap">{formatYen(peak.amount)}</p>
              {peak.amount > 0 && <p className="text-xs text-gray-400">{formatAxisLabel(peak.key)}</p>}
            </div>
          </div>

          {records.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No expenses in this period</p>
          ) : (
            <>
              {/* Spending over time */}
              <section>
                <h3 className="text-sm font-medium text-gray-700">
                  {isDaily ? 'Daily spending' : 'Monthly spending'}
                </h3>
                <p className="text-xs text-gray-500 mb-2 h-4">
                  {selected
                    ? `${formatBucketLabel(selected.key, isDaily)} · ${formatYen(selected.amount)}`
                    : 'Tap a bar for details'}
                </p>
                <div className="flex gap-1">
                  {/* Y-axis ticks */}
                  <div className="relative w-9 h-40 shrink-0 text-[10px] text-gray-400 tabular-nums">
                    <span className="absolute right-0 top-0 -translate-y-1/2">{formatTick(axisMax)}</span>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatTick(axisMax / 2)}</span>
                    <span className="absolute right-0 bottom-0 translate-y-1/2">¥0</span>
                  </div>
                  <div className="relative flex-1 h-40">
                    {/* Gridlines */}
                    <div className="absolute inset-x-0 top-0 border-t border-gray-200" />
                    <div className="absolute inset-x-0 top-1/2 border-t border-gray-200" />
                    <div className="absolute inset-x-0 bottom-0 border-t border-gray-300" />
                    {referenceLine !== null && (
                      <div
                        className="absolute inset-x-0 border-t border-gray-500 pointer-events-none z-10"
                        style={{ bottom: `${(referenceLine / axisMax) * 100}%` }}
                      >
                        <span className="absolute right-0 bottom-0.5 text-[10px] text-gray-600 bg-surface/80 px-1 rounded">
                          Daily {formatYen(referenceLine)}
                        </span>
                      </div>
                    )}
                    {/* Bars: 2px gaps, capped at 24px wide, 4px rounded top */}
                    <div className="absolute inset-0 flex items-end gap-0.5">
                      {buckets.map((bucket, i) => (
                        <button
                          key={bucket.key}
                          type="button"
                          onClick={() => setSelectedIndex(selectedIndex === i ? null : i)}
                          onMouseEnter={() => setSelectedIndex(i)}
                          aria-label={`${formatBucketLabel(bucket.key, isDaily)}: ${formatYen(bucket.amount)}`}
                          className="flex-1 h-full flex items-end justify-center min-w-0"
                        >
                          <span
                            className={`block w-full max-w-6 rounded-t transition-colors ${
                              selectedIndex === null || selectedIndex === i ? 'bg-blue-500' : 'bg-blue-200'
                            }`}
                            style={{ height: `${(bucket.amount / axisMax) * 100}%` }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* X-axis: every weekday for 7 days, otherwise first, middle and last labels */}
                {period === '7d' ? (
                  <div className="flex gap-0.5 ml-10 mt-1 text-[10px] text-gray-400">
                    {buckets.map(bucket => (
                      <span key={bucket.key} className="flex-1 text-center">
                        {WEEKDAY_NAMES[new Date(bucket.key + 'T00:00:00Z').getUTCDay()]}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex ml-10 mt-1 text-[10px] text-gray-400">
                    {axisLabelIndexes.map((index, i) => (
                      <span key={index} className={`flex-1 ${i === 0 ? 'text-left' : i === 1 ? 'text-center' : 'text-right'}`}>
                        {formatAxisLabel(buckets[index].key)}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* Weekday pattern (with 7 days each weekday appears once, so the chart above already shows it) */}
              {period !== '7d' && (
                <section>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Average by weekday</h3>
                  <div className="space-y-1.5">
                    {WEEKDAY_ORDER.map(day => (
                      <div key={day} className="flex items-center gap-2 text-xs">
                        <span className="w-8 text-gray-500">{WEEKDAY_NAMES[day]}</span>
                        <div className="flex-1 h-3">
                          <div
                            className="h-full bg-blue-500 rounded-r"
                            style={{ width: weekdayMax > 0 ? `${(weekdayAverages[day] / weekdayMax) * 100}%` : 0 }}
                          />
                        </div>
                        <span className="w-16 text-right text-gray-700 tabular-nums">{formatYen(weekdayAverages[day])}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Where the money went */}
              {renderBreakdown('By category', categoryTotals)}
              {renderBreakdown('By memo', memoTotals)}
            </>
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
