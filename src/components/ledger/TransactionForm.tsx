import { useMemo, useState } from "react";
import {
  SCOPES,
  SOURCES,
  SOURCE_LABELS,
  SCOPE_LABELS,
  TRANSACTION_TYPES,
  TYPE_LABELS,
  type LedgerScope,
  type TransactionSource,
  type TransactionType,
} from "@/lib/domain";
import type { CategoryRow, TransactionInput } from "@/hooks/useLedger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TransactionFormValues extends TransactionInput {}

export function TransactionForm({
  categories,
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  categories: CategoryRow[];
  initial?: Partial<TransactionFormValues>;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (values: TransactionFormValues) => void;
  onCancel?: () => void;
}) {
  const [scope, setScope] = useState<LedgerScope>(initial?.scope ?? "personal");
  const [type, setType] = useState<TransactionType>(initial?.transaction_type ?? "expense");
  const [source, setSource] = useState<TransactionSource>(initial?.source ?? "mpesa");
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [categoryId, setCategoryId] = useState<string>(initial?.category_id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [fundedFrom, setFundedFrom] = useState<LedgerScope | "none">(initial?.funded_from ?? "none");
  const [date, setDate] = useState(
    (initial?.transaction_date ?? new Date().toISOString()).slice(0, 16),
  );
  const [error, setError] = useState<string | null>(null);

  const scopedCategories = useMemo(
    () => categories.filter((c) => c.scope === scope),
    [categories, scope],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (value > 100_000_000) {
      setError("That amount looks too large. Check the figure.");
      return;
    }
    setError(null);
    onSubmit({
      transaction_type: type,
      amount: Math.round(value * 100) / 100,
      currency: "KES",
      description: description.trim() || null,
      merchant: merchant.trim() || null,
      reference: reference.trim() || null,
      source,
      scope,
      category_id: categoryId || null,
      transaction_date: new Date(date).toISOString(),
      funded_from: fundedFrom === "none" ? null : fundedFrom,
    });
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label>Ledger</Label>
        <div className="grid grid-cols-3 gap-2">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setScope(s);
                setCategoryId("");
              }}
              className={
                "min-h-11 rounded-xl border px-2 text-sm font-semibold transition-colors " +
                (scope === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground")
              }
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount (KES)</Label>
        <Input
          id="amount"
          inputMode="decimal"
          required
          placeholder="0.00"
          className="numeric h-14 text-2xl"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSACTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Source</Label>
          <Select value={source} onValueChange={(v) => setSource(v as TransactionSource)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {scopedCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date">Date &amp; time</Label>
          <Input
            id="date"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="merchant">Merchant / person</Label>
          <Input
            id="merchant"
            value={merchant ?? ""}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Naivas, Mwangi Wholesalers…"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reference">Reference</Label>
          <Input
            id="reference"
            value={reference ?? ""}
            onChange={(e) => setReference(e.target.value)}
            placeholder="M-PESA code"
          />
        </div>
      </div>

      {scope === "family" ? (
        <div className="space-y-1.5">
          <Label>Funded from (firewall tracking)</Label>
          <Select value={fundedFrom} onValueChange={(v) => setFundedFrom(v as LedgerScope | "none")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {SCOPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SCOPE_LABELS[s]} pool
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="description">Note</Label>
        <Textarea
          id="description"
          rows={2}
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this for?"
        />
      </div>

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
