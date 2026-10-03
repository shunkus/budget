export type Operator = '+' | '-' | '×' | '÷';

export const OPERATORS: readonly Operator[] = ['+', '-', '×', '÷'];

const MAX_DIGITS = 9;

function isOperator(char: string): char is Operator {
  return (OPERATORS as readonly string[]).includes(char);
}

function lastNumber(expression: string): string {
  const match = expression.match(/\d*$/);
  return match ? match[0] : '';
}

// Append a key press to the expression, ignoring inputs that would make it invalid
export function appendKey(expression: string, key: string): string {
  const lastChar = expression.slice(-1);

  if (isOperator(key)) {
    if (expression === '') return expression;
    // Replace a trailing operator instead of stacking operators
    if (isOperator(lastChar)) return expression.slice(0, -1) + key;
    return expression + key;
  }

  const current = lastNumber(expression);
  if (current.length + key.length > MAX_DIGITS) return expression;
  // Avoid leading zeros such as "007"
  if (current === '0') return expression.slice(0, -1) + (key === '00' ? '0' : key);
  if (current === '' && key === '00') return expression + '0';
  return expression + key;
}

export function backspace(expression: string): string {
  return expression.slice(0, -1);
}

// Evaluate with standard precedence (× ÷ before + -). Returns null if incomplete or invalid.
export function evaluate(expression: string): number | null {
  const tokens = expression.match(/\d+|[+\-×÷]/g);
  if (!tokens || tokens.length === 0) return null;
  // A trailing operator is treated as not yet typed
  if (isOperator(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length === 0) return null;

  // First pass: resolve × and ÷ into terms
  const terms: number[] = [Number(tokens[0])];
  const addOps: Operator[] = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as Operator;
    const value = Number(tokens[i + 1]);
    if (op === '×') {
      terms[terms.length - 1] *= value;
    } else if (op === '÷') {
      if (value === 0) return null;
      terms[terms.length - 1] /= value;
    } else {
      addOps.push(op);
      terms.push(value);
    }
  }

  // Second pass: resolve + and -
  return addOps.reduce((sum, op, i) => (op === '+' ? sum + terms[i + 1] : sum - terms[i + 1]), terms[0]);
}

export function hasOperator(expression: string): boolean {
  return /[+\-×÷]/.test(expression);
}
