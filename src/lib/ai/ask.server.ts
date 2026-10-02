import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
} from "./run-id.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

const Body = z.object({
  question: z.string().trim().min(3).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) }))
    .max(10)
    .default([]),
});

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Answers a household member's question using only the ledgers they can read (RLS applies). */
export async function handleAsk(request: Request): Promise<Response> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const url = process.env["SUPABASE_URL"];
  const anon = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!apiKey || !url || !anon) return json(500, "Server configuration error");

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return json(401, "Please sign in again");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, "Ask a question between 3 and 1000 characters");

  const supabase = createClient<Database>(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return json(401, "Please sign in again");

  const [tx, cats, budgets, members] = await Promise.all([
    supabase
      .from("transactions")
      .select("transaction_date, transaction_type, amount, currency, scope, source, category_id, merchant, recipient, sender, description, user_id")
      .order("transaction_date", { ascending: false })
      .limit(800),
    supabase.from("transaction_categories").select("id, name, scope"),
    supabase.from("budgets").select("category_id, amount, period, start_date, end_date"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  if (tx.error) return json(500, "Couldn't load your transactions");

  const catName = new Map((cats.data ?? []).map((c) => [c.id, `${c.scope}/${c.name}`]));
  const who = new Map(
    (members.data ?? []).map((p) => [p.id, p.id === userData.user.id ? "me" : (p.full_name ?? "member")]),
  );
  const txLines = (tx.data ?? []).map((t) =>
    [
      t.transaction_date.slice(0, 10),
      t.transaction_type,
      t.amount,
      t.currency,
      t.scope,
      t.source,
      (t.category_id && catName.get(t.category_id)) || "uncategorised",
      t.merchant || t.recipient || t.sender || t.description || "",
      who.get(t.user_id) ?? "member",
    ].join("|"),
  );
  const budgetLines = (budgets.data ?? []).map((b) =>
    [(b.category_id && catName.get(b.category_id)) || "overall", b.amount, b.period, b.start_date, b.end_date ?? ""].join("|"),
  );

  const system = `You are the money assistant inside Kinship Capital, a Kenyan household finance app with Business, Personal and Family ledgers.
Answer ONLY from the data below. Today is ${new Date().toISOString().slice(0, 10)}.
Show the relevant figures in KES (e.g. "KES 12,500"), briefly explain how you got them, and keep answers under 200 words. Write plain text without markdown symbols.
Income-like types: income, deposit, loan. Spending: expense, withdrawal. Transfers are neutral.
If the data can't answer the question, say so plainly and suggest what to record. Never invent transactions.

TRANSACTIONS (date|type|amount|currency|ledger|source|category|party|added_by), newest first, ${txLines.length} rows:
${txLines.join("\n") || "(none yet)"}

BUDGETS (category|amount|period|start|end):
${budgetLines.join("\n") || "(none)"}`;

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    system,
    messages: [...parsed.data.history, { role: "user" as const, content: parsed.data.question }],
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
    onError: ({ error }) => console.error("[ask] gateway error", error),
  });

  return result.toTextStreamResponse();
}
