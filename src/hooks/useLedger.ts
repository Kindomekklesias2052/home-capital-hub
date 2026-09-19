import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { learningKeyword } from "@/lib/sms/parser";
import { activeHouseholdId } from "./useHousehold";
import type { BudgetPeriod, LedgerScope, TransactionSource, TransactionType } from "@/lib/domain";

export interface TransactionRow {
  id: string;
  user_id: string;
  transaction_type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  merchant: string | null;
  sender: string | null;
  recipient: string | null;
  reference: string | null;
  source: TransactionSource;
  scope: LedgerScope;
  category_id: string | null;
  transaction_date: string;
  confidence_score: number;
  is_manual: boolean;
  needs_review: boolean;
  confirmed_at: string | null;
  funded_from: LedgerScope | null;
  consensus_state: "not_required" | "pending" | "agreed" | "disputed";
  created_at: string;
}

export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  scope: LedgerScope;
  is_custom: boolean;
  created_at: string;
}

export interface BudgetRow {
  id: string;
  category_id: string | null;
  amount: number;
  period: BudgetPeriod;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface DeviceRow {
  id: string;
  device_name: string;
  device_token: string;
  device_type: string;
  pairing_code: string | null;
  pairing_code_expires_at: string | null;
  last_seen_at: string | null;
  paired_at: string | null;
  status: "pending" | "active" | "revoked";
  created_at: string;
}

const num = (v: unknown) => Number(v ?? 0);

export function useTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TransactionRow[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t) => ({
        ...t,
        amount: num(t.amount),
        confidence_score: num(t.confidence_score),
      })) as TransactionRow[];
    },
  });
}

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("transaction_categories")
        .select("*")
        .order("scope")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
}

export function useBudgets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["budgets", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BudgetRow[]> => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((b) => ({ ...b, amount: num(b.amount) })) as BudgetRow[];
    },
  });
}

export function useDevices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["devices", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DeviceRow[]> => {
      const { data, error } = await supabase
        .from("paired_devices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeviceRow[];
    },
  });
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export interface TransactionInput {
  transaction_type: TransactionType;
  amount: number;
  currency?: string;
  description?: string | null;
  merchant?: string | null;
  sender?: string | null;
  recipient?: string | null;
  reference?: string | null;
  source: TransactionSource;
  scope: LedgerScope;
  category_id?: string | null;
  transaction_date: string;
  funded_from?: LedgerScope | null;
}

export function useCreateTransaction() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      if (!user) throw new Error("Not signed in");
      if (!(input.amount > 0)) throw new Error("Amount must be greater than zero");
      const household_id = await activeHouseholdId();
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          ...input,
          currency: input.currency ?? "KES",
          user_id: user.id,
          household_id,
          is_manual: true,
          needs_review: false,
          confidence_score: 1,
          confirmed_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(["transactions", "metrics"]),
  });
}

export function useUpdateTransaction() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
      learn,
    }: {
      id: string;
      patch: Partial<TransactionRow>;
      learn?: boolean;
    }) => {
      if (!user) throw new Error("Not signed in");
      if (patch.amount !== undefined && !(Number(patch.amount) > 0)) {
        throw new Error("Amount must be greater than zero");
      }
      const { data, error } = await supabase
        .from("transactions")
        .update(patch)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;

      // Feed the correction back into the learning table so future SMS
      // ingestion classifies the same counterparty correctly.
      if (learn && data) {
        const keyword = learningKeyword(data as TransactionRow);
        if (keyword) {
          const { data: existing } = await supabase
            .from("category_rules")
            .select("id, hits")
            .eq("keyword", keyword)
            .maybeSingle();
          if (existing) {
            await supabase
              .from("category_rules")
              .update({
                hits: (existing.hits ?? 1) + 1,
                category_id: data.category_id,
                scope: data.scope,
                transaction_type: data.transaction_type,
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("category_rules").insert({
              user_id: user.id,
              keyword,
              category_id: data.category_id,
              scope: data.scope,
              transaction_type: data.transaction_type,
            });
          }
        }
      }
      return data;
    },
    onSuccess: () => invalidate(["transactions", "metrics"]),
  });
}

export function useDeleteTransaction() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["transactions", "metrics"]),
  });
}

export function useCategoryMutations() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const create = useMutation({
    mutationFn: async ({ name, scope }: { name: string; scope: LedgerScope }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("transaction_categories")
        .insert({ user_id: user.id, name: name.trim(), scope, is_custom: true });
      if (error) throw error;
    },
    onSuccess: () => invalidate(["categories"]),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transaction_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["categories", "transactions"]),
  });
  return { create, remove };
}

export function useBudgetMutations() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const create = useMutation({
    mutationFn: async (input: { category_id: string; amount: number; period: BudgetPeriod; start_date: string }) => {
      if (!user) throw new Error("Not signed in");
      if (!(input.amount > 0)) throw new Error("Budget amount must be greater than zero");
      const { error } = await supabase.from("budgets").insert({ ...input, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => invalidate(["budgets"]),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["budgets"]),
  });
  return { create, remove };
}

function randomToken(length: number, alphabet: string) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function useDeviceMutations() {
  const { user } = useAuth();
  const invalidate = useInvalidate();

  const createPairing = useMutation({
    mutationFn: async (deviceName: string) => {
      if (!user) throw new Error("Not signed in");
      const pairingCode = randomToken(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
      const deviceToken = randomToken(48, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
      const { data, error } = await supabase
        .from("paired_devices")
        .insert({
          user_id: user.id,
          device_name: deviceName.trim() || "Android phone",
          device_token: deviceToken,
          pairing_code: pairingCode,
          pairing_code_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return data as DeviceRow;
    },
    onSuccess: () => invalidate(["devices"]),
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("paired_devices")
        .update({ status: "active", paired_at: new Date().toISOString(), pairing_code: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["devices"]),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("paired_devices").update({ status: "revoked" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["devices"]),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("paired_devices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["devices"]),
  });

  return { createPairing, activate, revoke, remove };
}
