import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useTransactions } from "@/hooks/useLedger";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Kinship Capital" },
      { name: "description", content: "Your Kinship Capital account details." },
      { property: "og:title", content: "Profile — Kinship Capital" },
      { property: "og:description", content: "Your Kinship Capital account details." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone_number ?? "");
    }
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone_number: phone.trim() })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profile saved");
  }

  return (
    <AppShell title="Profile" subtitle="Who holds these ledgers">
      <div className="space-y-5">
        <form className="surface space-y-4 p-4" onSubmit={save}>
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} readOnly disabled />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </form>

        <section className="surface p-4">
          <h2 className="text-sm font-semibold">Account</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Member since</dt>
              <dd>{profile?.created_at ? formatDate(profile.created_at) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Transactions recorded</dt>
              <dd className="numeric">{transactions.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Base currency</dt>
              <dd>{profile?.base_currency ?? "KES"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
