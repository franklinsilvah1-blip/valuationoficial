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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string | null
          created_at: string | null
          granted_by: string | null
          id: string | null
          metadata: Json | null
          new_plan: string | null
          old_plan: string | null
          role_assigned: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          granted_by?: string | null
          id?: string | null
          metadata?: Json | null
          new_plan?: string | null
          old_plan?: string | null
          role_assigned?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          granted_by?: string | null
          id?: string | null
          metadata?: Json | null
          new_plan?: string | null
          old_plan?: string | null
          role_assigned?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          affiliate_code: string | null
          affiliate_id: string | null
          created_at: string | null
          id: string | null
          ip_address: string | null
          landing_page: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_code?: string | null
          affiliate_id?: string | null
          created_at?: string | null
          id?: string | null
          ip_address?: string | null
          landing_page?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_code?: string | null
          affiliate_id?: string | null
          created_at?: string | null
          id?: string | null
          ip_address?: string | null
          landing_page?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          affiliate_code: string | null
          commission_rate: number | null
          created_at: string | null
          id: string
          last_inactivity_notification: string | null
          last_revenue_at: string | null
          rejection_reason: string | null
          status: string | null
          total_earnings: number | null
          total_referrals: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          affiliate_code?: string | null
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          last_inactivity_notification?: string | null
          last_revenue_at?: string | null
          rejection_reason?: string | null
          status?: string | null
          total_earnings?: number | null
          total_referrals?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          affiliate_code?: string | null
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          last_inactivity_notification?: string | null
          last_revenue_at?: string | null
          rejection_reason?: string | null
          status?: string | null
          total_earnings?: number | null
          total_referrals?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          created_at: string | null
          id: string | null
          key: string | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          key?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          key?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      asset_analyses: {
        Row: {
          analysis_data: string | null
          asset_id: string | null
          carteira: string | null
          comentario_especialista: string | null
          created_at: string | null
          data_atualizacao: string | null
          dividendo_esperado: string | null
          dy2023: string | null
          dy2024: string | null
          dy2025: string | null
          fator_mc: string | null
          id: string | null
          margem_seguranca: string | null
          nota_crescimento: string | null
          nota_dividendos: string | null
          nota_especialista: string | null
          nota_seguranca: string | null
          nota_valuation: string | null
          p_l: string | null
          p_vp: string | null
          perfil_investidor: string | null
          plano_type: string | null
          preco_justo: string | null
          preco_teto: string | null
          recomendacao: string | null
          recommendation: string | null
          resumo: string | null
          roe: string | null
          roi2023a2025: string | null
          roi2024: string | null
          roi2025: string | null
          roi2026: string | null
          roitrim: string | null
          site_id: string | null
          status_analise: string | null
          taxa_anual: string | null
          taxa_mensal: string | null
          taxa_semanal: string | null
          tendencia: string | null
          updated_at: string | null
          upside: string | null
          valor: string | null
        }
        Insert: {
          analysis_data?: string | null
          asset_id?: string | null
          carteira?: string | null
          comentario_especialista?: string | null
          created_at?: string | null
          data_atualizacao?: string | null
          dividendo_esperado?: string | null
          dy2023?: string | null
          dy2024?: string | null
          dy2025?: string | null
          fator_mc?: string | null
          id?: string | null
          margem_seguranca?: string | null
          nota_crescimento?: string | null
          nota_dividendos?: string | null
          nota_especialista?: string | null
          nota_seguranca?: string | null
          nota_valuation?: string | null
          p_l?: string | null
          p_vp?: string | null
          perfil_investidor?: string | null
          plano_type?: string | null
          preco_justo?: string | null
          preco_teto?: string | null
          recomendacao?: string | null
          recommendation?: string | null
          resumo?: string | null
          roe?: string | null
          roi2023a2025?: string | null
          roi2024?: string | null
          roi2025?: string | null
          roi2026?: string | null
          roitrim?: string | null
          site_id?: string | null
          status_analise?: string | null
          taxa_anual?: string | null
          taxa_mensal?: string | null
          taxa_semanal?: string | null
          tendencia?: string | null
          updated_at?: string | null
          upside?: string | null
          valor?: string | null
        }
        Update: {
          analysis_data?: string | null
          asset_id?: string | null
          carteira?: string | null
          comentario_especialista?: string | null
          created_at?: string | null
          data_atualizacao?: string | null
          dividendo_esperado?: string | null
          dy2023?: string | null
          dy2024?: string | null
          dy2025?: string | null
          fator_mc?: string | null
          id?: string | null
          margem_seguranca?: string | null
          nota_crescimento?: string | null
          nota_dividendos?: string | null
          nota_especialista?: string | null
          nota_seguranca?: string | null
          nota_valuation?: string | null
          p_l?: string | null
          p_vp?: string | null
          perfil_investidor?: string | null
          plano_type?: string | null
          preco_justo?: string | null
          preco_teto?: string | null
          recomendacao?: string | null
          recommendation?: string | null
          resumo?: string | null
          roe?: string | null
          roi2023a2025?: string | null
          roi2024?: string | null
          roi2025?: string | null
          roi2026?: string | null
          roitrim?: string | null
          site_id?: string | null
          status_analise?: string | null
          taxa_anual?: string | null
          taxa_mensal?: string | null
          taxa_semanal?: string | null
          tendencia?: string | null
          updated_at?: string | null
          upside?: string | null
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_analyses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_favorites: {
        Row: {
          asset_id: string | null
          created_at: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          id?: string | null
          user_id?: string | null
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
          asset_id: string | null
          created_at: string | null
          id: string | null
          user_id: string | null
          view_date: string | null
          viewed_at: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          id?: string | null
          user_id?: string | null
          view_date?: string | null
          viewed_at?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          id?: string | null
          user_id?: string | null
          view_date?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_type: string | null
          codigo_b3: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          nome: string | null
          observacoes: string | null
          preco_atual: number | null
          price: number | null
          ranking_setor: number | null
          sector: string | null
          segmento: string | null
          setor: string | null
          setor_atuacao: string | null
          site_id: string | null
          subsetor: string | null
          subsetor_atuacao: string | null
          tag: string | null
          ticker: string | null
          tipo: string | null
          tipo_ativo: string | null
          updated_at: string | null
        }
        Insert: {
          asset_type?: string | null
          codigo_b3?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          nome?: string | null
          observacoes?: string | null
          preco_atual?: number | null
          price?: number | null
          ranking_setor?: number | null
          sector?: string | null
          segmento?: string | null
          setor?: string | null
          setor_atuacao?: string | null
          site_id?: string | null
          subsetor?: string | null
          subsetor_atuacao?: string | null
          tag?: string | null
          ticker?: string | null
          tipo?: string | null
          tipo_ativo?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_type?: string | null
          codigo_b3?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          nome?: string | null
          observacoes?: string | null
          preco_atual?: number | null
          price?: number | null
          ranking_setor?: number | null
          sector?: string | null
          segmento?: string | null
          setor?: string | null
          setor_atuacao?: string | null
          site_id?: string | null
          subsetor?: string | null
          subsetor_atuacao?: string | null
          tag?: string | null
          ticker?: string | null
          tipo?: string | null
          tipo_ativo?: string | null
          updated_at?: string | null
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
          name: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
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
      blog_posts: {
        Row: {
          author: string | null
          author_id: string | null
          blog_author_id: string | null
          content: string | null
          cover_image: string | null
          created_at: string | null
          excerpt: string | null
          featured: boolean | null
          id: string
          og_image: string | null
          published_at: string | null
          scheduled_for: string | null
          seo_description: string | null
          seo_keywords: Json | null
          seo_title: string | null
          slug: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          views: number | null
        }
        Insert: {
          author?: string | null
          author_id?: string | null
          blog_author_id?: string | null
          content?: string | null
          cover_image?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          og_image?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_keywords?: Json | null
          seo_title?: string | null
          slug?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          views?: number | null
        }
        Update: {
          author?: string | null
          author_id?: string | null
          blog_author_id?: string | null
          content?: string | null
          cover_image?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          og_image?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_keywords?: Json | null
          seo_title?: string | null
          slug?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
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
        ]
      }
      cancellation_feedback: {
        Row: {
          created_at: string | null
          details: string | null
          id: string | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          slug: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string | null
          slug?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          affiliate_id: string | null
          amount: number | null
          created_at: string | null
          id: string | null
          paid_at: string | null
          referral_id: string | null
          status: string | null
          stripe_payment_id: string | null
          updated_at: string | null
        }
        Insert: {
          affiliate_id?: string | null
          amount?: number | null
          created_at?: string | null
          id?: string | null
          paid_at?: string | null
          referral_id?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          updated_at?: string | null
        }
        Update: {
          affiliate_id?: string | null
          amount?: number | null
          created_at?: string | null
          id?: string | null
          paid_at?: string | null
          referral_id?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          updated_at?: string | null
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
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          order_num: number | null
          title: string | null
          updated_at: string | null
          youtube_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          order_num?: number | null
          title?: string | null
          updated_at?: string | null
          youtube_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          order_num?: number | null
          title?: string | null
          updated_at?: string | null
          youtube_id?: string | null
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_log: string | null
          failed: number | null
          filename: string | null
          id: string | null
          inserted: number | null
          skipped: number | null
          status: string | null
          type: string | null
          updated: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_log?: string | null
          failed?: number | null
          filename?: string | null
          id?: string | null
          inserted?: number | null
          skipped?: number | null
          status?: string | null
          type?: string | null
          updated?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_log?: string | null
          failed?: number | null
          filename?: string | null
          id?: string | null
          inserted?: number | null
          skipped?: number | null
          status?: string | null
          type?: string | null
          updated?: number | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          affiliate_code: string | null
          converted_at: string | null
          created_at: string | null
          email: string | null
          id: string | null
          landing_page: string | null
          name: string | null
          status: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          affiliate_code?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          landing_page?: string | null
          name?: string | null
          status?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          affiliate_code?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          landing_page?: string | null
          name?: string | null
          status?: string | null
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
          group_id: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          group_id?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      post_categories: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string | null
          post_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string | null
          post_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string | null
          post_id?: string | null
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
          created_at: string | null
          cycle: number | null
          id: string | null
          option_id: string | null
          question_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          cycle?: number | null
          id?: string | null
          option_id?: string | null
          question_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          cycle?: number | null
          id?: string | null
          option_id?: string | null
          question_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profile_options: {
        Row: {
          created_at: string | null
          id: string | null
          question_id: string | null
          text: string | null
          weight_pro: number | null
          weight_specialist: number | null
          weight_start: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          question_id?: string | null
          text?: string | null
          weight_pro?: number | null
          weight_specialist?: number | null
          weight_start?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          question_id?: string | null
          text?: string | null
          weight_pro?: number | null
          weight_specialist?: number | null
          weight_start?: number | null
        }
        Relationships: []
      }
      profile_questions: {
        Row: {
          created_at: string | null
          id: string | null
          order_num: number | null
          text: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          order_num?: number | null
          text?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          order_num?: number | null
          text?: string | null
          type?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          hide_community_message: boolean | null
          id: string
          investor_profile: string | null
          last_reclassification_at: string | null
          name: string | null
          notifications_enabled: boolean | null
          phone: string | null
          plan: string | null
          plan_end_at: string | null
          plan_start_at: string | null
          sidebar_collapsed: boolean | null
          site_id: string | null
          stripe_customer_id: string | null
          theme_preference: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          hide_community_message?: boolean | null
          id?: string
          investor_profile?: string | null
          last_reclassification_at?: string | null
          name?: string | null
          notifications_enabled?: boolean | null
          phone?: string | null
          plan?: string | null
          plan_end_at?: string | null
          plan_start_at?: string | null
          sidebar_collapsed?: boolean | null
          site_id?: string | null
          stripe_customer_id?: string | null
          theme_preference?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          hide_community_message?: boolean | null
          id?: string
          investor_profile?: string | null
          last_reclassification_at?: string | null
          name?: string | null
          notifications_enabled?: boolean | null
          phone?: string | null
          plan?: string | null
          plan_end_at?: string | null
          plan_start_at?: string | null
          sidebar_collapsed?: boolean | null
          site_id?: string | null
          stripe_customer_id?: string | null
          theme_preference?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_notifications: {
        Row: {
          created_at: string | null
          created_by: string | null
          icon: string | null
          id: string | null
          is_active: boolean | null
          message: string | null
          sent_at: string | null
          sent_count: number | null
          target_audience: string | null
          target_group_id: string | null
          target_plan: string | null
          title: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          message?: string | null
          sent_at?: string | null
          sent_count?: number | null
          target_audience?: string | null
          target_group_id?: string | null
          target_plan?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          message?: string | null
          sent_at?: string | null
          sent_count?: number | null
          target_audience?: string | null
          target_group_id?: string | null
          target_plan?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string | null
          device_id: string | null
          endpoint: string | null
          id: string | null
          is_active: boolean | null
          p256dh: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth?: string | null
          created_at?: string | null
          device_id?: string | null
          endpoint?: string | null
          id?: string | null
          is_active?: boolean | null
          p256dh?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string | null
          created_at?: string | null
          device_id?: string | null
          endpoint?: string | null
          id?: string | null
          is_active?: boolean | null
          p256dh?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          created_at: string | null
          endpoint: string | null
          id: string | null
          request_count: number | null
          user_id: string | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint?: string | null
          id?: string | null
          request_count?: number | null
          user_id?: string | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string | null
          id?: string | null
          request_count?: number | null
          user_id?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          affiliate_id: string | null
          converted_at: string | null
          created_at: string | null
          id: string
          referred_user_id: string | null
          status: string | null
        }
        Insert: {
          affiliate_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          referred_user_id?: string | null
          status?: string | null
        }
        Update: {
          affiliate_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          referred_user_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          id: string | null
          name: string | null
          site_id: string | null
          url: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
          site_id?: string | null
          url?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
          site_id?: string | null
          url?: string | null
        }
        Relationships: []
      }
      smtp_config: {
        Row: {
          created_at: string | null
          id: string | null
          security_type: string | null
          sender_email: string | null
          sender_name: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_server: string | null
          smtp_user: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          security_type?: string | null
          sender_email?: string | null
          sender_name?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_server?: string | null
          smtp_user?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          security_type?: string | null
          sender_email?: string | null
          sender_name?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_server?: string | null
          smtp_user?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string | null
          features: Json | null
          id: string | null
          is_active: boolean | null
          plan_code: string | null
          price_note: string | null
          price_quarterly: number | null
          sort_order: number | null
          stripe_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          features?: Json | null
          id?: string | null
          is_active?: boolean | null
          plan_code?: string | null
          price_note?: string | null
          price_quarterly?: number | null
          sort_order?: number | null
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          features?: Json | null
          id?: string | null
          is_active?: boolean | null
          plan_code?: string | null
          price_note?: string | null
          price_quarterly?: number | null
          sort_order?: number | null
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          cancellation_requested: boolean | null
          completed_at: string | null
          created_at: string | null
          errors: string | null
          failed: number | null
          id: string | null
          inserted: number | null
          metadata: string | null
          skipped: number | null
          started_at: string | null
          status: string | null
          sync_type: string | null
          total_rows: number | null
          trigger_type: string | null
          triggered_by: string | null
          updated: number | null
          warnings: string | null
        }
        Insert: {
          cancellation_requested?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          errors?: string | null
          failed?: number | null
          id?: string | null
          inserted?: number | null
          metadata?: string | null
          skipped?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
          total_rows?: number | null
          trigger_type?: string | null
          triggered_by?: string | null
          updated?: number | null
          warnings?: string | null
        }
        Update: {
          cancellation_requested?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          errors?: string | null
          failed?: number | null
          id?: string | null
          inserted?: number | null
          metadata?: string | null
          skipped?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
          total_rows?: number | null
          trigger_type?: string | null
          triggered_by?: string | null
          updated?: number | null
          warnings?: string | null
        }
        Relationships: []
      }
      sync_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string | null
          processed_at: string | null
          row_data: string | null
          row_index: number | null
          status: string | null
          sync_log_id: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string | null
          processed_at?: string | null
          row_data?: string | null
          row_index?: number | null
          status?: string | null
          sync_log_id?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string | null
          processed_at?: string | null
          row_data?: string | null
          row_index?: number | null
          status?: string | null
          sync_log_id?: string | null
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          created_at: string | null
          event_data: string | null
          event_name: string | null
          id: string | null
          page_url: string | null
          script_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: string | null
          event_name?: string | null
          id?: string | null
          page_url?: string | null
          script_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: string | null
          event_name?: string | null
          id?: string | null
          page_url?: string | null
          script_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tracking_scripts: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string | null
          is_active: boolean | null
          location: string | null
          name: string | null
          script_content: string | null
          script_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_active?: boolean | null
          location?: string | null
          name?: string | null
          script_content?: string | null
          script_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_active?: boolean | null
          location?: string | null
          name?: string | null
          script_content?: string | null
          script_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wallet_items: {
        Row: {
          aporte_adicional: number | null
          asset_id: string | null
          created_at: string | null
          data_compra: string | null
          id: string | null
          preco_compra: number | null
          proventos: number | null
          quantidade: number | null
          updated_at: string | null
          wallet_id: string | null
        }
        Insert: {
          aporte_adicional?: number | null
          asset_id?: string | null
          created_at?: string | null
          data_compra?: string | null
          id?: string | null
          preco_compra?: number | null
          proventos?: number | null
          quantidade?: number | null
          updated_at?: string | null
          wallet_id?: string | null
        }
        Update: {
          aporte_adicional?: number | null
          asset_id?: string | null
          created_at?: string | null
          data_compra?: string | null
          id?: string | null
          preco_compra?: number | null
          proventos?: number | null
          quantidade?: number | null
          updated_at?: string | null
          wallet_id?: string | null
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
          codigo_b3: string | null
          created_at: string | null
          data_operacao: string | null
          id: string | null
          observacao: string | null
          quantidade: number | null
          tipo_operacao: string | null
          user_id: string | null
          valor_por_acao: number | null
        }
        Insert: {
          asset_id?: string | null
          codigo_b3?: string | null
          created_at?: string | null
          data_operacao?: string | null
          id?: string | null
          observacao?: string | null
          quantidade?: number | null
          tipo_operacao?: string | null
          user_id?: string | null
          valor_por_acao?: number | null
        }
        Update: {
          asset_id?: string | null
          codigo_b3?: string | null
          created_at?: string | null
          data_operacao?: string | null
          id?: string | null
          observacao?: string | null
          quantidade?: number | null
          tipo_operacao?: string | null
          user_id?: string | null
          valor_por_acao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_simulator: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      request_affiliate_activation: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "editor" | "moderator"
      plan_type: "FREE" | "START" | "PRO" | "SPECIALIST" | "FALE_C_ESPECIALISTA"
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
      app_role: ["admin", "editor", "moderator"],
      plan_type: ["FREE", "START", "PRO", "SPECIALIST", "FALE_C_ESPECIALISTA"],
    },
  },
} as const
