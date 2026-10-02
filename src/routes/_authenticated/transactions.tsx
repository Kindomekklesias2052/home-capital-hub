import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TransactionItem } from "@/components/ledger/TransactionItem";
import { TransactionSheet } from "@/components/ledger/TransactionSheet";
import { EmptyState } from "@/components/ledger/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useTransactions, type TransactionRow } from "@/hooks/useLedger";
import { usePeople } from "@/hooks/useHousehold";
import {
  SCOPES,
  SCOPE_LABELS,
  SOURCES,
  SOURCE_LABELS,
  TRANSACTION_TYPES,
  TYPE_LABELS,
} from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { totalsFor } from "@/lib/analytics";

interface TransactionsSearch {
  review?: boolean | undefined;
}

export const Route = createFileRoute("/_authenticated/transactions")({
  validateSearch: (search: Record<string, unknown>): TransactionsSearch => ({
    review: search["review"] === true || search["review"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Transactions — Kinship Capital" },
      { name: "description", content: "Search, filter and reclassify every household transaction." },
      { property: "og:title", content: "Transactions — Kinship Capital" },
      { property: "og:description", content: "Search, filter and reclassify every household transaction." },
    ],
  }),
  component: TransactionsPage,
});

const ALL = "all";

function TransactionsPage() {
  const { review } = Route.useSearch();
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: categories = [] } = useCategories();

  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<string>(ALL);
  const [source, setSource] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyReview, setOnlyReview] = useState(!!review);
  const [person, setPerson] = useState<string>(ALL);
  const { names, shared, members } = usePeople();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return transactions.filter((t) => {
      if (onlyReview && !t.needs_review) return false;
      if (person !== ALL && t.user_id !== person) return false;
      if (scope !== ALL && t.scope !== scope) return false;
      if (source !== ALL && t.source !== source) return false;
      if (type !== ALL && t.transaction_type !== type) return false;
      if (category !== ALL && t.category_id !== category) return false;
      if (from && new Date(t.transaction_date) < new Date(from)) return false;
      if (to && new Date(t.transaction_date) > new Date(`${to}T23:59:59`)) return false;
      if (needle) {
        const hay = [t.description, t.merchant, t.sender, t.recipient, t.reference]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [transactions, q, scope, source, type, category, from, to, onlyReview, person]);

  const totals = totalsFor(filtered);
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name;
  const activeFilters =
    (person !== ALL ? 1 : 0) +
    (scope !== ALL ? 1 : 0) +
    (source !== ALL ? 1 : 0) +
    (type !== ALL ? 1 : 0) +
    (category !== ALL ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0) +
    (onlyReview ? 1 : 0);

  function clearFilters() {
    setPerson(ALL);
    setScope(ALL);
    setSource(ALL);
    setType(ALL);
    setCategory(ALL);
    setFrom("");
    setTo("");
    setOnlyReview(false);
  }

  return (
    <AppShell
      title="Ledger"
      subtitle={`${filtered.length} transactions · net ${formatMoney(totals.net, "KES", true)}`}
      action={
        <Button asChild size="sm" variant="outline">
          <Link to="/add-transaction">Add</Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search merchant, reference, note…"
              className="pl-9"
              aria-label="Search transactions"
            />
          </div>
          <Button
            variant={activeFilters ? "default" : "outline"}
            size="icon"
            aria-label="Filters"
            onClick={() => setShowFilters((s) => !s)}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        </div>

        {showFilters ? (
          <div className="surface space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {shared ? (
                <FilterSelect
                  label="Added by"
                  value={person}
                  onChange={setPerson}
                  options={members.map((m) => ({ value: m.user_id, label: names.get(m.user_id) ?? "Family member" }))}
                />
              ) : null}
              <FilterSelect label="Ledger" value={scope} onChange={setScope} options={SCOPES.map((s) => ({ value: s, label: SCOPE_LABELS[s] }))} />
              <FilterSelect label="Source" value={source} onChange={setSource} options={SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))} />
              <FilterSelect label="Type" value={type} onChange={setType} options={TRANSACTION_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))} />
              <FilterSelect
                label="Category"
                value={category}
                onChange={setCategory}
                options={categories.map((c) => ({ value: c.id, label: `${SCOPE_LABELS[c.scope]} · ${c.name}` }))}
              />
              <div className="space-y-1.5">
                <Label htmlFor="from" className="text-xs">From</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to" className="text-xs">To</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={onlyReview ? "default" : "outline"}
                onClick={() => setOnlyReview((v) => !v)}
              >
                Needs confirmation
              </Button>
              {activeFilters ? (
                <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                  <X className="mr-1 size-3" /> Clear
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            description="Try a different search term, or clear the filters to see the whole ledger."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <ul className="surface divide-y divide-border p-1">
            {filtered.map((t) => (
              <li key={t.id}>
                <TransactionItem
                  transaction={t}
                  categoryName={categoryName(t.category_id)}
                  addedBy={shared ? (names.get(t.user_id) ?? "Former member") : undefined}
                  onSelect={setSelected}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <TransactionSheet
        transaction={selected}
        categories={categories}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </AppShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
