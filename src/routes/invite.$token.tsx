import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { savePendingInvite } from "@/lib/pending-invite";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Join a household — Kinship Capital" },
      { name: "description", content: "You've been invited to share household ledgers on Kinship Capital." },
      { property: "og:title", content: "Join a household — Kinship Capital" },
      { property: "og:description", content: "You've been invited to share household ledgers on Kinship Capital." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: InvitePage,
});

const REASONS: Record<string, string> = {
  not_found: "This invite link isn't valid.",
  revoked: "This invite link was cancelled by the household owner.",
  expired: "This invite link has expired. Ask for a new one.",
};

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const preview = useQuery({
    queryKey: ["invite-preview", token, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_household_invite", { _token: token });
      if (error) throw error;
      return data?.[0] ?? { household_name: null, valid: false, reason: "not_found" };
    },
  });

  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc("accept_household_invite", { _token: token });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries();
    toast.success("You joined the household");
    void navigate({ to: "/family" });
  }

  if (loading) return <AuthCard title="Household invite" subtitle="Loading…">{null}</AuthCard>;

  if (!user) {
    return (
      <AuthCard title="You're invited" subtitle="Sign in or create an account to join the household.">
        <div className="space-y-3">
          <Button asChild className="w-full" onClick={() => savePendingInvite(token)}>
            <Link to="/register">Create an account</Link>
          </Button>
          <Button asChild variant="outline" className="w-full" onClick={() => savePendingInvite(token)}>
            <Link to="/login">I already have an account</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  const p = preview.data;
  return (
    <AuthCard
      title={p?.household_name ? `Join ${p.household_name}` : "Household invite"}
      subtitle="You'll share transactions, categories and budgets with everyone in the household."
    >
      {preview.isLoading ? (
        <p className="text-sm text-muted-foreground">Checking the invite…</p>
      ) : p?.valid ? (
        <Button className="w-full" disabled={busy} onClick={accept}>
          {busy ? "Joining…" : "Join household"}
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{REASONS[p?.reason ?? "not_found"]}</p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/dashboard">Go to my dashboard</Link>
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
