import { INFLOW_TYPES, OUTFLOW_TYPES, SCOPES, type LedgerScope } from "./domain";
import { monthKey } from "./format";
import type { CategoryRow, TransactionRow } from "@/hooks/useLedger";

export interface Totals {
  income: number;
  expenses: number;
  net: number;
}

export function totalsFor(transactions: TransactionRow[]): Totals {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (INFLOW_TYPES.includes(t.transaction_type)) income += t.amount;
    else if (OUTFLOW_TYPES.includes(t.transaction_type)) expenses += t.amount;
  }
  return { income, expenses, net: income - expenses };
}

export function scopeTotals(transactions: TransactionRow[]): Record<LedgerScope, Totals> {
  const result = {} as Record<LedgerScope, Totals>;
  for (const scope of SCOPES) {
    result[scope] = totalsFor(transactions.filter((t) => t.scope === scope));
  }
  return result;
}

export function spendingByCategory(transactions: TransactionRow[], categories: CategoryRow[], limit = 8) {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (!OUTFLOW_TYPES.includes(t.transaction_type)) continue;
    const name = (t.category_id && names.get(t.category_id)) || "Uncategorised";
    totals.set(name, (totals.get(name) ?? 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Where the money comes from, grouped by who/what paid. */
export function incomeByPayer(transactions: TransactionRow[], categories: CategoryRow[], limit = 8) {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (!INFLOW_TYPES.includes(t.transaction_type)) continue;
    const label =
      t.sender ?? t.merchant ?? (t.category_id ? names.get(t.category_id) : null) ?? t.description ?? "Other income";
    totals.set(label, (totals.get(label) ?? 0) + t.amount);
  }
  const rows = [...totals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return rows.slice(0, limit).map((r) => ({ ...r, share: total ? Math.round((r.value / total) * 1000) / 10 : 0 }));
}

/** Income grouped by the channel it arrived through (M-PESA, bank, cash …). */
export function incomeByChannel(transactions: TransactionRow[]) {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (!INFLOW_TYPES.includes(t.transaction_type)) continue;
    totals.set(t.source, (totals.get(t.source) ?? 0) + t.amount);
  }
  return [...totals.entries()].map(([source, value]) => ({ source, value })).sort((a, b) => b.value - a.value);
}

export function monthlyFlow(transactions: TransactionRow[], months = 6) {
  const buckets = new Map<string, { income: number; expenses: number }>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(d), { income: 0, expenses: 0 });
  }
  for (const t of transactions) {
    const key = monthKey(t.transaction_date);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (INFLOW_TYPES.includes(t.transaction_type)) bucket.income += t.amount;
    else if (OUTFLOW_TYPES.includes(t.transaction_type)) bucket.expenses += t.amount;
  }
  return [...buckets.entries()].map(([key, v]) => ({
    month: key,
    income: Math.round(v.income),
    expenses: Math.round(v.expenses),
    net: Math.round(v.income - v.expenses),
  }));
}

/**
 * FIREWALL INDEX — share of family/domestic spending funded from the
 * designated personal/salary pool. 100% means the household never dipped into
 * business capital to pay for domestic obligations.
 */
export function firewallIndex(transactions: TransactionRow[]): number {
  const familySpend = transactions.filter(
    (t) => t.scope === "family" && OUTFLOW_TYPES.includes(t.transaction_type),
  );
  if (familySpend.length === 0) return 100;
  const total = familySpend.reduce((s, t) => s + t.amount, 0);
  const funded = familySpend
    .filter((t) => (t.funded_from ?? "personal") === "personal")
    .reduce((s, t) => s + t.amount, 0);
  return total === 0 ? 100 : Math.round((funded / total) * 1000) / 10;
}

/**
 * LATENCY SPEED — average hours between a transaction landing and the user
 * reconciling/classifying it. Lower is better.
 */
export function latencySpeed(transactions: TransactionRow[]): number {
  const reconciled = transactions.filter((t) => !t.is_manual && t.confirmed_at);
  if (reconciled.length === 0) return 0;
  const hours = reconciled.map((t) => {
    const start = new Date(t.transaction_date).getTime();
    const end = new Date(t.confirmed_at as string).getTime();
    return Math.max(0, (end - start) / 3_600_000);
  });
  return Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10;
}

/**
 * CONSENSUS RATIO — of the transactions that require dual/spousal sign-off,
 * the share that both parties agreed on.
 */
export function consensusRatio(transactions: TransactionRow[]): number {
  const requiring = transactions.filter((t) => t.consensus_state !== "not_required");
  if (requiring.length === 0) return 100;
  const agreed = requiring.filter((t) => t.consensus_state === "agreed").length;
  return Math.round((agreed / requiring.length) * 1000) / 10;
}

export function pendingReview(transactions: TransactionRow[]) {
  return transactions.filter((t) => t.needs_review);
}
