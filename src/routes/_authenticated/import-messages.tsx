import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScopeBadge } from "@/components/ledger/ScopeBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useLedger";
import { activeHouseholdId } from "@/hooks/useHousehold";
import { parseSms, type LearnedRule, type ParseResult } from "@/lib/sms/parser";
import { SOURCE_LABELS, TYPE_LABELS, LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain";
import { formatMoney, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/import-messages")({
  head: () => ({
    meta: [
      { title: "Read messages — Kinship Capital" },
      {
        name: "description",
        content: "Paste M-PESA, KCB or bank messages and Kinship Capital recognises the money ones automatically.",
      },
      { property: "og:title", content: "Read messages — Kinship Capital" },
      { property: "og:description", content: "Recognise money messages and turn them into ledger entries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportMessagesPage,
});

function guessSender(body: string): string {
  const b = body.toLowerCase();
  if (b.includes("m-pesa") || b.includes("mpesa") || b.includes("fuliza")) return "MPESA";
  if (b.includes("kcb")) return "KCB";
  if (b.includes("equity")) return "EQUITY";
  return "BANK";
}

function splitMessages(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];
  const blocks = text.includes("\n\n") ? text.split(/\n\s*\n/) : text.split(/\n/);
  return blocks.map((b) => b.trim()).filter((b) => b.length > 4);
}

function useCategoryRules() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["category_rules", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<LearnedRule[]> => {
      const { data, error } = await supabase
        .from("category_rules")
        .select("keyword, scope, category_id, transaction_type, hits");
      if (error) throw error;
      return (data ?? []) as LearnedRule[];
    },
  });
}

interface Candidate {
  body: string;
  sender: string;
  result: ParseResult;
}

function ImportMessagesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: categories = [] } = useCategories();
  const { data: rules = [] } = useCategoryRules();

  const [raw, setRaw] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);

  const categoryRefs = useMemo(
    () => categories.map((c) => ({ id: c.id, name: c.name, scope: c.scope })),
    [categories],
  );

  const scan = () => {
    const messages = splitMessages(raw);
    if (messages.length === 0) {
      toast.error("Paste one or more messages first");
      return;
    }
    const found = messages.map((body) => {
      const sender = guessSender(body);
      return {
        body,
        sender,
        result: parseSms({ smsBody: body, sender, categories: categoryRefs, rules }),
      };
    });
    setCandidates(found);
    const next: Record<number, boolean> = {};
    found.forEach((c, i) => {
      if (c.result.matched) next[i] = true;
    });
    setSelected(next);
    const money = found.filter((c) => c.result.matched).length;
    toast.success(`${money} money message${money === 1 ? "" : "s"} recognised out of ${found.length}`);
  };

  const save = async () => {
    if (!user || !candidates) return;
    const picked = candidates.filter((c, i) => c.result.matched && selected[i]);
    if (picked.length === 0) {
      toast.error("Select at least one recognised message");
      return;
    }
    setSaving(true);
    try {
      const household_id = await activeHouseholdId();
      let saved = 0;
      let duplicates = 0;
      for (const c of picked) {
        const r = c.result;
        const { error } = await supabase.from("transactions").insert({
          user_id: user.id,
          household_id,
          transaction_type: r.transactionType,
          amount: r.amount,
          currency: r.currency,
          description: r.description,
          merchant: r.merchant ?? null,
          sender: r.sender ?? null,
          recipient: r.recipient ?? null,
          reference: r.reference ?? null,
          source: r.source,
          scope: r.scope,
          category_id: r.categoryId ?? null,
          transaction_date: r.transactionDate,
          confidence_score: r.confidenceScore,
          is_manual: false,
          needs_review: r.needsReview,
          confirmed_at: r.needsReview ? null : new Date().toISOString(),
        });
        if (error) {
          if (error.code === "23505") duplicates += 1;
          else throw error;
        } else saved += 1;
      }
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      toast.success(
        `${saved} saved${duplicates ? `, ${duplicates} already recorded` : ""}`,
      );
      void navigate({ to: "/transactions" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const recognised = candidates?.filter((c) => c.result.matched) ?? [];
  const ignored = candidates?.filter((c) => !c.result.matched) ?? [];

  return (
    <AppShell title="Read messages" subtitle="Paste messages and we pick out the money ones">
      <div className="space-y-4">
        <div className="surface p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            Copy one or many messages from your phone and paste them below. Kinship Capital reads each one, keeps the
            money messages (M-PESA, KCB, Equity, bank alerts) and ignores the rest. Separate messages with a blank line.
          </p>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            className="mt-3 font-mono text-xs"
            placeholder={"TFF4XK1ABC Confirmed. Ksh1,500.00 paid to NAIVAS on 12/9/26 at 3:15 PM...\n\nTFF9ZZ2QQQ Confirmed. You have received Ksh8,000.00 from JOHN..."}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={scan}>Recognise money messages</Button>
            {candidates && (
              <Button variant="ghost" onClick={() => { setCandidates(null); setSelected({}); }}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {candidates && (
          <div className="surface p-4 sm:p-6">
            <h2 className="text-base font-semibold">
              {recognised.length} money message{recognised.length === 1 ? "" : "s"} found
            </h2>
            <div className="mt-3 space-y-3">
              {candidates.map((c, i) =>
                c.result.matched ? (
                  <label
                    key={i}
                    className="flex cursor-pointer gap-3 rounded-xl border border-border p-3 transition hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={!!selected[i]}
                      onChange={(e) => setSelected((s) => ({ ...s, [i]: e.target.checked }))}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="numeric font-semibold">{formatMoney(c.result.amount, c.result.currency)}</span>
                        <Badge variant="secondary">{TYPE_LABELS[c.result.transactionType]}</Badge>
                        <ScopeBadge scope={c.result.scope} />
                        <Badge variant="outline">{SOURCE_LABELS[c.result.source]}</Badge>
                        {c.result.confidenceScore < LOW_CONFIDENCE_THRESHOLD && (
                          <Badge variant="destructive">Please confirm later</Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm">{c.result.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.result.categoryName ?? "No category"} · {formatDate(c.result.transactionDate)} ·{" "}
                        {Math.round(c.result.confidenceScore * 100)}% sure
                      </p>
                    </div>
                  </label>
                ) : null,
              )}
              {recognised.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No money messages in what you pasted. Adverts, promotions and chats are skipped.
                </p>
              )}
            </div>

            {ignored.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                {ignored.length} message{ignored.length === 1 ? " was" : "s were"} skipped as not money-related.
              </p>
            )}

            <Button className="mt-4" onClick={() => void save()} disabled={saving || recognised.length === 0}>
              {saving ? "Saving…" : "Add selected to my ledger"}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
