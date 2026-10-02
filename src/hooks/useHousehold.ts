import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface HouseholdRow {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
}

export interface HouseholdMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  full_name: string | null;
}

/** Household the signed-in user belongs to, if any. */
export function useHousehold() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["household", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<HouseholdRow | null> => {
      const { data, error } = await supabase.from("households").select("*").maybeSingle();
      if (error) throw error;
      return (data as HouseholdRow) ?? null;
    },
  });
}

export function useHouseholdMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: ["household-members", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<HouseholdMember[]> => {
      const { data, error } = await supabase
        .from("household_members")
        .select("id, user_id, role, joined_at")
        .eq("household_id", householdId!)
        .order("joined_at");
      if (error) throw error;
      const rows = data ?? [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", rows.map((r) => r.user_id));
      const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return rows.map((r) => ({ ...r, full_name: names.get(r.user_id) ?? null }));
    },
  });
}

/** Names of everyone in the household, keyed by user id ("You" for the signed-in user). */
export function usePeople() {
  const { user } = useAuth();
  const { data: household } = useHousehold();
  const { data: members = [] } = useHouseholdMembers(household?.id);
  const names = new Map<string, string>(
    members.map((m) => [m.user_id, m.user_id === user?.id ? "You" : (m.full_name ?? "Family member")]),
  );
  return { names, shared: members.length > 1, members };
}

/** Household id to stamp on newly created records, or null when solo. */
export async function activeHouseholdId(): Promise<string | null> {
  const { data } = await supabase.from("households").select("id").maybeSingle();
  return data?.id ?? null;
}

export function useHouseholdMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    ["household", "household-members", "transactions", "categories", "budgets"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }),
    );
  };

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc("create_household", { _name: name });
      if (error) throw error;
      return data as unknown as HouseholdRow;
    },
    onSuccess: refresh,
  });

  const join = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("join_household", { _code: code });
      if (error) throw error;
      return data as unknown as HouseholdRow;
    },
    onSuccess: refresh,
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("household_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { create, join, removeMember };
}

export interface HouseholdInvite {
  id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

/** Invite links for the owner's household (RLS: owner only). */
export function useInvites(householdId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["household-invites", householdId],
    enabled: !!householdId && enabled,
    queryFn: async (): Promise<HouseholdInvite[]> => {
      const { data, error } = await supabase
        .from("household_invites")
        .select("id, token, expires_at, revoked_at, created_at")
        .eq("household_id", householdId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInviteMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["household-invites"] });
  const createInvite = useMutation({
    mutationFn: async (days: number) => {
      const { data, error } = await supabase.rpc("create_household_invite", { _days: days });
      if (error) throw error;
      return data as unknown as HouseholdInvite;
    },
    onSuccess: refresh,
  });
  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("household_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  return { createInvite, revokeInvite };
}
