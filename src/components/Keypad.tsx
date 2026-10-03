'use client';

import { useRef, useState } from 'react';
import { useBudget } from '@/contexts/BudgetContext';
import { AMOUNT_WINDOW_DAYS, MAX_NOTE_LENGTH, getFrequentNotes, getFrequentValues } from '@/lib/suggestions';
import { appendKey, backspace, evaluate, hasOperator } from '@/lib/calculator';

const MAX_FREQUENT_AMOUNTS = 4;
const MAX_NOTE_SUGGESTIONS = 6;

const formatYen = (value: number) => `¥${value.toLocaleString()}`;

// Show the expression with thousands separators, e.g. "12000-980" -> "12,000−980"
const formatExpression = (expression: string) =>
  expression.replace(/\d+/g, (digits) => Number(digits).toLocaleString()).replace(/-/g, '−');

type KeyStyle = 'digit' | 'operator' | 'action' | 'equals';

const KEY_STYLES: Record<KeyStyle, string> = {
  digit: 'bg-surface text-gray-800 hover:bg-gray-50',
  operator: 'bg-gray-100 text-blue-600 hover:bg-gray-200',
  action: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
  equals: 'bg-blue-500 text-white hover:bg-blue-600',
};

export default function Keypad() {
  const { budgetData, expenseHistory, incomeHistory, addExpense, addIncome } = useBudget();
  const [expression, setExpression] = useState('');
  const [note, setNote] = useState('');
  const [isNoteFocused, setIsNoteFocused] = useState(false);
  const noteInputRef = useRef<HTMLInputElement>(null);

  const result = evaluate(expression);
  const amount = result === null ? 0 : Math.round(result);
  const canSubmit = amount > 0;
  const frequentAmounts = getFrequentValues(expenseHistory, AMOUNT_WINDOW_DAYS, r => (r.isSubscription ? undefined : r.amount))
    .slice(0, MAX_FREQUENT_AMOUNTS);

  const trimmedNote = note.trim();
  const noteQuery = trimmedNote.toLowerCase();
  const noteSuggestions = getFrequentNotes([...expenseHistory, ...incomeHistory])
    .filter(n => n !== trimmedNote && n.toLowerCase().includes(noteQuery))
    .slice(0, MAX_NOTE_SUGGESTIONS);
  // While typing a memo the OS keyboard covers the keypad, so the chip row offers memos instead
  const showNoteSuggestions = isNoteFocused && noteSuggestions.length > 0;

  const press = (key: string) => setExpression(prev => appendKey(prev, key));

  const handleEquals = () => {
    if (result !== null && amount >= 0) setExpression(amount === 0 ? '' : String(amount));
  };

  // Replace the current number, or complete a pending operation such as "980+"
  const handleFrequentAmount = (value: number) => {
    setExpression(prev => (/[+\-×÷]$/.test(prev) ? prev + value : String(value)));
  };

  const handleSubmit = (type: 'expense' | 'income') => {
    if (!canSubmit) return;
    const memo = trimmedNote || undefined;
    if (type === 'expense') {
      addExpense(amount, memo);
    } else {
      addIncome(amount, memo);
    }
    setExpression('');
    setNote('');
  };

  const handleNoteSuggestion = (value: string) => {
    setNote(value);
    noteInputRef.current?.blur();
  };

  const renderKey = (label: string, onClick: () => void, style: KeyStyle, extraClass = '', ariaLabel?: string) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`h-10 rounded-lg text-xl font-medium shadow-sm active:scale-95 transition ${KEY_STYLES[style]} ${extraClass}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      {/* Display */}
      <div className="bg-surface rounded-xl shadow-sm px-4 py-1.5 text-right">
        <input
          ref={noteInputRef}
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onFocus={() => setIsNoteFocused(true)}
          onBlur={() => setIsNoteFocused(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Memo (optional)"
          enterKeyHint="done"
          className="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-300 border-b border-gray-200 pb-1 mb-0.5 focus:outline-none focus:border-blue-500"
        />
        <p className="text-2xl font-bold text-gray-800 truncate min-h-8">
          {expression ? `¥${formatExpression(expression)}` : <span className="text-gray-300">¥0</span>}
        </p>
        <p className="text-sm text-gray-400 min-h-5">
          {hasOperator(expression) && result !== null && <span className="mr-2 text-gray-600">= {formatYen(amount)}</span>}
          {canSubmit && <span>After use: {formatYen(budgetData.currentBudget - amount)}</span>}
        </p>
      </div>

      {/* Suggestions: memos while editing the memo, otherwise frequent amounts */}
      {showNoteSuggestions ? (
        <div className="flex gap-2 overflow-x-auto">
          {noteSuggestions.map(value => (
            <button
              key={value}
              type="button"
              // Keep the input focused until the click lands
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => handleNoteSuggestion(value)}
              className="shrink-0 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 hover:bg-blue-100 active:scale-95 transition"
            >
              {value}
            </button>
          ))}
        </div>
      ) : frequentAmounts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {frequentAmounts.map(value => (
            <button
              key={value}
              type="button"
              onClick={() => handleFrequentAmount(value)}
              className="shrink-0 px-3 py-1.5 bg-surface border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 active:scale-95 transition"
            >
              {formatYen(value)}
            </button>
          ))}
        </div>
      )}

      {/* Keys */}
      <div className="grid grid-cols-4 gap-2">
        {renderKey('C', () => setExpression(''), 'action', '', 'Clear')}
        {renderKey('⌫', () => setExpression(prev => backspace(prev)), 'action', '', 'Backspace')}
        {renderKey('÷', () => press('÷'), 'operator')}
        {renderKey('×', () => press('×'), 'operator')}
        {['7', '8', '9'].map(d => renderKey(d, () => press(d), 'digit'))}
        {renderKey('−', () => press('-'), 'operator', '', 'Minus')}
        {['4', '5', '6'].map(d => renderKey(d, () => press(d), 'digit'))}
        {renderKey('+', () => press('+'), 'operator', '', 'Plus')}
        {['1', '2', '3'].map(d => renderKey(d, () => press(d), 'digit'))}
        {renderKey('=', handleEquals, 'equals', 'row-span-2 h-auto', 'Equals')}
        {renderKey('0', () => press('0'), 'digit', 'col-span-2')}
        {renderKey('00', () => press('00'), 'digit')}
      </div>

      {/* Actions: Use on the right, where the thumb rests for right-handed use */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleSubmit('income')}
          disabled={!canSubmit}
          className="py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          + Add
        </button>
        <button
          type="button"
          onClick={() => handleSubmit('expense')}
          disabled={!canSubmit}
          className="py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          − Use
        </button>
      </div>
    </div>
  );
}
