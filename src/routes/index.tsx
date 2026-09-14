import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldCheck, Split, Smartphone, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kinship Capital — Run your household like a bank" },
      {
        name: "description",
        content:
          "Kinship Capital separates your Business, Personal and Family money into clean ledgers, with automatic M-PESA and Kenyan bank transaction sorting.",
      },
      { property: "og:title", content: "Kinship Capital — Run your household like a bank" },
      {
        property: "og:description",
        content:
          "Three ledgers, one household. Automatic transaction sorting for M-PESA, KCB and Equity, with budgets, insights and shared decisions.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Split,
    title: "Three ledgers, one household",
    body: "Every shilling lands in the Business, Personal or Family ledger — automatically, and never mixed up again.",
  },
  {
    icon: Smartphone,
    title: "Built for M-PESA",
    body: "A paired Android device forwards M-PESA, KCB and Equity messages to your private ledger over a secure API.",
  },
  {
    icon: ShieldCheck,
    title: "Firewall your family money",
    body: "Track how much domestic spending is funded from the salary pool instead of business capital.",
  },
  {
    icon: LineChart,
    title: "Institution-grade insight",
    body: "Cash flow, category spending, budgets and household metrics — on the phone in your pocket.",
  },
];

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            KC
          </span>
          <span className="font-display text-base font-semibold">Kinship Capital</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="py-10 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            The household as a financial institution
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
            Your family money, organised like a bank runs its books.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Kinship Capital sorts every transaction into a Business, Personal or Family ledger, so
            you always know what the shop earned, what the home consumed, and what is truly yours.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/register">Open your ledgers</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <article key={f.title} className="surface p-5">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 text-base font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </section>

        <section className="surface mt-6 p-5">
          <h2 className="text-base font-semibold">Automatic capture, honestly explained</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            A web browser cannot read SMS. Kinship Capital instead exposes a secure ingestion
            endpoint that a paired Android app posts parsed messages to — the same architecture used
            by bank aggregators. Until you pair a device, add transactions by hand in seconds.
          </p>
        </section>
      </main>
    </div>
  );
}
