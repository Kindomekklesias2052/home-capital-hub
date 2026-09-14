import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ledger/EmptyState";
import { ScopeBadge } from "@/components/ledger/ScopeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBudgetMutations, useBudgets, useCategories, useTransactions } from "@/hooks/useLedger";
import { BUDGET_PERIODS, OUTFLOW_TYPES, SCOPE_LABELS, type BudgetPeriod } from "@/lib/domain";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets — Kinship Capital" },
      { name: "description", content: "Set spending limits per category and track them in real time." },
      { property: "og:title", content: "Budgets — Kinship Capital" },
      { property: "og:description", content: "Set spending limits per category and track them." },
    ],
  }),
  component: BudgetsPage,
});

const PERIOD_DAYS: Record<BudgetPeriod, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

function BudgetsPage() {
  const { data: budgets = [] } = useBudgets();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const { create, remove } = useBudgetMutations();

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");

  const rows = useMemo(
    () =>
      budgets.map((b) => {
        const category = categories.find((c) => c.id === b.category_id);
        const since = new Date(Date.now() - PERIOD_DAYS[b.period] * 86_400_000);
        const spent = transactions
          .filter(
            (t) =>
              t.category_id === b.category_id &&
              OUTFLOW_TYPES.includes(t.transaction_type) &&
              new Date(t.transaction_date) >= since,
          )
          .reduce((s, t) => s + t.amount, 0);
        return { budget: b, category, spent, pct: b.amount ? Math.min(150, (spent / b.amount) * 100) : 0 };
      }),
    [budgets, categories, transactions],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!categoryId) {
      toast.error("Choose a category");
      return;
    }
    if (!(value > 0)) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    create.mutate(
      { category_id: categoryId, amount: value, period, start_date: new Date().toISOString().slice(0, 10) },
      {
        onSuccess: () => {
          toast.success("Budget set");
          setAmount("");
          setCategoryId("");
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  }

  return (
    <AppShell title="Budgets" subtitle="Spending limits per category">
      <div className="space-y-5">
        <form className="surface grid gap-3 p-4 sm:grid-cols-4 sm:items-end" onSubmit={submit}>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {SCOPE_LABELS[c.scope]} · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Limit (KES)</Label>
            <Input
              id="budget-amount"
              inputMode="decimal"
              className="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as BudgetPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p[0]?.toUpperCase()}
                    {p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="sm:col-span-4" disabled={create.isPending}>
            Add budget
          </Button>
        </form>

        {rows.length === 0 ? (
          <EmptyState title="No budgets yet" description="Set a limit for a category to keep spending honest." />
        ) : (
          <ul className="space-y-3">
            {rows.map(({ budget, category, spent, pct }) => (
              <li key={budget.id} className="surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{category?.name ?? "Category removed"}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {category ? <ScopeBadge scope={category.scope} /> : null}
                      <span className="capitalize">{budget.period}</span>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete budget"
                    onClick={() => remove.mutate(budget.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Progress value={Math.min(100, pct)} className="mt-3" />
                <p className="numeric mt-2 text-xs text-muted-foreground">
                  {formatMoney(spent, "KES", true)} of {formatMoney(budget.amount, "KES", true)} ·{" "}
                  {pct > 100 ? (
                    <span className="font-semibold text-destructive">over budget</span>
                  ) : (
                    `${Math.round(pct)}% used`
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
