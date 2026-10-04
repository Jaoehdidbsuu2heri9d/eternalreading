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
      achievements: {
        Row: {
          description: string
          goal: number
          icon: string
          id: string
          metric: string
          name: string
          slug: string
          xp_reward: number
        }
        Insert: {
          description: string
          goal: number
          icon?: string
          id?: string
          metric: string
          name: string
          slug: string
          xp_reward?: number
        }
        Update: {
          description?: string
          goal?: number
          icon?: string
          id?: string
          metric?: string
          name?: string
          slug?: string
          xp_reward?: number
        }
        Relationships: []
      }
      activities: {
        Row: {
          chapter_id: string | null
          created_at: string
          data: Json
          id: string
          kind: string
          manga_id: string | null
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind: string
          manga_id?: string | null
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          manga_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          created_at: string
          external_customer_id: string
          provider: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_customer_id: string
          provider: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_customer_id?: string
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      chapter_pages: {
        Row: {
          chapter_id: string
          id: string
          image_url: string
          page_number: number
        }
        Insert: {
          chapter_id: string
          id?: string
          image_url: string
          page_number: number
        }
        Update: {
          chapter_id?: string
          id?: string
          image_url?: string
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapter_pages_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          manga_id: string
          number: number
          published_at: string
          scan_id: string | null
          status: string
          title: string | null
          volume: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          manga_id: string
          number: number
          published_at?: string
          scan_id?: string | null
          status?: string
          title?: string | null
          volume?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          manga_id?: string
          number?: number
          published_at?: string
          scan_id?: string | null
          status?: string
          title?: string | null
          volume?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_bans: {
        Row: {
          created_at: string
          created_by: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          chapter_id: string | null
          created_at: string
          edited_at: string | null
          hidden: boolean
          id: string
          is_spoiler: boolean
          manga_id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          chapter_id?: string | null
          created_at?: string
          edited_at?: string | null
          hidden?: boolean
          id?: string
          is_spoiler?: boolean
          manga_id: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          chapter_id?: string | null
          created_at?: string
          edited_at?: string | null
          hidden?: boolean
          id?: string
          is_spoiler?: boolean
          manga_id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      cosmetics: {
        Row: {
          active: boolean
          animation: string
          availability: string
          coin_price: number | null
          created_at: string
          description: string
          ends_at: string | null
          event_slug: string | null
          id: string
          kind: string
          media_url: string | null
          name: string
          preview: string
          rarity: string
          required_level: number
          required_plan: Database["public"]["Enums"]["plan_tier"]
          slug: string
          sort: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          animation?: string
          availability?: string
          coin_price?: number | null
          created_at?: string
          description: string
          ends_at?: string | null
          event_slug?: string | null
          id?: string
          kind: string
          media_url?: string | null
          name: string
          preview: string
          rarity?: string
          required_level?: number
          required_plan?: Database["public"]["Enums"]["plan_tier"]
          slug: string
          sort?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          animation?: string
          availability?: string
          coin_price?: number | null
          created_at?: string
          description?: string
          ends_at?: string | null
          event_slug?: string | null
          id?: string
          kind?: string
          media_url?: string | null
          name?: string
          preview?: string
          rarity?: string
          required_level?: number
          required_plan?: Database["public"]["Enums"]["plan_tier"]
          slug?: string
          sort?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          manga_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          manga_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          manga_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      genres: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      invite_code_uses: {
        Row: {
          id: string
          invite_code_id: string
          used_at: string
          user_id: string
        }
        Insert: {
          id?: string
          invite_code_id: string
          used_at?: string
          user_id: string
        }
        Update: {
          id?: string
          invite_code_id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_code_uses_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number
          uses?: number
        }
        Relationships: []
      }
      manga: {
        Row: {
          age_rating: string | null
          alt_title: string | null
          artist: string | null
          author: string | null
          banner_url: string | null
          cover_url: string | null
          created_at: string
          deleted_at: string | null
          featured: boolean
          id: string
          published: boolean
          scan_id: string | null
          slug: string
          status: Database["public"]["Enums"]["manga_status"]
          synopsis: string | null
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["manga_type"]
          updated_at: string
          views: number
          year: number | null
        }
        Insert: {
          age_rating?: string | null
          alt_title?: string | null
          artist?: string | null
          author?: string | null
          banner_url?: string | null
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          featured?: boolean
          id?: string
          published?: boolean
          scan_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["manga_status"]
          synopsis?: string | null
          tags?: string[]
          title: string
          type?: Database["public"]["Enums"]["manga_type"]
          updated_at?: string
          views?: number
          year?: number | null
        }
        Update: {
          age_rating?: string | null
          alt_title?: string | null
          artist?: string | null
          author?: string | null
          banner_url?: string | null
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          featured?: boolean
          id?: string
          published?: boolean
          scan_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["manga_status"]
          synopsis?: string | null
          tags?: string[]
          title?: string
          type?: Database["public"]["Enums"]["manga_type"]
          updated_at?: string
          views?: number
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manga_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      manga_genres: {
        Row: {
          genre_id: string
          manga_id: string
        }
        Insert: {
          genre_id: string
          manga_id: string
        }
        Update: {
          genre_id?: string
          manga_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manga_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manga_genres_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          provider: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          provider: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          billing_type: string | null
          created_at: string
          due_date: string | null
          external_id: string
          id: string
          invoice_url: string | null
          paid_at: string | null
          provider: string
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          external_id: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          provider: string
          status: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          external_id?: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          provider?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          gif_banner_equipped: boolean
          gif_banner_path: string | null
          id: string
          level: number
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          username: string
          xp: number
        }
        Insert: {
          avatar_path?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          gif_banner_equipped?: boolean
          gif_banner_path?: string | null
          id: string
          level?: number
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          username: string
          xp?: number
        }
        Update: {
          avatar_path?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          gif_banner_equipped?: boolean
          gif_banner_path?: string | null
          id?: string
          level?: number
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          username?: string
          xp?: number
        }
        Relationships: []
      }
      reading_history: {
        Row: {
          chapter_id: string
          manga_id: string
          progress: number
          read_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          manga_id: string
          progress?: number
          read_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          manga_id?: string
          progress?: number
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_history_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_requests: {
        Row: {
          community_url: string | null
          contact: string
          created_at: string
          id: string
          message: string
          scan_name: string
          status: string
          user_id: string
        }
        Insert: {
          community_url?: string | null
          contact: string
          created_at?: string
          id?: string
          message: string
          scan_name: string
          status?: string
          user_id: string
        }
        Update: {
          community_url?: string | null
          contact?: string
          created_at?: string
          id?: string
          message?: string
          scan_name?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      scans: {
        Row: {
          approved: boolean
          banner_url: string | null
          community_url: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          slug: string
        }
        Insert: {
          approved?: boolean
          banner_url?: string | null
          community_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          slug: string
        }
        Update: {
          approved?: boolean
          banner_url?: string | null
          community_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          slug?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          billing_interval: string
          features: Json
          id: Database["public"]["Enums"]["plan_tier"]
          name: string
          perks: string[]
          price_cents: number | null
          price_label: string
          sort: number
          tagline: string
        }
        Insert: {
          billing_interval?: string
          features?: Json
          id: Database["public"]["Enums"]["plan_tier"]
          name: string
          perks?: string[]
          price_cents?: number | null
          price_label: string
          sort?: number
          tagline: string
        }
        Update: {
          billing_interval?: string
          features?: Json
          id?: Database["public"]["Enums"]["plan_tier"]
          name?: string
          perks?: string[]
          price_cents?: number | null
          price_label?: string
          sort?: number
          tagline?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_type: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          ends_at: string | null
          external_customer_id: string | null
          external_id: string | null
          id: string
          next_due_date: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_type?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          ends_at?: string | null
          external_customer_id?: string | null
          external_id?: string | null
          id?: string
          next_due_date?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_type?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          ends_at?: string | null
          external_customer_id?: string | null
          external_id?: string | null
          id?: string
          next_due_date?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cosmetics: {
        Row: {
          acquired_at: string
          cosmetic_id: string
          equipped: boolean
          source: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          cosmetic_id: string
          equipped?: boolean
          source?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          cosmetic_id?: string
          equipped?: boolean
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cosmetics_cosmetic_id_fkey"
            columns: ["cosmetic_id"]
            isOneToOne: false
            referencedRelation: "cosmetics"
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
      add_xp: { Args: { p_amount: number }; Returns: undefined }
      admin_cosmetic_stats: {
        Args: never
        Returns: {
          cosmetic_id: string
          equipped: number
          owners: number
        }[]
      }
      admin_grant_cosmetic: {
        Args: { p_cosmetic: string; p_grant: boolean; p_user: string }
        Returns: undefined
      }
      admin_list_users: {
        Args: {
          p_plan?: Database["public"]["Enums"]["plan_tier"]
          p_search?: string
        }
        Returns: {
          admin_since: string
          avatar_path: string
          avatar_url: string
          display_name: string
          email: string
          id: string
          is_admin: boolean
          is_owner: boolean
          level: number
          plan: Database["public"]["Enums"]["plan_tier"]
          username: string
          xp: number
        }[]
      }
      admin_moderate_comment: {
        Args: { p_action: string; p_comment: string }
        Returns: undefined
      }
      admin_set_chapter_pages: {
        Args: { p_chapter: string; p_urls: string[] }
        Returns: undefined
      }
      admin_set_comment_ban: {
        Args: { p_banned: boolean; p_reason?: string; p_user: string }
        Returns: undefined
      }
      admin_set_plan: {
        Args: {
          p_plan: Database["public"]["Enums"]["plan_tier"]
          p_user: string
        }
        Returns: undefined
      }
      check_achievements: { Args: never; Returns: number }
      equip_cosmetic: { Args: { p_cosmetic: string }; Returns: undefined }
      expire_subscriptions: { Args: never; Returns: number }
      has_active_subscription: {
        Args: {
          p_plan: Database["public"]["Enums"]["plan_tier"]
          p_user: string
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
      owner_add_admin: { Args: { p_user: string }; Returns: undefined }
      owner_remove_admin: { Args: { p_user: string }; Returns: undefined }
      redeem_invite_code: { Args: { p_code: string }; Returns: boolean }
      set_gif_banner: {
        Args: { p_equipped: boolean; p_path: string }
        Returns: undefined
      }
      sync_profile_plan: {
        Args: { p_user: string }
        Returns: Database["public"]["Enums"]["plan_tier"]
      }
      unequip_cosmetic: { Args: { p_cosmetic: string }; Returns: undefined }
      validate_invite_code: { Args: { p_code: string }; Returns: boolean }
      write_admin_log: {
        Args: { p_action: string; p_details: Json; p_target: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "scan" | "user" | "owner"
      manga_status: "ongoing" | "completed" | "hiatus" | "cancelled"
      manga_type: "manhwa" | "manga" | "manhua" | "webtoon"
      plan_tier: "free" | "eternal" | "eternal_sunshine"
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
      app_role: ["admin", "moderator", "scan", "user", "owner"],
      manga_status: ["ongoing", "completed", "hiatus", "cancelled"],
      manga_type: ["manhwa", "manga", "manhua", "webtoon"],
      plan_tier: ["free", "eternal", "eternal_sunshine"],
    },
  },
} as const
