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
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_earnings: {
        Row: {
          available_at: string
          created_at: string
          creator_id: string
          currency: string
          gross_cents: number
          id: string
          net_cents: number
          notes: string | null
          payout_id: string | null
          platform_fee_cents: number
          processor_fee_cents: number
          product_id: string
          purchase_id: string
          status: Database["public"]["Enums"]["earning_status"]
          updated_at: string
        }
        Insert: {
          available_at: string
          created_at?: string
          creator_id: string
          currency?: string
          gross_cents: number
          id?: string
          net_cents: number
          notes?: string | null
          payout_id?: string | null
          platform_fee_cents: number
          processor_fee_cents?: number
          product_id: string
          purchase_id: string
          status?: Database["public"]["Enums"]["earning_status"]
          updated_at?: string
        }
        Update: {
          available_at?: string
          created_at?: string
          creator_id?: string
          currency?: string
          gross_cents?: number
          id?: string
          net_cents?: number
          notes?: string | null
          payout_id?: string | null
          platform_fee_cents?: number
          processor_fee_cents?: number
          product_id?: string
          purchase_id?: string
          status?: Database["public"]["Enums"]["earning_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_earnings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payout_details: {
        Row: {
          created_at: string
          payout_details: Json | null
          payout_email: string | null
          payout_method: Database["public"]["Enums"]["payout_method"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          payout_details?: Json | null
          payout_email?: string | null
          payout_method?: Database["public"]["Enums"]["payout_method"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          payout_details?: Json | null
          payout_email?: string | null
          payout_method?: Database["public"]["Enums"]["payout_method"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_profiles: {
        Row: {
          created_at: string
          github_handle: string | null
          is_suspended: boolean
          long_bio: string | null
          onboarded_at: string | null
          tagline: string | null
          updated_at: string
          user_id: string
          website: string | null
          x_handle: string | null
        }
        Insert: {
          created_at?: string
          github_handle?: string | null
          is_suspended?: boolean
          long_bio?: string | null
          onboarded_at?: string | null
          tagline?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          x_handle?: string | null
        }
        Update: {
          created_at?: string
          github_handle?: string | null
          is_suspended?: boolean
          long_bio?: string | null
          onboarded_at?: string | null
          tagline?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          x_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          source: string
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          source?: string
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          source?: string
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          id: string
          product_id: string
          source_purchase_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          product_id: string
          source_purchase_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          product_id?: string
          source_purchase_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_source_purchase_id_fkey"
            columns: ["source_purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          creator_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_cents: number
          created_at: string
          creator_id: string
          currency: string
          destination: string
          id: string
          method: Database["public"]["Enums"]["payout_method"]
          notes: string | null
          period_end: string | null
          period_start: string | null
          processed_at: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          creator_id: string
          currency?: string
          destination: string
          id?: string
          method: Database["public"]["Enums"]["payout_method"]
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          creator_id?: string
          currency?: string
          destination?: string
          id?: string
          method?: Database["public"]["Enums"]["payout_method"]
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          cover_image_url: string | null
          created_at: string
          creator_id: string
          currency: string
          deployment_status: Database["public"]["Enums"]["deployment_status"]
          description: string | null
          featured: boolean
          gallery: string[]
          github_repo_url: string | null
          hosted_app_url: string | null
          id: string
          lemon_squeezy_product_id: string | null
          lemon_squeezy_variant_id: string | null
          price_cents: number
          pricing_model: Database["public"]["Enums"]["pricing_model"]
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          tagline: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["product_category"]
          cover_image_url?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          deployment_status?: Database["public"]["Enums"]["deployment_status"]
          description?: string | null
          featured?: boolean
          gallery?: string[]
          github_repo_url?: string | null
          hosted_app_url?: string | null
          id?: string
          lemon_squeezy_product_id?: string | null
          lemon_squeezy_variant_id?: string | null
          price_cents: number
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          tagline?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          cover_image_url?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          deployment_status?: Database["public"]["Enums"]["deployment_status"]
          description?: string | null
          featured?: boolean
          gallery?: string[]
          github_repo_url?: string | null
          hosted_app_url?: string | null
          id?: string
          lemon_squeezy_product_id?: string | null
          lemon_squeezy_variant_id?: string | null
          price_cents?: number
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          tagline?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          current_period_end: string | null
          id: string
          lemon_squeezy_customer_id: string | null
          lemon_squeezy_order_id: string | null
          lemon_squeezy_order_item_id: string | null
          platform_fee_cents: number
          product_id: string
          status: Database["public"]["Enums"]["purchase_status"]
          subtotal_cents: number
          tax_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          lemon_squeezy_customer_id?: string | null
          lemon_squeezy_order_id?: string | null
          lemon_squeezy_order_item_id?: string | null
          platform_fee_cents?: number
          product_id: string
          status?: Database["public"]["Enums"]["purchase_status"]
          subtotal_cents?: number
          tax_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          lemon_squeezy_customer_id?: string | null
          lemon_squeezy_order_id?: string | null
          lemon_squeezy_order_item_id?: string | null
          platform_fee_cents?: number
          product_id?: string
          status?: Database["public"]["Enums"]["purchase_status"]
          subtotal_cents?: number
          tax_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          body: string | null
          created_at: string
          id: string
          product_id: string
          stars: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          product_id: string
          stars: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          product_id?: string
          stars?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "user" | "creator" | "admin"
      deployment_status: "none" | "pending" | "deploying" | "live" | "failed"
      earning_status: "pending" | "available" | "paid" | "reversed"
      payout_method: "paypal" | "wise" | "bank"
      payout_status: "pending" | "processing" | "paid" | "failed"
      pricing_model: "one_time" | "subscription"
      product_category:
        | "productivity"
        | "creative_tools"
        | "developer_tools"
        | "finance"
        | "education"
        | "other"
      product_status: "draft" | "published" | "unlisted" | "removed"
      purchase_status: "active" | "canceled" | "refunded" | "past_due"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      report_target: "product" | "rating" | "comment" | "creator"
      subscription_tier: "free" | "pro"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["user", "creator", "admin"],
      deployment_status: ["none", "pending", "deploying", "live", "failed"],
      earning_status: ["pending", "available", "paid", "reversed"],
      payout_method: ["paypal", "wise", "bank"],
      payout_status: ["pending", "processing", "paid", "failed"],
      pricing_model: ["one_time", "subscription"],
      product_category: [
        "productivity",
        "creative_tools",
        "developer_tools",
        "finance",
        "education",
        "other",
      ],
      product_status: ["draft", "published", "unlisted", "removed"],
      purchase_status: ["active", "canceled", "refunded", "past_due"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      report_target: ["product", "rating", "comment", "creator"],
      subscription_tier: ["free", "pro"],
    },
  },
} as const
