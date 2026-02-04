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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_payment_box_settings: {
        Row: {
          content: string | null
          created_at: string
          has_fee: boolean | null
          id: string
          image_url: string | null
          transaction_fee: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          has_fee?: boolean | null
          id?: string
          image_url?: string | null
          transaction_fee?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          has_fee?: boolean | null
          id?: string
          image_url?: string | null
          transaction_fee?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      banned_ips: {
        Row: {
          banned_by: string | null
          created_at: string | null
          id: string
          ip_address: string
          reason: string | null
        }
        Insert: {
          banned_by?: string | null
          created_at?: string | null
          id?: string
          ip_address: string
          reason?: string | null
        }
        Update: {
          banned_by?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string
          reason?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_disable_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          receiver_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string | null
          id: string
          requester_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          addressee_id: string
          created_at?: string | null
          id?: string
          requester_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          addressee_id?: string
          created_at?: string | null
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deletion_settings: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          is_disabled: boolean
          requested_at: string | null
          requested_by: string | null
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          is_disabled?: boolean
          requested_at?: string | null
          requested_by?: string | null
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          is_disabled?: boolean
          requested_at?: string | null
          requested_by?: string | null
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          image_url: string | null
          is_read: boolean | null
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_boxes: {
        Row: {
          admin_confirmed_at: string | null
          admin_message: string | null
          admin_message_at: string | null
          bill_image_url: string | null
          buyer_bank_account: string | null
          buyer_bank_name: string | null
          buyer_confirmed_at: string | null
          buyer_reply: string | null
          buyer_reply_at: string | null
          confirmed_at: string | null
          content: string | null
          created_at: string
          has_fee: boolean | null
          id: string
          image_url: string | null
          payment_duration: string | null
          payment_duration_days: number | null
          receiver_id: string
          refund_approved_at: string | null
          refund_reason: string | null
          refund_requested_at: string | null
          seller_bank_account: string | null
          seller_bank_name: string | null
          seller_cancelled_at: string | null
          seller_completed_at: string | null
          seller_confirmed_at: string | null
          seller_rejection_reason: string | null
          sender_id: string
          sender_role: string | null
          status: string
          transaction_fee: string | null
          transaction_start_at: string | null
        }
        Insert: {
          admin_confirmed_at?: string | null
          admin_message?: string | null
          admin_message_at?: string | null
          bill_image_url?: string | null
          buyer_bank_account?: string | null
          buyer_bank_name?: string | null
          buyer_confirmed_at?: string | null
          buyer_reply?: string | null
          buyer_reply_at?: string | null
          confirmed_at?: string | null
          content?: string | null
          created_at?: string
          has_fee?: boolean | null
          id?: string
          image_url?: string | null
          payment_duration?: string | null
          payment_duration_days?: number | null
          receiver_id: string
          refund_approved_at?: string | null
          refund_reason?: string | null
          refund_requested_at?: string | null
          seller_bank_account?: string | null
          seller_bank_name?: string | null
          seller_cancelled_at?: string | null
          seller_completed_at?: string | null
          seller_confirmed_at?: string | null
          seller_rejection_reason?: string | null
          sender_id: string
          sender_role?: string | null
          status?: string
          transaction_fee?: string | null
          transaction_start_at?: string | null
        }
        Update: {
          admin_confirmed_at?: string | null
          admin_message?: string | null
          admin_message_at?: string | null
          bill_image_url?: string | null
          buyer_bank_account?: string | null
          buyer_bank_name?: string | null
          buyer_confirmed_at?: string | null
          buyer_reply?: string | null
          buyer_reply_at?: string | null
          confirmed_at?: string | null
          content?: string | null
          created_at?: string
          has_fee?: boolean | null
          id?: string
          image_url?: string | null
          payment_duration?: string | null
          payment_duration_days?: number | null
          receiver_id?: string
          refund_approved_at?: string | null
          refund_reason?: string | null
          refund_requested_at?: string | null
          seller_bank_account?: string | null
          seller_bank_name?: string | null
          seller_cancelled_at?: string | null
          seller_completed_at?: string | null
          seller_confirmed_at?: string | null
          seller_rejection_reason?: string | null
          sender_id?: string
          sender_role?: string | null
          status?: string
          transaction_fee?: string | null
          transaction_start_at?: string | null
        }
        Relationships: []
      }
      post_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          post_id: string
          post_type: string
          reason: string
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          post_id: string
          post_type?: string
          reason: string
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          post_id?: string
          post_type?: string
          reason?: string
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          image_url: string | null
          updated_at: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_banned: boolean | null
          registration_ip: string | null
          updated_at: string | null
          user_id_code: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          is_banned?: boolean | null
          registration_ip?: string | null
          updated_at?: string | null
          user_id_code: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_banned?: boolean | null
          registration_ip?: string | null
          updated_at?: string | null
          user_id_code?: string
          username?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          description: string | null
          evidence_url: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          description?: string | null
          evidence_url?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          description?: string | null
          evidence_url?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transaction_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          image_url: string | null
          is_read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      transaction_posts: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          image_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_banned: boolean | null
          updated_at: string | null
          user_id_code: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_banned?: boolean | null
          updated_at?: string | null
          user_id_code?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_banned?: boolean | null
          updated_at?: string | null
          user_id_code?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_user_id_code: { Args: never; Returns: string }
      get_full_profile: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          bio: string
          cover_url: string
          created_at: string
          display_name: string
          id: string
          is_banned: boolean
          registration_ip: string
          updated_at: string
          user_id_code: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
