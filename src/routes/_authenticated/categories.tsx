import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useCategoryMutations, useTransactions } from "@/hooks/useLedger";
import { SCOPES, SCOPE_LABELS, OUTFLOW_TYPES, type LedgerScope } from "@/lib/domain";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({
    meta: [
      { title: "Categories — Kinship Capital" },
      { name: "description", content: "Manage the categories behind your Business, Personal and Family ledgers." },
      { property: "og:title", content: "Categories — Kinship Capital" },
      { property: "og:description", content: "Manage your ledger categories." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const { create, remove } = useCategoryMutations();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<LedgerScope>("personal");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the category a name");
      return;
    }
    create.mutate(
      { name, scope },
      {
        onSuccess: () => {
          toast.success("Category added");
          setName("");
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  }

  const spendFor = (id: string) =>
    transactions
      .filter((t) => t.category_id === id && OUTFLOW_TYPES.includes(t.transaction_type))
      .reduce((s, t) => s + t.amount, 0);

  return (
    <AppShell title="Categories" subtitle="How each ledger is broken down">
      <div className="space-y-6">
        <form className="surface grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">New category</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Church offering" />
          </div>
          <div className="space-y-1.5">
            <Label>Ledger</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as LedgerScope)}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SCOPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={create.isPending}>
            Add
          </Button>
        </form>

        {SCOPES.map((s) => (
          <section key={s} className="surface p-4">
            <h2 className="text-sm font-semibold">{SCOPE_LABELS[s]} ledger</h2>
            <ul className="mt-3 divide-y divide-border">
              {categories
                .filter((c) => c.scope === s)
                .map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="numeric text-xs text-muted-foreground">
                        {formatMoney(spendFor(c.id), "KES", true)} spent
                        {c.is_custom ? " · custom" : ""}
                      </p>
                    </div>
                    {c.is_custom ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${c.name}`}
                        onClick={() => remove.mutate(c.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
