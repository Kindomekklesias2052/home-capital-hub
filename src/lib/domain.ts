/** Shared domain vocabulary for the Kinship Capital ledgers. */

export const TRANSACTION_TYPES = [
  "income",
  "expense",
  "transfer",
  "loan",
  "withdrawal",
  "deposit",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const SOURCES = ["mpesa", "kcb", "equity", "bank", "cash", "manual"] as const;
export type TransactionSource = (typeof SOURCES)[number];

export const SCOPES = ["business", "personal", "family"] as const;
export type LedgerScope = (typeof SCOPES)[number];

export const BUDGET_PERIODS = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

export const SOURCE_LABELS: Record<TransactionSource, string> = {
  mpesa: "M-PESA",
  kcb: "KCB",
  equity: "Equity",
  bank: "Bank",
  cash: "Cash",
  manual: "Manual",
};

export const SCOPE_LABELS: Record<LedgerScope, string> = {
  business: "Business",
  personal: "Personal",
  family: "Family",
};

export const TYPE_LABELS: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  loan: "Loan",
  withdrawal: "Withdrawal",
  deposit: "Deposit",
};

/** Money coming in vs money going out, used for every balance calculation. */
export const INFLOW_TYPES: TransactionType[] = ["income", "deposit", "loan"];
export const OUTFLOW_TYPES: TransactionType[] = ["expense", "withdrawal"];

export function signedAmount(type: TransactionType, amount: number): number {
  if (INFLOW_TYPES.includes(type)) return amount;
  if (OUTFLOW_TYPES.includes(type)) return -amount;
  return 0; // transfers are scope-neutral
}

export const DEFAULT_CATEGORIES: Record<LedgerScope, string[]> = {
  business: [
    "Business Revenue",
    "Stock",
    "Supplies",
    "Transport",
    "Salaries",
    "Rent",
    "Utilities",
    "Marketing",
    "Loan Repayment",
    "Other Business",
  ],
  personal: [
    "Food",
    "Transport",
    "Clothing",
    "Entertainment",
    "Personal Bills",
    "Savings",
    "Other Personal",
  ],
  family: [
    "School Fees",
    "Household Food",
    "Rent",
    "Utilities",
    "Healthcare",
    "Family Transport",
    "Family Support",
    "Other Family",
  ],
};

export const LOW_CONFIDENCE_THRESHOLD = 0.75;
