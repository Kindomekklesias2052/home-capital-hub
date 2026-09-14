import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TransactionForm } from "./TransactionForm";
import { ScopeBadge } from "./ScopeBadge";
import { formatMoney, formatDateTime } from "@/lib/format";
import {
  SCOPES,
  SCOPE_LABELS,
  SOURCE_LABELS,
  TRANSACTION_TYPES,
  TYPE_LABELS,
  type LedgerScope,
  type TransactionType,
} from "@/lib/domain";
import {
  useDeleteTransaction,
  useUpdateTransaction,
  type CategoryRow,
  type TransactionRow,
} from "@/hooks/useLedger";

export function TransactionSheet({
  transaction,
  categories,
  onOpenChange,
}: {
  transaction: TransactionRow | null;
  categories: CategoryRow[];
  onOpenChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();

  if (!transaction) return null;
  const category = categories.find((c) => c.id === transaction.category_id);

  return (
    <Dialog
      open={!!transaction}
      onOpenChange={(open) => {
        if (!open) setEditing(false);
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left">
            {transaction.merchant || transaction.recipient || transaction.sender || "Transaction"}
          </DialogTitle>
          <DialogDescription className="text-left">
            {formatDateTime(transaction.transaction_date)} · {SOURCE_LABELS[transaction.source]}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <TransactionForm
            categories={categories}
            submitLabel="Save changes"
            busy={update.isPending}
            initial={{
              transaction_type: transaction.transaction_type,
              amount: transaction.amount,
              description: transaction.description,
              merchant: transaction.merchant,
              reference: transaction.reference,
              source: transaction.source,
              scope: transaction.scope,
              category_id: transaction.category_id,
              transaction_date: transaction.transaction_date,
              funded_from: transaction.funded_from,
            }}
            onCancel={() => setEditing(false)}
            onSubmit={(values) =>
              update.mutate(
                { id: transaction.id, patch: { ...values, needs_review: false }, learn: true },
                {
                  onSuccess: () => {
                    toast.success("Transaction updated");
                    setEditing(false);
                    onOpenChange(false);
                  },
                  onError: (e) => toast.error((e as Error).message),
                },
              )
            }
          />
        ) : (
          <div className="space-y-5">
            <p className="numeric text-3xl font-semibold">
              {formatMoney(transaction.amount, transaction.currency)}
            </p>

            {transaction.needs_review ? (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4" /> Please confirm this transaction
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto-sorting was only {Math.round(transaction.confidence_score * 100)}% sure.
                  Confirm the details and Kinship will remember your choice next time.
                </p>
              </div>
            ) : null}

            <QuickCorrect transaction={transaction} categories={categories} />

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Ledger" value={<ScopeBadge scope={transaction.scope} />} />
              <Detail label="Category" value={category?.name ?? "Uncategorised"} />
              <Detail label="Type" value={TYPE_LABELS[transaction.transaction_type]} />
              <Detail label="Source" value={SOURCE_LABELS[transaction.source]} />
              <Detail label="Reference" value={transaction.reference ?? "—"} />
              <Detail
                label="Confidence"
                value={`${Math.round(transaction.confidence_score * 100)}%`}
              />
              {transaction.funded_from ? (
                <Detail label="Funded from" value={`${SCOPE_LABELS[transaction.funded_from]} pool`} />
              ) : null}
              <Detail label="Entry" value={transaction.is_manual ? "Manual" : "Auto (SMS)"} />
            </dl>

            {transaction.description ? (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                {transaction.description}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  remove.mutate(transaction.id, {
                    onSuccess: () => {
                      toast.success("Transaction deleted");
                      onOpenChange(false);
                    },
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuickCorrect({
  transaction,
  categories,
}: {
  transaction: TransactionRow;
  categories: CategoryRow[];
}) {
  const update = useUpdateTransaction();
  const scoped = categories.filter((c) => c.scope === transaction.scope);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Type</Label>
        <Select
          value={transaction.transaction_type}
          onValueChange={(v) =>
            update.mutate({
              id: transaction.id,
              patch: { transaction_type: v as TransactionType, needs_review: false, confirmed_at: new Date().toISOString() },
              learn: true,
            })
          }
        >
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
        <Label className="text-xs">Ledger</Label>
        <Select
          value={transaction.scope}
          onValueChange={(v) =>
            update.mutate({
              id: transaction.id,
              patch: { scope: v as LedgerScope, category_id: null, needs_review: false, confirmed_at: new Date().toISOString() },
              learn: true,
            })
          }
        >
          <SelectTrigger>
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
      <div className="space-y-1.5">
        <Label className="text-xs">Category</Label>
        <Select
          value={transaction.category_id ?? ""}
          onValueChange={(v) =>
            update.mutate({
              id: transaction.id,
              patch: { category_id: v, needs_review: false, confirmed_at: new Date().toISOString() },
              learn: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {scoped.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
