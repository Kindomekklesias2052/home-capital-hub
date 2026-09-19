export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          end_date: string | null
          household_id: string | null
          id: string
          period: Database["public"]["Enums"]["budget_period"]
          start_date: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          end_date?: string | null
          household_id?: string | null
          id?: string
          period?: Database["public"]["Enums"]["budget_period"]
          start_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          end_date?: string | null
          household_id?: string | null
          id?: string
          period?: Database["public"]["Enums"]["budget_period"]
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      category_rules: {
        Row: {
          category_id: string | null
          created_at: string
          hits: number
          id: string
          keyword: string
          scope: Database["public"]["Enums"]["ledger_scope"]
          transaction_type:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          hits?: number
          id?: string
          keyword: string
          scope: Database["public"]["Enums"]["ledger_scope"]
          transaction_type?:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          hits?: number
          id?: string
          keyword?: string
          scope?: Database["public"]["Enums"]["ledger_scope"]
          transaction_type?:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_metrics: {
        Row: {
          calculated_at: string
          consensus_ratio: number
          firewall_index: number
          id: string
          latency_speed: number
          user_id: string
        }
        Insert: {
          calculated_at?: string
          consensus_ratio?: number
          firewall_index?: number
          id?: string
          latency_speed?: number
          user_id: string
        }
        Update: {
          calculated_at?: string
          consensus_ratio?: number
          firewall_index?: number
          id?: string
          latency_speed?: number
          user_id?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      paired_devices: {
        Row: {
          created_at: string
          device_name: string
          device_token: string
          device_type: string
          id: string
          last_seen_at: string | null
          paired_at: string | null
          pairing_code: string | null
          pairing_code_expires_at: string | null
          push_token: string | null
          status: Database["public"]["Enums"]["device_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name: string
          device_token: string
          device_type?: string
          id?: string
          last_seen_at?: string | null
          paired_at?: string | null
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          push_token?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string
          device_token?: string
          device_type?: string
          id?: string
          last_seen_at?: string | null
          paired_at?: string | null
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          push_token?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          full_name: string | null
          id: string
          phone_number: string | null
        }
        Insert: {
          base_currency?: string
          created_at?: string
          full_name?: string | null
          id: string
          phone_number?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          body: string
          created_at: string
          device_id: string | null
          id: string
          parse_error: string | null
          parsed: boolean
          received_at: string
          sender: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          device_id?: string | null
          id?: string
          parse_error?: string | null
          parsed?: boolean
          received_at?: string
          sender: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          device_id?: string | null
          id?: string
          parse_error?: string | null
          parsed?: boolean
          received_at?: string
          sender?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          created_at: string
          household_id: string | null
          id: string
          is_custom: boolean
          name: string
          scope: Database["public"]["Enums"]["ledger_scope"]
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id?: string | null
          id?: string
          is_custom?: boolean
          name: string
          scope: Database["public"]["Enums"]["ledger_scope"]
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string | null
          id?: string
          is_custom?: boolean
          name?: string
          scope?: Database["public"]["Enums"]["ledger_scope"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          confidence_score: number
          confirmed_at: string | null
          consensus_state: Database["public"]["Enums"]["consensus_status"]
          created_at: string
          currency: string
          description: string | null
          funded_from: Database["public"]["Enums"]["ledger_scope"] | null
          household_id: string | null
          id: string
          is_manual: boolean
          merchant: string | null
          needs_review: boolean
          recipient: string | null
          reference: string | null
          scope: Database["public"]["Enums"]["ledger_scope"]
          sender: string | null
          sms_message_id: string | null
          source: Database["public"]["Enums"]["transaction_source"]
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          confidence_score?: number
          confirmed_at?: string | null
          consensus_state?: Database["public"]["Enums"]["consensus_status"]
          created_at?: string
          currency?: string
          description?: string | null
          funded_from?: Database["public"]["Enums"]["ledger_scope"] | null
          household_id?: string | null
          id?: string
          is_manual?: boolean
          merchant?: string | null
          needs_review?: boolean
          recipient?: string | null
          reference?: string | null
          scope?: Database["public"]["Enums"]["ledger_scope"]
          sender?: string | null
          sms_message_id?: string | null
          source?: Database["public"]["Enums"]["transaction_source"]
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          confidence_score?: number
          confirmed_at?: string | null
          consensus_state?: Database["public"]["Enums"]["consensus_status"]
          created_at?: string
          currency?: string
          description?: string | null
          funded_from?: Database["public"]["Enums"]["ledger_scope"] | null
          household_id?: string | null
          id?: string
          is_manual?: boolean
          merchant?: string | null
          needs_review?: boolean
          recipient?: string | null
          reference?: string | null
          scope?: Database["public"]["Enums"]["ledger_scope"]
          sender?: string | null
          sms_message_id?: string | null
          source?: Database["public"]["Enums"]["transaction_source"]
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_sms_message_id_fkey"
            columns: ["sms_message_id"]
            isOneToOne: false
            referencedRelation: "sms_messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_household: {
        Args: { _name: string }
        Returns: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        SetofOptions: {
          from: "*"
          to: "households"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_household_member: { Args: { _household_id: string }; Returns: boolean }
      is_household_owner: { Args: { _household_id: string }; Returns: boolean }
      join_household: {
        Args: { _code: string }
        Returns: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        SetofOptions: {
          from: "*"
          to: "households"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      budget_period: "weekly" | "monthly" | "quarterly" | "yearly"
      consensus_status: "not_required" | "pending" | "agreed" | "disputed"
      device_status: "pending" | "active" | "revoked"
      ledger_scope: "business" | "personal" | "family"
      transaction_source:
        | "mpesa"
        | "kcb"
        | "equity"
        | "bank"
        | "cash"
        | "manual"
      transaction_type:
        | "income"
        | "expense"
        | "transfer"
        | "loan"
        | "withdrawal"
        | "deposit"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      budget_period: ["weekly", "monthly", "quarterly", "yearly"],
      consensus_status: ["not_required", "pending", "agreed", "disputed"],
      device_status: ["pending", "active", "revoked"],
      ledger_scope: ["business", "personal", "family"],
      transaction_source: ["mpesa", "kcb", "equity", "bank", "cash", "manual"],
      transaction_type: [
        "income",
        "expense",
        "transfer",
        "loan",
        "withdrawal",
        "deposit",
      ],
    },
  },
} as const
