import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, TrendingUp, TrendingDown, Scale, AlertTriangle } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ledger/StatCard";
import { TransactionItem } from "@/components/ledger/TransactionItem";
import { TransactionSheet } from "@/components/ledger/TransactionSheet";
import { EmptyState } from "@/components/ledger/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useTransactions, type TransactionRow } from "@/hooks/useLedger";
import { monthlyFlow, pendingReview, scopeTotals, spendingByCategory, totalsFor } from "@/lib/analytics";
import { formatMoney, monthLabel } from "@/lib/format";
import { SCOPE_LABELS } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Kinship Capital" },
      { name: "description", content: "Your household balance sheet across Business, Personal and Family ledgers." },
      { property: "og:title", content: "Dashboard — Kinship Capital" },
      { property: "og:description", content: "Your household balance sheet at a glance." },
    ],
  }),
  component: DashboardPage,
});

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-muted-foreground)",
];

function DashboardPage() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: categories = [] } = useCategories();
  const [selected, setSelected] = useState<TransactionRow | null>(null);

  const totals = useMemo(() => totalsFor(transactions), [transactions]);
  const byScope = useMemo(() => scopeTotals(transactions), [transactions]);
  const categorySpend = useMemo(
    () => spendingByCategory(transactions, categories, 6),
    [transactions, categories],
  );
  const flow = useMemo(() => monthlyFlow(transactions), [transactions]);
  const review = useMemo(() => pendingReview(transactions), [transactions]);
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name;

  const scopeComparison = (["business", "personal", "family"] as const).map((s) => ({
    scope: SCOPE_LABELS[s],
    income: Math.round(byScope[s].income),
    expenses: Math.round(byScope[s].expenses),
  }));

  return (
    <AppShell
      title="Household desk"
      subtitle="Business, Personal and Family at a glance"
      action={
        <Button asChild size="sm">
          <Link to="/add-transaction">Add</Link>
        </Button>
      }
    >
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {review.length > 0 ? (
            <Link
              to="/transactions"
              search={{ review: true }}
              className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4"
            >
              <span className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-warning" />
                <span className="text-sm font-medium">
                  {review.length} transaction{review.length > 1 ? "s" : ""} need your confirmation
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Total income"
              value={formatMoney(totals.income, "KES", true)}
              tone="positive"
              icon={<TrendingUp className="size-4" />}
            />
            <StatCard
              label="Total expenses"
              value={formatMoney(totals.expenses, "KES", true)}
              tone="negative"
              icon={<TrendingDown className="size-4" />}
            />
            <StatCard
              label="Net cash flow"
              value={formatMoney(totals.net, "KES", true)}
              tone={totals.net >= 0 ? "positive" : "negative"}
              icon={<Scale className="size-4" />}
            />
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Business balance"
              value={formatMoney(byScope.business.net, "KES", true)}
              hint={`${formatMoney(byScope.business.income, "KES", true)} in`}
              tone="business"
            />
            <StatCard
              label="Personal balance"
              value={formatMoney(byScope.personal.net, "KES", true)}
              hint={`${formatMoney(byScope.personal.income, "KES", true)} in`}
              tone="personal"
            />
            <StatCard
              label="Family balance"
              value={formatMoney(byScope.family.net, "KES", true)}
              hint={`${formatMoney(byScope.family.expenses, "KES", true)} out`}
              tone="family"
            />
          </section>

          <section className="surface p-4">
            <h2 className="text-sm font-semibold">Monthly cash flow</h2>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flow} margin={{ left: -18, right: 6, top: 6 }}>
                  <defs>
                    <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={monthLabel}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "var(--color-popover-foreground)",
                    }}
                    formatter={(v: number | string) => formatMoney(Number(v), "KES", true)}
                    labelFormatter={monthLabel}
                  />
                  <Area type="monotone" dataKey="income" stroke="var(--color-chart-2)" fill="url(#inFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" stroke="var(--color-chart-3)" fill="url(#outFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="surface p-4">
              <h2 className="text-sm font-semibold">Spending by category</h2>
              {categorySpend.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No spending recorded yet.</p>
              ) : (
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categorySpend} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                        {categorySpend.map((entry, i) => (
                          <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-popover)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 12,
                          fontSize: 12,
                          color: "var(--color-popover-foreground)",
                        }}
                        formatter={(v: number | string) => formatMoney(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <ul className="mt-2 space-y-1">
                {categorySpend.map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      {c.name}
                    </span>
                    <span className="numeric">{formatMoney(c.value, "KES", true)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="surface p-4">
              <h2 className="text-sm font-semibold">Business vs Personal vs Family</h2>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scopeComparison} margin={{ left: -18, right: 6, top: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="scope" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                    <YAxis
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      stroke="var(--color-muted-foreground)"
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-muted)" }}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      formatter={(v: number | string) => formatMoney(Number(v), "KES", true)}
                    />
                    <Bar dataKey="income" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="surface p-2">
            <div className="flex items-center justify-between px-2 py-2">
              <h2 className="text-sm font-semibold">Recent transactions</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/transactions">See all</Link>
              </Button>
            </div>
            {transactions.length === 0 ? (
              <EmptyState
                title="No transactions yet"
                description="Add your first entry or pair an Android device to capture M-PESA messages automatically."
                action={
                  <Button asChild>
                    <Link to="/add-transaction">Add transaction</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {transactions.slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <TransactionItem
                      transaction={t}
                      categoryName={categoryName(t.category_id)}
                      onSelect={setSelected}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <TransactionSheet
        transaction={selected}
        categories={categories}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </AppShell>
  );
}
