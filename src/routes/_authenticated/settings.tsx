import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileDown, LogOut, Moon, Sun } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useCategories, useTransactions } from "@/hooks/useLedger";
import {
  RANGE_LABELS,
  buildReport,
  downloadBlob,
  reportCsv,
  reportPdf,
  type ReportRange,
} from "@/lib/report";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Kinship Capital" },
      { name: "description", content: "Appearance, security and data settings for Kinship Capital." },
      { property: "og:title", content: "Settings — Kinship Capital" },
      { property: "og:description", content: "Appearance, security and data settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const [range, setRange] = useState<ReportRange>("30");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    toast.success("Password updated");
  }

  function downloadPdf() {
    const report = buildReport(transactions, categories, range);
    if (!report.transactions.length) {
      toast.error("No transactions in this period");
      return;
    }
    reportPdf(report, categories).save(`kinship-summary-${range}.pdf`);
    toast.success("Summary downloaded");
  }

  function downloadCsv() {
    const report = buildReport(transactions, categories, range);
    if (!report.transactions.length) {
      toast.error("No transactions in this period");
      return;
    }
    downloadBlob(reportCsv(report, categories), `kinship-summary-${range}.csv`, "text/csv");
    toast.success("Spreadsheet downloaded");
  }

  return (
    <AppShell title="Settings" subtitle="Appearance, security and data">
      <div className="space-y-5">
        <section className="surface flex items-center justify-between p-4">
          <div>
            <h2 className="text-sm font-semibold">Dark mode</h2>
            <p className="text-xs text-muted-foreground">Easier on the eyes at night.</p>
          </div>
          <div className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} aria-label="Toggle dark mode" />
          </div>
        </section>

        <form className="surface space-y-3 p-4" onSubmit={changePassword}>
          <h2 className="text-sm font-semibold">Change password</h2>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>

        <section className="surface space-y-3 p-4">
          <h2 className="text-sm font-semibold">Your data</h2>
          <p className="text-xs text-muted-foreground">
            Your ledgers are private: only your signed-in account can read or change them.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="report-range">Summary period</Label>
            <select
              id="report-range"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={range}
              onChange={(e) => setRange(e.target.value as ReportRange)}
            >
              {(Object.keys(RANGE_LABELS) as ReportRange[]).map((r) => (
                <option key={r} value={r}>
                  {RANGE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadPdf}>
              <FileDown className="mr-2 size-4" /> Download summary (PDF)
            </Button>
            <Button variant="outline" onClick={downloadCsv}>
              Download spreadsheet (CSV)
            </Button>
            <Button asChild variant="outline">
              <Link to="/devices">Manage devices</Link>
            </Button>
          </div>
        </section>

        <section className="surface p-4">
          <Button
            variant="destructive"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/login" });
            }}
          >
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
