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
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          granted_by: string | null
          id: string
          metadata: Json | null
          new_plan: Database["public"]["Enums"]["plan_type"] | null
          old_plan: Database["public"]["Enums"]["plan_type"] | null
          role_assigned: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          granted_by?: string | null
          id?: string
          metadata?: Json | null
          new_plan?: Database["public"]["Enums"]["plan_type"] | null
          old_plan?: Database["public"]["Enums"]["plan_type"] | null
          role_assigned?: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          metadata?: Json | null
          new_plan?: Database["public"]["Enums"]["plan_type"] | null
          old_plan?: Database["public"]["Enums"]["plan_type"] | null
          role_assigned?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          affiliate_code: string
          affiliate_id: string
          created_at: string
          id: string
          ip_address: string | null
          landing_page: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_code: string
          affiliate_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_code?: string
          affiliate_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_code: string
          commission_rate: number
          created_at: string
          id: string
          last_inactivity_notification: string | null
          last_revenue_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["affiliate_status"]
          total_earnings: number
          total_referrals: number
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_code: string
          commission_rate?: number
          created_at?: string
          id?: string
          last_inactivity_notification?: string | null
          last_revenue_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          total_earnings?: number
          total_referrals?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_code?: string
          commission_rate?: number
          created_at?: string
          id?: string
          last_inactivity_notification?: string | null
          last_revenue_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          total_earnings?: number
          total_referrals?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      asset_analyses: {
        Row: {
          asset_id: string
          carteira: Database["public"]["Enums"]["plan_type"]
          created_at: string
          dy2025: number | null
          fator_mc: number | null
          id: string
          nota_especialista: string | null
          perfil_investidor: string | null
          recomendacao: string | null
          resumo: string | null
          roi2023a2025: number | null
          roi2024: number | null
          roi2025: number | null
          roi2026: number | null
          roitrim: number | null
          taxa_semanal: number | null
          tendencia: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          asset_id: string
          carteira: Database["public"]["Enums"]["plan_type"]
          created_at?: string
          dy2025?: number | null
          fator_mc?: number | null
          id?: string
          nota_especialista?: string | null
          perfil_investidor?: string | null
          recomendacao?: string | null
          resumo?: string | null
          roi2023a2025?: number | null
          roi2024?: number | null
          roi2025?: number | null
          roi2026?: number | null
          roitrim?: number | null
          taxa_semanal?: number | null
          tendencia?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          asset_id?: string
          carteira?: Database["public"]["Enums"]["plan_type"]
          created_at?: string
          dy2025?: number | null
          fator_mc?: number | null
          id?: string
          nota_especialista?: string | null
          perfil_investidor?: string | null
          recomendacao?: string | null
          resumo?: string | null
          roi2023a2025?: number | null
          roi2024?: number | null
          roi2025?: number | null
          roi2026?: number | null
          roitrim?: number | null
          taxa_semanal?: number | null
          tendencia?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_analyses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_favorites: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_favorites_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_views: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          user_id: string
          view_date: string | null
          viewed_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          user_id: string
          view_date?: string | null
          viewed_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          user_id?: string
          view_date?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_views_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          codigo_b3: string
          created_at: string
          id: string
          is_active: boolean | null
          nome: string
          setor: string | null
          tipo: Database["public"]["Enums"]["asset_type"]
          updated_at: string
        }
        Insert: {
          codigo_b3: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          nome: string
          setor?: string | null
          tipo: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
        }
        Update: {
          codigo_b3?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          nome?: string
          setor?: string | null
          tipo?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
        }
        Relationships: []
      }
      blog_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string
          author_id: string | null
          blog_author_id: string | null
          content: string
          cover_image: string | null
          created_at: string
          excerpt: string | null
          featured: boolean
          id: string
          og_image: string | null
          published_at: string | null
          scheduled_for: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["blog_status"]
          title: string
          updated_at: string
          views: number | null
        }
        Insert: {
          author: string
          author_id?: string | null
          blog_author_id?: string | null
          content: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          og_image?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["blog_status"]
          title: string
          updated_at?: string
          views?: number | null
        }
        Update: {
          author?: string
          author_id?: string | null
          blog_author_id?: string | null
          content?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          og_image?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_status"]
          title?: string
          updated_at?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_blog_author_id_fkey"
            columns: ["blog_author_id"]
            isOneToOne: false
            referencedRelation: "blog_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_blog_author_id_fkey"
            columns: ["blog_author_id"]
            isOneToOne: false
            referencedRelation: "blog_authors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_feedback: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          referral_id: string | null
          status: Database["public"]["Enums"]["commission_status"]
          stripe_payment_id: string | null
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          referral_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          stripe_payment_id?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          referral_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          stripe_payment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      exclusive_videos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          order_num: number
          title: string
          updated_at: string
          youtube_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_num?: number
          title: string
          updated_at?: string
          youtube_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_num?: number
          title?: string
          updated_at?: string
          youtube_id?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_log: Json | null
          failed: number | null
          filename: string
          id: string
          inserted: number | null
          skipped: number | null
          status: Database["public"]["Enums"]["import_status"]
          type: Database["public"]["Enums"]["import_type"]
          updated: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_log?: Json | null
          failed?: number | null
          filename: string
          id?: string
          inserted?: number | null
          skipped?: number | null
          status?: Database["public"]["Enums"]["import_status"]
          type: Database["public"]["Enums"]["import_type"]
          updated?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_log?: Json | null
          failed?: number | null
          filename?: string
          id?: string
          inserted?: number | null
          skipped?: number | null
          status?: Database["public"]["Enums"]["import_status"]
          type?: Database["public"]["Enums"]["import_type"]
          updated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          affiliate_code: string | null
          converted_at: string | null
          created_at: string
          email: string
          id: string
          landing_page: string
          name: string
          status: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          affiliate_code?: string | null
          converted_at?: string | null
          created_at?: string
          email: string
          id?: string
          landing_page?: string
          name: string
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          affiliate_code?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          landing_page?: string
          name?: string
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      notification_group_members: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "notification_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      post_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_categories_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_answers: {
        Row: {
          created_at: string
          cycle: number
          id: string
          option_id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle?: number
          id?: string
          option_id: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle?: number
          id?: string
          option_id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_answers_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "profile_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "profile_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_options: {
        Row: {
          created_at: string
          id: string
          question_id: string
          text: string
          weight_pro: number
          weight_specialist: number
          weight_start: number
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          text: string
          weight_pro?: number
          weight_specialist?: number
          weight_start?: number
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          text?: string
          weight_pro?: number
          weight_specialist?: number
          weight_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "profile_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_questions: {
        Row: {
          created_at: string
          id: string
          order_num: number
          text: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_num: number
          text: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_num?: number
          text?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          hide_community_message: boolean | null
          id: string
          investor_profile:
            | Database["public"]["Enums"]["investor_profile"]
            | null
          last_reclassification_at: string | null
          name: string | null
          notifications_enabled: boolean | null
          phone: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          plan_end_at: string | null
          plan_start_at: string | null
          sidebar_collapsed: boolean | null
          stripe_customer_id: string | null
          theme_preference: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          hide_community_message?: boolean | null
          id: string
          investor_profile?:
            | Database["public"]["Enums"]["investor_profile"]
            | null
          last_reclassification_at?: string | null
          name?: string | null
          notifications_enabled?: boolean | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_end_at?: string | null
          plan_start_at?: string | null
          sidebar_collapsed?: boolean | null
          stripe_customer_id?: string | null
          theme_preference?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          hide_community_message?: boolean | null
          id?: string
          investor_profile?:
            | Database["public"]["Enums"]["investor_profile"]
            | null
          last_reclassification_at?: string | null
          name?: string | null
          notifications_enabled?: boolean | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_end_at?: string | null
          plan_start_at?: string | null
          sidebar_collapsed?: boolean | null
          stripe_customer_id?: string | null
          theme_preference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_notifications: {
        Row: {
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          message: string
          sent_at: string | null
          sent_count: number | null
          target_audience: string | null
          target_group_id: string | null
          target_plan: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          sent_at?: string | null
          sent_count?: number | null
          target_audience?: string | null
          target_group_id?: string | null
          target_plan?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          sent_at?: string | null
          sent_count?: number | null
          target_audience?: string | null
          target_group_id?: string | null
          target_plan?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_notifications_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "notification_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_id: string | null
          endpoint: string
          id: string
          is_active: boolean | null
          p256dh: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          device_id?: string | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          p256dh: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          device_id?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          p256dh?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number | null
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number | null
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number | null
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          affiliate_id: string
          converted_at: string | null
          created_at: string
          id: string
          referred_user_id: string
          status: string
        }
        Insert: {
          affiliate_id: string
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_user_id: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      smtp_config: {
        Row: {
          created_at: string | null
          id: string
          security_type: string
          sender_email: string
          sender_name: string
          smtp_password: string
          smtp_port: number
          smtp_server: string
          smtp_user: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          security_type?: string
          sender_email: string
          sender_name: string
          smtp_password: string
          smtp_port: number
          smtp_server: string
          smtp_user: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          security_type?: string
          sender_email?: string
          sender_name?: string
          smtp_password?: string
          smtp_port?: number
          smtp_server?: string
          smtp_user?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          features: Json | null
          id: string
          is_active: boolean
          plan_code: string
          price_note: string | null
          price_quarterly: number
          sort_order: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          features?: Json | null
          id?: string
          is_active?: boolean
          plan_code: string
          price_note?: string | null
          price_quarterly?: number
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          plan_code?: string
          price_note?: string | null
          price_quarterly?: number
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          cancellation_requested: boolean | null
          completed_at: string | null
          created_at: string | null
          errors: Json | null
          failed: number | null
          id: string
          inserted: number | null
          metadata: Json | null
          skipped: number | null
          started_at: string
          status: string
          sync_type: string
          total_rows: number | null
          trigger_type: string
          triggered_by: string | null
          updated: number | null
          warnings: Json | null
        }
        Insert: {
          cancellation_requested?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          errors?: Json | null
          failed?: number | null
          id?: string
          inserted?: number | null
          metadata?: Json | null
          skipped?: number | null
          started_at?: string
          status: string
          sync_type: string
          total_rows?: number | null
          trigger_type: string
          triggered_by?: string | null
          updated?: number | null
          warnings?: Json | null
        }
        Update: {
          cancellation_requested?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          errors?: Json | null
          failed?: number | null
          id?: string
          inserted?: number | null
          metadata?: Json | null
          skipped?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          total_rows?: number | null
          trigger_type?: string
          triggered_by?: string | null
          updated?: number | null
          warnings?: Json | null
        }
        Relationships: []
      }
      sync_queue: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          row_data: Json
          row_index: number
          status: string
          sync_log_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          row_data: Json
          row_index: number
          status?: string
          sync_log_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          row_data?: Json
          row_index?: number
          status?: string
          sync_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_queue_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: false
            referencedRelation: "sync_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_name: string
          id: string
          page_url: string | null
          script_id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_name: string
          id?: string
          page_url?: string | null
          script_id: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_name?: string
          id?: string
          page_url?: string | null
          script_id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "tracking_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_scripts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          location: string
          name: string
          script_content: string | null
          script_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location: string
          name: string
          script_content?: string | null
          script_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          script_content?: string | null
          script_id?: string | null
          type?: string
          updated_at?: string
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_items: {
        Row: {
          aporte_adicional: number | null
          asset_id: string | null
          created_at: string
          data_compra: string | null
          id: string
          preco_compra: number
          proventos: number | null
          quantidade: number
          updated_at: string
          wallet_id: string
        }
        Insert: {
          aporte_adicional?: number | null
          asset_id?: string | null
          created_at?: string
          data_compra?: string | null
          id?: string
          preco_compra: number
          proventos?: number | null
          quantidade: number
          updated_at?: string
          wallet_id: string
        }
        Update: {
          aporte_adicional?: number | null
          asset_id?: string | null
          created_at?: string
          data_compra?: string | null
          id?: string
          preco_compra?: number
          proventos?: number | null
          quantidade?: number
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_items_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet_simulator"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_movements: {
        Row: {
          asset_id: string | null
          codigo_b3: string
          created_at: string | null
          data_operacao: string
          id: string
          observacao: string | null
          quantidade: number
          tipo_operacao: Database["public"]["Enums"]["operation_type"]
          user_id: string
          valor_por_acao: number
        }
        Insert: {
          asset_id?: string | null
          codigo_b3: string
          created_at?: string | null
          data_operacao?: string
          id?: string
          observacao?: string | null
          quantidade: number
          tipo_operacao: Database["public"]["Enums"]["operation_type"]
          user_id: string
          valor_por_acao: number
        }
        Update: {
          asset_id?: string | null
          codigo_b3?: string
          created_at?: string | null
          data_operacao?: string
          id?: string
          observacao?: string | null
          quantidade?: number
          tipo_operacao?: Database["public"]["Enums"]["operation_type"]
          user_id?: string
          valor_por_acao?: number
        }
        Relationships: [
          {
            foreignKeyName: "wallet_movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_simulator: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      blog_authors_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_orphaned_syncs: { Args: never; Returns: undefined }
      create_affiliate: {
        Args: {
          custom_code?: string
          custom_rate?: number
          target_user_id: string
        }
        Returns: string
      }
      create_asset_type_if_not_exists: {
        Args: { type_name: string }
        Returns: boolean
      }
      generate_affiliate_code: { Args: never; Returns: string }
      generate_seo_keywords: {
        Args: { content: string; title: string }
        Returns: string[]
      }
      get_all_table_names: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      request_affiliate_activation: { Args: never; Returns: string }
      trigger_process_sync_queue: { Args: never; Returns: undefined }
    }
    Enums: {
      affiliate_status: "pending" | "active" | "suspended" | "inactive"
      app_role: "user" | "admin" | "editor" | "moderator"
      asset_type: "FII" | "ACAO" | "BDR" | "CRIPTO" | "ETF" | "INDICE" | "RFIXA"
      blog_status: "draft" | "published" | "scheduled"
      commission_status: "pending" | "approved" | "paid" | "cancelled"
      import_status: "PENDING" | "PROCESSING" | "DONE" | "FAILED"
      import_type: "FREE" | "PREMIUM"
      investor_profile: "START" | "PRO" | "SPECIALIST"
      operation_type:
        | "COMPRA"
        | "VENDA"
        | "GANHOS_JCP"
        | "GANHOS_RC"
        | "GANHOS_DY"
        | "GANHOS_BA"
      plan_type:
        | "FREE"
        | "START"
        | "PRO"
        | "SPECIALIST"
        | "FALE_C_ESPECIALISTA"
        | "TESTE"
      recommendation:
        | "COMPRA (DY)"
        | "COMPRA (RA)"
        | "COMPRA (RB)"
        | "COMPRA (RM)"
        | "Ñ COMPRA (ATF)"
        | "NEUTRA (AF)"
        | "NEUTRA (TF)"
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
      affiliate_status: ["pending", "active", "suspended", "inactive"],
      app_role: ["user", "admin", "editor", "moderator"],
      asset_type: ["FII", "ACAO", "BDR", "CRIPTO", "ETF", "INDICE", "RFIXA"],
      blog_status: ["draft", "published", "scheduled"],
      commission_status: ["pending", "approved", "paid", "cancelled"],
      import_status: ["PENDING", "PROCESSING", "DONE", "FAILED"],
      import_type: ["FREE", "PREMIUM"],
      investor_profile: ["START", "PRO", "SPECIALIST"],
      operation_type: [
        "COMPRA",
        "VENDA",
        "GANHOS_JCP",
        "GANHOS_RC",
        "GANHOS_DY",
        "GANHOS_BA",
      ],
      plan_type: [
        "FREE",
        "START",
        "PRO",
        "SPECIALIST",
        "FALE_C_ESPECIALISTA",
        "TESTE",
      ],
      recommendation: [
        "COMPRA (DY)",
        "COMPRA (RA)",
        "COMPRA (RB)",
        "COMPRA (RM)",
        "Ñ COMPRA (ATF)",
        "NEUTRA (AF)",
        "NEUTRA (TF)",
      ],
    },
  },
} as const
