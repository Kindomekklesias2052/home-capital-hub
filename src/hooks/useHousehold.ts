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
