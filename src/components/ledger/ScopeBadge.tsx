import { cn } from "@/lib/utils";
import { SCOPE_LABELS, type LedgerScope } from "@/lib/domain";

const scopeStyles: Record<LedgerScope, string> = {
  business: "bg-business-soft text-business",
  personal: "bg-personal-soft text-personal",
  family: "bg-family-soft text-family",
};

export function ScopeBadge({ scope, className }: { scope: LedgerScope; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        scopeStyles[scope],
        className,
      )}
    >
      {SCOPE_LABELS[scope]}
    </span>
  );
}

export function CategoryBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {name}
    </span>
  );
}
