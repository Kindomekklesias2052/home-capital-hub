import { ArrowDownLeft, ArrowUpRight, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { CategoryBadge, ScopeBadge } from "./ScopeBadge";
import { formatMoney, formatDateTime } from "@/lib/format";
import { INFLOW_TYPES, OUTFLOW_TYPES, SOURCE_LABELS, TYPE_LABELS } from "@/lib/domain";
import type { TransactionRow } from "@/hooks/useLedger";
import { cn } from "@/lib/utils";

export function TransactionItem({
  transaction,
  categoryName,
  onSelect,
}: {
  transaction: TransactionRow;
  categoryName?: string | undefined;
  onSelect?: (t: TransactionRow) => void;
}) {
  const inflow = INFLOW_TYPES.includes(transaction.transaction_type);
  const outflow = OUTFLOW_TYPES.includes(transaction.transaction_type);
  const Icon = inflow ? ArrowDownLeft : outflow ? ArrowUpRight : ArrowLeftRight;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(transaction)}
      className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
          inflow ? "bg-success/15 text-success" : outflow ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold">
            {transaction.merchant || transaction.recipient || transaction.sender || transaction.description || TYPE_LABELS[transaction.transaction_type]}
          </span>
          <span
            className={cn(
              "numeric shrink-0 text-sm font-semibold",
              inflow ? "text-success" : outflow ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {inflow ? "+" : outflow ? "−" : ""}
            {formatMoney(transaction.amount, transaction.currency)}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {formatDateTime(transaction.transaction_date)} · {SOURCE_LABELS[transaction.source]}
          {transaction.reference ? ` · ${transaction.reference}` : ""}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <ScopeBadge scope={transaction.scope} />
          {categoryName ? <CategoryBadge name={categoryName} /> : <CategoryBadge name="Uncategorised" />}
          {transaction.needs_review ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
              <AlertTriangle className="size-3" /> Confirm
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
