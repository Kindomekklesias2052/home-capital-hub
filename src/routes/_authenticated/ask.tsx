import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Send, Square } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({
    meta: [
      { title: "Ask about your money — Kinship Capital" },
      { name: "description", content: "Ask questions about your household transactions and budgets." },
      { property: "og:title", content: "Ask about your money — Kinship Capital" },
      { property: "og:description", content: "AI-powered answers about your household spending and budgets." },
    ],
  }),
  component: AskPage,
});

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "How much did we spend on food this month?",
  "Where is most of our income coming from?",
  "Are we over any budget right now?",
  "Compare Business vs Family spending in the last 30 days.",
];

function AskPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setError(null);
    setInput("");
    const history = turns.slice(-10);
    setTurns((t) => [...t, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ question: q, history }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't get an answer right now");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setTurns((t) => [...t.slice(0, -1), { role: "assistant", content: text }]);
      }
      if (!text.trim()) throw new Error("No answer came back — please try again later.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        setTurns((t) => (t.at(-1)?.content ? t : t.slice(0, -1)));
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  return (
    <AppShell title="Ask" subtitle="Questions about your transactions and budgets">
      <div className="space-y-4">
        {turns.length === 0 ? (
          <section className="surface space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              Ask anything about your household money. Answers use only your own and your household's records.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => void ask(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </section>
        ) : (
          <ul className="space-y-3">
            {turns.map((t, i) => (
              <li
                key={i}
                className={
                  t.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                    : "max-w-[95%] whitespace-pre-wrap text-sm leading-relaxed"
                }
              >
                {t.content || (busy && i === turns.length - 1 ? <span className="text-muted-foreground">Thinking…</span> : null)}
              </li>
            ))}
          </ul>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <form
          className="surface flex items-end gap-2 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <Textarea
            autoFocus
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            placeholder="e.g. How much went to school fees this term?"
            className="min-h-0 resize-none border-0 shadow-none focus-visible:ring-0"
            aria-label="Your question"
          />
          {busy ? (
            <Button type="button" size="icon" variant="outline" aria-label="Stop" onClick={() => abort.current?.abort()}>
              <Square className="size-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" aria-label="Ask" disabled={input.trim().length < 3}>
              <Send className="size-4" />
            </Button>
          )}
        </form>
      </div>
    </AppShell>
  );
}
