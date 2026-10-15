export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      game_sessions: {
        Row: {
          client_info: Json | null
          duration_ms: number | null
          flags: string[] | null
          game_id: string
          id: string
          points_awarded: number | null
          raw_result: Json | null
          score: number | null
          seed: string
          started_at: string
          status: string
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          client_info?: Json | null
          duration_ms?: number | null
          flags?: string[] | null
          game_id: string
          id?: string
          points_awarded?: number | null
          raw_result?: Json | null
          score?: number | null
          seed: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          client_info?: Json | null
          duration_ms?: number | null
          flags?: string[] | null
          game_id?: string
          id?: string
          points_awarded?: number | null
          raw_result?: Json | null
          score?: number | null
          seed?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          active: boolean
          created_at: string | null
          daily_scored_limit: number
          id: string
          max_points: number
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          daily_scored_limit?: number
          id?: string
          max_points?: number
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          daily_scored_limit?: number
          id?: string
          max_points?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      mailbox_registry: {
        Row: {
          created_at: string | null
          normalized_email: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          normalized_email: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          normalized_email?: string
          user_id?: string
        }
        Relationships: []
      }
      profanity_blocklist: {
        Row: {
          term: string
        }
        Insert: {
          term: string
        }
        Update: {
          term?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          onboarded_at: string | null
          points: number
          university_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id: string
          onboarded_at?: string | null
          points?: number
          university_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          onboarded_at?: string | null
          points?: number
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string | null
          expo_token: string
          id: string
          platform: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expo_token: string
          id?: string
          platform?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expo_token?: string
          id?: string
          platform?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reset_state: {
        Row: {
          id: boolean
          last_monthly_reset: string
          last_weekly_reset: string
        }
        Insert: {
          id?: boolean
          last_monthly_reset?: string
          last_weekly_reset?: string
        }
        Update: {
          id?: boolean
          last_monthly_reset?: string
          last_weekly_reset?: string
        }
        Relationships: []
      }
      trivia_questions: {
        Row: {
          category: string | null
          choices: Json
          correct_index: number
          difficulty: number | null
          id: string
          question: string
        }
        Insert: {
          category?: string | null
          choices: Json
          correct_index: number
          difficulty?: number | null
          id?: string
          question: string
        }
        Update: {
          category?: string | null
          choices?: Json
          correct_index?: number
          difficulty?: number | null
          id?: string
          question?: string
        }
        Relationships: []
      }
      universities: {
        Row: {
          country: string | null
          created_at: string | null
          email_domains: string[]
          id: string
          name: string
          scorecard_unit_id: number | null
          short_name: string | null
          state: string | null
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          email_domains?: string[]
          id?: string
          name: string
          scorecard_unit_id?: number | null
          short_name?: string | null
          state?: string | null
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          email_domains?: string[]
          id?: string
          name?: string
          scorecard_unit_id?: number | null
          short_name?: string | null
          state?: string | null
          website?: string | null
        }
        Relationships: []
      }
      university_points: {
        Row: {
          monthly_points: number
          total_points: number
          university_id: string
          updated_at: string | null
          weekly_points: number
        }
        Insert: {
          monthly_points?: number
          total_points?: number
          university_id: string
          updated_at?: string | null
          weekly_points?: number
        }
        Update: {
          monthly_points?: number
          total_points?: number
          university_id?: string
          updated_at?: string | null
          weekly_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "university_points_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      wordle_daily: {
        Row: {
          answer: string
          puzzle_date: string
        }
        Insert: {
          answer: string
          puzzle_date: string
        }
        Update: {
          answer?: string
          puzzle_date?: string
        }
        Relationships: []
      }
      wordle_words: {
        Row: {
          is_answer: boolean
          word: string
        }
        Insert: {
          is_answer?: boolean
          word: string
        }
        Update: {
          is_answer?: boolean
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      before_user_created_hook: { Args: { event: Json }; Returns: Json }
      complete_onboarding: {
        Args: { p_display_name: string }
        Returns: undefined
      }
      email_domain_matches: {
        Args: { p_domains: string[]; p_email: string }
        Returns: boolean
      }
      email_domains_valid: { Args: { p_domains: string[] }; Returns: boolean }
      ensure_wordle_daily: { Args: { p_date: string }; Returns: string }
      finalize_game_session: {
        Args: {
          p_duration_ms: number
          p_flags?: string[]
          p_points: number
          p_result: Json
          p_score: number
          p_session_id: string
        }
        Returns: {
          university_total: number
          user_points: number
        }[]
      }
      normalize_mailbox: { Args: { p_email: string }; Returns: string }
      ny_date: { Args: { p_ts?: string }; Returns: string }
      register_push_token: {
        Args: { p_expo_token: string; p_platform: string }
        Returns: {
          created_at: string | null
          expo_token: string
          id: string
          platform: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "push_tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_periodic_points: { Args: { p_now?: string }; Returns: undefined }
      signup_school_error: {
        Args: { p_email: string; p_university_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

