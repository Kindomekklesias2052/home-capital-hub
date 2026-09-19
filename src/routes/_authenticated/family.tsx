import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, LogOut, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useHousehold, useHouseholdMembers, useHouseholdMutations } from "@/hooks/useHousehold";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({
    meta: [
      { title: "Family sharing — Kinship Capital" },
      {
        name: "description",
        content: "Share one set of household ledgers across several phones, each person with their own login.",
      },
      { property: "og:title", content: "Family sharing — Kinship Capital" },
      { property: "og:description", content: "Invite family members to your shared ledgers." },
    ],
  }),
  component: FamilyPage,
});

function FamilyPage() {
  const { user } = useAuth();
  const { data: household, isLoading } = useHousehold();
  const { data: members = [] } = useHouseholdMembers(household?.id);
  const { create, join, removeMember } = useHouseholdMutations();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const isOwner = household?.owner_id === user?.id;

  return (
    <AppShell title="Family" subtitle="One shared ledger, everyone on their own phone">
      <div className="space-y-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : household ? (
          <>
            <section className="surface space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">{household.name}</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this invite code with a family member. They sign up on their own phone, enter the code, and
                immediately see the same transactions, categories and budgets.
              </p>
              <div className="flex items-center gap-2">
                <code className="numeric rounded-lg bg-muted px-3 py-2 text-base tracking-widest">
                  {household.invite_code}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(household.invite_code);
                    toast.success("Invite code copied");
                  }}
                >
                  <Copy className="mr-2 size-4" /> Copy
                </Button>
              </div>
            </section>

            <section className="surface space-y-2 p-4">
              <h2 className="text-sm font-semibold">Members</h2>
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.full_name ?? "Family member"}
                        {m.user_id === user?.id ? " (you)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.role === "owner" ? "Owner" : "Member"} · joined {formatDate(m.joined_at)}
                      </p>
                    </div>
                    {m.user_id === user?.id ? (
                      m.role === "owner" ? null : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeMember.mutate(m.id, { onSuccess: () => toast.success("You left") })}
                        >
                          <LogOut className="mr-2 size-4" /> Leave
                        </Button>
                      )
                    ) : isOwner ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember.mutate(m.id, { onSuccess: () => toast.success("Member removed") })}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <>
            <section className="surface space-y-3 p-4">
              <h2 className="text-sm font-semibold">Start a shared household</h2>
              <p className="text-xs text-muted-foreground">
                Your existing transactions, categories and budgets move into the shared household so the whole family
                sees the same picture.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="household-name">Household name</Label>
                <Input
                  id="household-name"
                  placeholder="Njeri family"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button
                disabled={create.isPending}
                onClick={() =>
                  create.mutate(name, {
                    onSuccess: () => toast.success("Household created"),
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
              >
                Create household
              </Button>
            </section>

            <section className="surface space-y-3 p-4">
              <h2 className="text-sm font-semibold">Join with an invite code</h2>
              <div className="space-y-1.5">
                <Label htmlFor="invite-code">Invite code</Label>
                <Input
                  id="invite-code"
                  placeholder="ABCD1234"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
              <Button
                variant="outline"
                disabled={join.isPending || code.trim().length < 4}
                onClick={() =>
                  join.mutate(code, {
                    onSuccess: () => toast.success("You joined the household"),
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
              >
                Join household
              </Button>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
