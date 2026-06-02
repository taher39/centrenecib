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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string | null
          client_id: string
          created_at: string
          group_id: string | null
          id: string
          is_read: boolean
          notes: string | null
          offer_id: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time?: string | null
          client_id: string
          created_at?: string
          group_id?: string | null
          id?: string
          is_read?: boolean
          notes?: string | null
          offer_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string | null
          client_id?: string
          created_at?: string
          group_id?: string | null
          id?: string
          is_read?: boolean
          notes?: string | null
          offer_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      center_settings: {
        Row: {
          address: string | null
          ai: string | null
          article: string | null
          email: string | null
          id: string
          name: string
          nif: string | null
          nis: string | null
          phone: string | null
          rc: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          ai?: string | null
          article?: string | null
          email?: string | null
          id?: string
          name?: string
          nif?: string | null
          nis?: string | null
          phone?: string | null
          rc?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          ai?: string | null
          article?: string | null
          email?: string | null
          id?: string
          name?: string
          nif?: string | null
          nis?: string | null
          phone?: string | null
          rc?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          age: number | null
          code: string
          created_at: string
          debt: number
          full_name: string
          id: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          code: string
          created_at?: string
          debt?: number
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          code?: string
          created_at?: string
          debt?: number
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      discounts: {
        Row: {
          amount: number
          client_id: string | null
          client_name: string
          created_at: string
          id: string
          invoice_id: string | null
          invoice_number: string | null
          reason: string | null
        }
        Insert: {
          amount: number
          client_id?: string | null
          client_name: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          reason?: string | null
        }
        Update: {
          amount?: number
          client_id?: string | null
          client_name?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          occurred_at: string
          reason: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_at?: string
          reason: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_at?: string
          reason?: string
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          active: boolean
          caption: string | null
          created_at: string
          id: string
          image_url: string
          position: number
        }
        Insert: {
          active?: boolean
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          position?: number
        }
        Update: {
          active?: boolean
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          position?: number
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          quantity: number
          service_name: string
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          invoice_id: string
          quantity?: number
          service_name: string
          total: number
          unit_price: number
        }
        Update: {
          id?: string
          invoice_id?: string
          quantity?: number
          service_name?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          appointment_id: string | null
          client_id: string
          discount: number
          id: string
          issued_at: string
          notes: string | null
          number: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          subtotal: number
          total: number
        }
        Insert: {
          amount_paid?: number
          appointment_id?: string | null
          client_id: string
          discount?: number
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          subtotal?: number
          total?: number
        }
        Update: {
          amount_paid?: number
          appointment_id?: string | null
          client_id?: string
          discount?: number
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          active: boolean
          available_dates: string[]
          created_at: string
          description: string | null
          ends_at: string
          id: string
          image_url: string | null
          offer_price: number
          original_price: number | null
          starts_at: string
          title: string
        }
        Insert: {
          active?: boolean
          available_dates?: string[]
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          image_url?: string | null
          offer_price: number
          original_price?: number | null
          starts_at?: string
          title: string
        }
        Update: {
          active?: boolean
          available_dates?: string[]
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          image_url?: string | null
          offer_price?: number
          original_price?: number | null
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          occurred_at: string
          reason: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          occurred_at?: string
          reason: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          occurred_at?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          available_days: number[]
          capacity: number
          created_at: string
          description: string | null
          duration_min: number
          id: string
          name: string
          name_en: string | null
          name_fr: string | null
          price_dzd: number
        }
        Insert: {
          active?: boolean
          available_days?: number[]
          capacity?: number
          created_at?: string
          description?: string | null
          duration_min: number
          id?: string
          name: string
          name_en?: string | null
          name_fr?: string | null
          price_dzd: number
        }
        Update: {
          active?: boolean
          available_days?: number[]
          capacity?: number
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          name_en?: string | null
          name_fr?: string | null
          price_dzd?: number
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          created_at: string
          id: string
          scope: Database["public"]["Enums"]["permission_scope"]
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          created_at?: string
          id?: string
          scope: Database["public"]["Enums"]["permission_scope"]
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          created_at?: string
          id?: string
          scope?: Database["public"]["Enums"]["permission_scope"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          end_time: string
          id: string
          label: string | null
          position: number
          start_time: string
        }
        Insert: {
          end_time: string
          id?: string
          label?: string | null
          position?: number
          start_time: string
        }
        Update: {
          end_time?: string
          id?: string
          label?: string | null
          position?: number
          start_time?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_client_code: { Args: never; Returns: string }
      has_permission: {
        Args: {
          _action: Database["public"]["Enums"]["permission_action"]
          _scope: Database["public"]["Enums"]["permission_scope"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "secretary"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "postponed"
      payment_type: "full" | "partial"
      permission_action: "view" | "edit" | "delete"
      permission_scope:
        | "appointments"
        | "clients"
        | "services"
        | "invoices"
        | "finance"
        | "discounts"
        | "offers"
        | "gallery"
        | "staff"
        | "activity"
        | "settings"
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
      app_role: ["admin", "secretary"],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "postponed",
      ],
      payment_type: ["full", "partial"],
      permission_action: ["view", "edit", "delete"],
      permission_scope: [
        "appointments",
        "clients",
        "services",
        "invoices",
        "finance",
        "discounts",
        "offers",
        "gallery",
        "staff",
        "activity",
        "settings",
      ],
    },
  },
} as const
