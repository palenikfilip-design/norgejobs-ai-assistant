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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      archiles_autonomy: {
        Row: {
          auto_delete_dead: boolean
          auto_publish_threshold: number
          auto_recategorize: boolean
          auto_source_add: boolean
          autonomy_level: number
          id: number
          updated_at: string
        }
        Insert: {
          auto_delete_dead?: boolean
          auto_publish_threshold?: number
          auto_recategorize?: boolean
          auto_source_add?: boolean
          autonomy_level?: number
          id?: number
          updated_at?: string
        }
        Update: {
          auto_delete_dead?: boolean
          auto_publish_threshold?: number
          auto_recategorize?: boolean
          auto_source_add?: boolean
          autonomy_level?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      archiles_decisions: {
        Row: {
          admin_choice: Json | null
          admin_id: string | null
          archiles_choice: Json
          confidence: number
          created_at: string
          decision_type: string
          id: string
          job_id: string | null
          resolved_at: string | null
        }
        Insert: {
          admin_choice?: Json | null
          admin_id?: string | null
          archiles_choice: Json
          confidence: number
          created_at?: string
          decision_type: string
          id?: string
          job_id?: string | null
          resolved_at?: string | null
        }
        Update: {
          admin_choice?: Json | null
          admin_id?: string | null
          archiles_choice?: Json
          confidence?: number
          created_at?: string
          decision_type?: string
          id?: string
          job_id?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archiles_decisions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cached_matches: {
        Row: {
          category: string | null
          company_signal: string | null
          created_at: string
          id: string
          is_active: boolean
          is_seasonal: boolean | null
          job_country: string | null
          job_location: string | null
          job_salary: string | null
          job_title: string
          job_url: string
          preset_id: string | null
          reasons: Json
          score: number
          score_dimensions: Json
          scored_at: string
          source_portal: string | null
          user_id: string
          warnings: Json
        }
        Insert: {
          category?: string | null
          company_signal?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_seasonal?: boolean | null
          job_country?: string | null
          job_location?: string | null
          job_salary?: string | null
          job_title?: string
          job_url: string
          preset_id?: string | null
          reasons?: Json
          score?: number
          score_dimensions?: Json
          scored_at?: string
          source_portal?: string | null
          user_id: string
          warnings?: Json
        }
        Update: {
          category?: string | null
          company_signal?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_seasonal?: boolean | null
          job_country?: string | null
          job_location?: string | null
          job_salary?: string | null
          job_title?: string
          job_url?: string
          preset_id?: string | null
          reasons?: Json
          score?: number
          score_dimensions?: Json
          scored_at?: string
          source_portal?: string | null
          user_id?: string
          warnings?: Json
        }
        Relationships: []
      }
      chat_extractions: {
        Row: {
          confidence: string
          created_at: string
          extracted_data: Json
          id: string
          raw_message: string
          routed_to: string
          user_id: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          extracted_data?: Json
          id?: string
          raw_message?: string
          routed_to?: string
          user_id: string
        }
        Update: {
          confidence?: string
          created_at?: string
          extracted_data?: Json
          id?: string
          raw_message?: string
          routed_to?: string
          user_id?: string
        }
        Relationships: []
      }
      country_context: {
        Row: {
          avg_salary_eur: number
          continent: string
          cost_of_living_index: number
          country_code: string
          country_name: string
          expat_friendliness: number
          languages_spoken: Json
          region: string
          updated_at: string
          work_visa_difficulty: string
        }
        Insert: {
          avg_salary_eur: number
          continent: string
          cost_of_living_index: number
          country_code: string
          country_name: string
          expat_friendliness: number
          languages_spoken?: Json
          region: string
          updated_at?: string
          work_visa_difficulty: string
        }
        Update: {
          avg_salary_eur?: number
          continent?: string
          cost_of_living_index?: number
          country_code?: string
          country_name?: string
          expat_friendliness?: number
          languages_spoken?: Json
          region?: string
          updated_at?: string
          work_visa_difficulty?: string
        }
        Relationships: []
      }
      employer_sources: {
        Row: {
          ats_config: Json
          ats_type: string
          company_name: string
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          sector: string | null
          updated_at: string
        }
        Insert: {
          ats_config?: Json
          ats_type: string
          company_name: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          sector?: string | null
          updated_at?: string
        }
        Update: {
          ats_config?: Json
          ats_type?: string
          company_name?: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          sector?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ingest_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          jobs_added: number | null
          jobs_skipped: number | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          jobs_added?: number | null
          jobs_skipped?: number | null
          source: string
          status: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          jobs_added?: number | null
          jobs_skipped?: number | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      ingest_state: {
        Row: {
          last_run_at: string
          source: string
          updated_at: string
        }
        Insert: {
          last_run_at?: string
          source: string
          updated_at?: string
        }
        Update: {
          last_run_at?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_matches: {
        Row: {
          clicked_at: string | null
          created_at: string
          id: string
          location: string | null
          score: number
          source_portal: string
          source_url: string
          title: string | null
          user_id: string
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          id?: string
          location?: string | null
          score: number
          source_portal: string
          source_url: string
          title?: string | null
          user_id: string
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          id?: string
          location?: string | null
          score?: number
          source_portal?: string
          source_url?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      job_portals_catalog: {
        Row: {
          api_info: string | null
          avg_salary: string | null
          category: string
          country: string | null
          created_at: string
          housing_included: string | null
          id: string
          is_active: boolean
          job_categories: string | null
          languages: string | null
          name: string
          notes: string | null
          portal_type: string | null
          priority: number | null
          recommended_approach: string | null
          scraping_terms: string | null
          updated_at: string
          url: string
        }
        Insert: {
          api_info?: string | null
          avg_salary?: string | null
          category?: string
          country?: string | null
          created_at?: string
          housing_included?: string | null
          id?: string
          is_active?: boolean
          job_categories?: string | null
          languages?: string | null
          name: string
          notes?: string | null
          portal_type?: string | null
          priority?: number | null
          recommended_approach?: string | null
          scraping_terms?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          api_info?: string | null
          avg_salary?: string | null
          category?: string
          country?: string | null
          created_at?: string
          housing_included?: string | null
          id?: string
          is_active?: boolean
          job_categories?: string | null
          languages?: string | null
          name?: string
          notes?: string | null
          portal_type?: string | null
          priority?: number | null
          recommended_approach?: string | null
          scraping_terms?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      job_preferences: {
        Row: {
          category: string
          created_at: string
          id: string
          job_id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_snapshots: {
        Row: {
          company: string | null
          country: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          is_original_available: boolean | null
          job_type: string | null
          location: string | null
          original_job_id: string
          raw_data: Json | null
          salary_max: number | null
          salary_min: number | null
          source: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_original_available?: boolean | null
          job_type?: string | null
          location?: string | null
          original_job_id: string
          raw_data?: Json | null
          salary_max?: number | null
          salary_min?: number | null
          source?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_original_available?: boolean | null
          job_type?: string | null
          location?: string | null
          original_job_id?: string
          raw_data?: Json | null
          salary_max?: number | null
          salary_min?: number | null
          source?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      job_sources: {
        Row: {
          config: Json
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          jobs_added_total: number
          last_error: string | null
          last_run_at: string | null
          last_run_status: string | null
          name: string
          sector: string | null
          source_type: string
          tier: number
          updated_at: string
        }
        Insert: {
          config?: Json
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          jobs_added_total?: number
          last_error?: string | null
          last_run_at?: string | null
          last_run_status?: string | null
          name: string
          sector?: string | null
          source_type: string
          tier?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          jobs_added_total?: number
          last_error?: string | null
          last_run_at?: string | null
          last_run_status?: string | null
          name?: string
          sector?: string | null
          source_type?: string
          tier?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          avatar_json: Json
          certifications: Json
          country: string
          country_of_origin: string | null
          created_at: string
          cultural_context: Json
          current_residence: string | null
          date_of_birth: string | null
          dimensions: Json
          experience_level: string
          full_name: string
          gender: string | null
          has_completed_onboarding: boolean
          id: string
          languages: Json
          needs_rescore: boolean
          personality: string | null
          preferences_updated_at: string | null
          profession: string
          professions: Json
          residence_since: string | null
          skills: Json
          updated_at: string
          user_id: string
          work_experience: string
        }
        Insert: {
          age?: number | null
          avatar_json?: Json
          certifications?: Json
          country?: string
          country_of_origin?: string | null
          created_at?: string
          cultural_context?: Json
          current_residence?: string | null
          date_of_birth?: string | null
          dimensions?: Json
          experience_level?: string
          full_name?: string
          gender?: string | null
          has_completed_onboarding?: boolean
          id?: string
          languages?: Json
          needs_rescore?: boolean
          personality?: string | null
          preferences_updated_at?: string | null
          profession?: string
          professions?: Json
          residence_since?: string | null
          skills?: Json
          updated_at?: string
          user_id: string
          work_experience?: string
        }
        Update: {
          age?: number | null
          avatar_json?: Json
          certifications?: Json
          country?: string
          country_of_origin?: string | null
          created_at?: string
          cultural_context?: Json
          current_residence?: string | null
          date_of_birth?: string | null
          dimensions?: Json
          experience_level?: string
          full_name?: string
          gender?: string | null
          has_completed_onboarding?: boolean
          id?: string
          languages?: Json
          needs_rescore?: boolean
          personality?: string | null
          preferences_updated_at?: string | null
          profession?: string
          professions?: Json
          residence_since?: string | null
          skills?: Json
          updated_at?: string
          user_id?: string
          work_experience?: string
        }
        Relationships: []
      }
      public_jobs: {
        Row: {
          additional_locations: Json
          archiles_confidence: number
          archiles_notes: string | null
          category: string | null
          company: string | null
          country: string | null
          created_at: string
          currency: string | null
          data_completeness: string
          description: string | null
          enriched_at: string | null
          expat_openness: string
          external_id: string | null
          fetched_at: string
          id: string
          is_seasonal: boolean | null
          job_type: string | null
          language_requirements: Json
          location: string | null
          needs_review: boolean
          posted_at: string | null
          raw_data: Json | null
          region: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          salary: string | null
          salary_max: number | null
          salary_min: number | null
          salary_normalized_eur: number | null
          skill_level: string
          source_id: string | null
          source_portal: string
          title: string
          trust_score: number
          trust_signals: Json
          updated_at: string
          url: string
        }
        Insert: {
          additional_locations?: Json
          archiles_confidence?: number
          archiles_notes?: string | null
          category?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          data_completeness?: string
          description?: string | null
          enriched_at?: string | null
          expat_openness?: string
          external_id?: string | null
          fetched_at?: string
          id?: string
          is_seasonal?: boolean | null
          job_type?: string | null
          language_requirements?: Json
          location?: string | null
          needs_review?: boolean
          posted_at?: string | null
          raw_data?: Json | null
          region?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_normalized_eur?: number | null
          skill_level?: string
          source_id?: string | null
          source_portal: string
          title: string
          trust_score?: number
          trust_signals?: Json
          updated_at?: string
          url: string
        }
        Update: {
          additional_locations?: Json
          archiles_confidence?: number
          archiles_notes?: string | null
          category?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          data_completeness?: string
          description?: string | null
          enriched_at?: string | null
          expat_openness?: string
          external_id?: string | null
          fetched_at?: string
          id?: string
          is_seasonal?: boolean | null
          job_type?: string | null
          language_requirements?: Json
          location?: string | null
          needs_review?: boolean
          posted_at?: string | null
          raw_data?: Json | null
          region?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_normalized_eur?: number | null
          skill_level?: string
          source_id?: string | null
          source_portal?: string
          title?: string
          trust_score?: number
          trust_signals?: Json
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_access: {
        Row: {
          cover_letter_month_reset: string
          cover_letters_used_this_month: number
          created_at: string
          daily_view_limit: number
          free_unlocks_available: number
          free_unlocks_used: number
          id: string
          is_premium: boolean
          jobs_viewed_today: number
          last_reset_date: string
          premium_since: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_letter_month_reset?: string
          cover_letters_used_this_month?: number
          created_at?: string
          daily_view_limit?: number
          free_unlocks_available?: number
          free_unlocks_used?: number
          id?: string
          is_premium?: boolean
          jobs_viewed_today?: number
          last_reset_date?: string
          premium_since?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_letter_month_reset?: string
          cover_letters_used_this_month?: number
          created_at?: string
          daily_view_limit?: number
          free_unlocks_available?: number
          free_unlocks_used?: number
          id?: string
          is_premium?: boolean
          jobs_viewed_today?: number
          last_reset_date?: string
          premium_since?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_job_interactions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          job_id: string
          metadata: Json | null
          time_spent: number | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          job_id: string
          metadata?: Json | null
          time_spent?: number | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          job_id?: string
          metadata?: Json | null
          time_spent?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_preference_profile: {
        Row: {
          conflicts: Json | null
          created_at: string
          environment_confidence: number | null
          isolation_confidence: number | null
          isolation_preference: number | null
          job_type_confidence: number | null
          last_computed_at: string | null
          patterns: Json | null
          preferred_environment: string | null
          preferred_job_type: string | null
          preferred_salary_max: number | null
          preferred_salary_min: number | null
          preferred_shift_type: string | null
          salary_confidence: number | null
          shift_confidence: number | null
          stress_confidence: number | null
          stress_tolerance: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conflicts?: Json | null
          created_at?: string
          environment_confidence?: number | null
          isolation_confidence?: number | null
          isolation_preference?: number | null
          job_type_confidence?: number | null
          last_computed_at?: string | null
          patterns?: Json | null
          preferred_environment?: string | null
          preferred_job_type?: string | null
          preferred_salary_max?: number | null
          preferred_salary_min?: number | null
          preferred_shift_type?: string | null
          salary_confidence?: number | null
          shift_confidence?: number | null
          stress_confidence?: number | null
          stress_tolerance?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conflicts?: Json | null
          created_at?: string
          environment_confidence?: number | null
          isolation_confidence?: number | null
          isolation_preference?: number | null
          job_type_confidence?: number | null
          last_computed_at?: string | null
          patterns?: Json | null
          preferred_environment?: string | null
          preferred_job_type?: string | null
          preferred_salary_max?: number | null
          preferred_salary_min?: number | null
          preferred_shift_type?: string | null
          salary_confidence?: number | null
          shift_confidence?: number | null
          stress_confidence?: number | null
          stress_tolerance?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presets: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          desired_bonuses: Json
          duration_preference: string | null
          housing_preference: boolean
          id: string
          language_requirements: Json
          last_used_at: string | null
          learning_data: Json
          match_weights: Json
          name: string
          preferred_countries: Json
          preferred_job_type: string
          salary_max: number
          salary_min: number
          seasonal_preference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          desired_bonuses?: Json
          duration_preference?: string | null
          housing_preference?: boolean
          id?: string
          language_requirements?: Json
          last_used_at?: string | null
          learning_data?: Json
          match_weights?: Json
          name?: string
          preferred_countries?: Json
          preferred_job_type?: string
          salary_max?: number
          salary_min?: number
          seasonal_preference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          desired_bonuses?: Json
          duration_preference?: string | null
          housing_preference?: boolean
          id?: string
          language_requirements?: Json
          last_used_at?: string | null
          learning_data?: Json
          match_weights?: Json
          name?: string
          preferred_countries?: Json
          preferred_job_type?: string
          salary_max?: number
          salary_min?: number
          seasonal_preference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      compute_cultural_context: {
        Args: { origin: string; residence: string; since: string }
        Returns: Json
      }
      get_public_jobs_count: { Args: never; Returns: number }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_ingest_cron_secret: { Args: { _value: string }; Returns: undefined }
      verify_ingest_cron_secret: {
        Args: { _provided: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
