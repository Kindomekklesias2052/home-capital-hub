import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "business" | "personal" | "family";
  className?: string;
}) {
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-success",
    negative: "text-destructive",
    business: "text-business",
    personal: "text-personal",
    family: "text-family",
  }[tone];

  return (
    <div className={cn("surface p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className={cn("numeric mt-2 text-xl font-semibold sm:text-2xl", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
