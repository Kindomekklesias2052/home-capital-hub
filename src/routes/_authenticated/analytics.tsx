import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ShieldCheck, Timer, Handshake } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ledger/StatCard";
import { useCategories, useTransactions } from "@/hooks/useLedger";
import {
  consensusRatio,
  firewallIndex,
  latencySpeed,
  monthlyFlow,
  scopeTotals,
  spendingByCategory,
} from "@/lib/analytics";
import { formatMoney, monthLabel } from "@/lib/format";
import { SCOPE_LABELS } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Kinship Capital" },
      {
        name: "description",
        content: "Firewall index, latency speed and consensus ratio for your household finances.",
      },
      { property: "og:title", content: "Analytics — Kinship Capital" },
      { property: "og:description", content: "Household financial metrics and trends." },
    ],
  }),
  component: AnalyticsPage,
});

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-popover-foreground)",
};

function AnalyticsPage() {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();

  const firewall = useMemo(() => firewallIndex(transactions), [transactions]);
  const latency = useMemo(() => latencySpeed(transactions), [transactions]);
  const consensus = useMemo(() => consensusRatio(transactions), [transactions]);
  const flow = useMemo(() => monthlyFlow(transactions, 6), [transactions]);
  const byScope = useMemo(() => scopeTotals(transactions), [transactions]);
  const catSpend = useMemo(() => spendingByCategory(transactions, categories, 8), [transactions, categories]);

  return (
    <AppShell title="Analytics" subtitle="How well the household institution is run">
      <div className="space-y-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Firewall index"
            value={`${firewall}%`}
            hint="Family spending funded from the personal/salary pool"
            tone={firewall >= 80 ? "positive" : firewall >= 50 ? "neutral" : "negative"}
            icon={<ShieldCheck className="size-4" />}
          />
          <StatCard
            label="Latency speed"
            value={`${latency} h`}
            hint="Average time to reconcile an incoming transaction"
            tone={latency <= 12 ? "positive" : "neutral"}
            icon={<Timer className="size-4" />}
          />
          <StatCard
            label="Consensus ratio"
            value={`${consensus}%`}
            hint="Shared decisions that both partners agreed on"
            tone={consensus >= 80 ? "positive" : "neutral"}
            icon={<Handshake className="size-4" />}
          />
        </section>

        <section className="surface p-4">
          <h2 className="text-sm font-semibold">Income vs expenses</h2>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={flow} margin={{ left: -18, right: 6, top: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string) => formatMoney(Number(v), "KES", true)} labelFormatter={monthLabel} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="income" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expenses" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="net" stroke="var(--color-chart-1)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface p-4">
          <h2 className="text-sm font-semibold">Top spending categories</h2>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catSpend} layout="vertical" margin={{ left: 40, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} fontSize={11} tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" />
                <YAxis type="category" dataKey="name" width={110} fontSize={11} tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} formatter={(v: number | string) => formatMoney(Number(v))} />
                <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {(["business", "personal", "family"] as const).map((s) => (
            <div key={s} className="surface p-4">
              <h3 className="text-sm font-semibold">{SCOPE_LABELS[s]} ledger</h3>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">In</dt>
                  <dd className="numeric text-success">{formatMoney(byScope[s].income, "KES", true)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Out</dt>
                  <dd className="numeric">{formatMoney(byScope[s].expenses, "KES", true)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                  <dt>Net</dt>
                  <dd className="numeric">{formatMoney(byScope[s].net, "KES", true)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
