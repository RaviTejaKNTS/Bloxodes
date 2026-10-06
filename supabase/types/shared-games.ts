// Generated from managed development bbtcaurrtyoukvjbxbbj on 2026-10-06.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SharedGameDatabase = {
  public: {
    Tables: {
      games: {
        Row: {
          content_kind: string
          cover_image: string | null
          created_at: string
          description_md: string | null
          developer: string | null
          hero_image: string | null
          id: string
          installment: string | null
          is_published: boolean
          kind: string
          namespace: string
          official_url: string | null
          parent_game_id: string | null
          parent_id: string | null
          platforms_json: Json
          published_at: string | null
          publisher: string | null
          release_dates_json: Json
          short_title: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content_kind?: string
          cover_image?: string | null
          created_at?: string
          description_md?: string | null
          developer?: string | null
          hero_image?: string | null
          id?: string
          installment?: string | null
          is_published?: boolean
          kind?: string
          namespace?: string
          official_url?: string | null
          parent_game_id?: string | null
          parent_id?: string | null
          platforms_json?: Json
          published_at?: string | null
          publisher?: string | null
          release_dates_json?: Json
          short_title?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content_kind?: string
          cover_image?: string | null
          created_at?: string
          description_md?: string | null
          developer?: string | null
          hero_image?: string | null
          id?: string
          installment?: string | null
          is_published?: boolean
          kind?: string
          namespace?: string
          official_url?: string | null
          parent_game_id?: string | null
          parent_id?: string | null
          platforms_json?: Json
          published_at?: string | null
          publisher?: string | null
          release_dates_json?: Json
          short_title?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_wiki_pages: {
        Row: {
          canonical_path: string | null
          controls_json: Json
          cover_image: string | null
          created_at: string
          description_md: string | null
          game_id: string
          id: string
          is_published: boolean
          meta_description: string | null
          namespace: string
          published_at: string | null
          seo_title: string | null
          slug: string
          tips_md: string | null
          title: string
          updated_at: string
        }
        Insert: {
          canonical_path?: string | null
          controls_json?: Json
          cover_image?: string | null
          created_at?: string
          description_md?: string | null
          game_id: string
          id?: string
          is_published?: boolean
          meta_description?: string | null
          namespace?: string
          published_at?: string | null
          seo_title?: string | null
          slug: string
          tips_md?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          canonical_path?: string | null
          controls_json?: Json
          cover_image?: string | null
          created_at?: string
          description_md?: string | null
          game_id?: string
          id?: string
          is_published?: boolean
          meta_description?: string | null
          namespace?: string
          published_at?: string | null
          seo_title?: string | null
          slug?: string
          tips_md?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_wiki_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_collection_pages: {
        Row: {
          canonical_path: string | null
          code: string
          collection_slug: string
          created_at: string
          description_json: Json
          description_md: string | null
          display_name: string
          faq_json: Json
          game_id: string
          how_it_works_md: string | null
          id: string
          intro_md: string | null
          is_published: boolean
          item_count: number
          meta_description: string
          namespace: string
          page_type: string
          published_at: string | null
          published_dataset_id: string | null
          schema_ld_json: Json | null
          seo_title: string
          thumb_url: string | null
          title: string
          updated_at: string
          wiki_md: string | null
          wiki_page_id: string
          wiki_slug: string
          wiki_sort_order: number | null
        }
        Insert: {
          canonical_path?: string | null
          code: string
          collection_slug: string
          created_at?: string
          description_json?: Json
          description_md?: string | null
          display_name: string
          faq_json?: Json
          game_id: string
          how_it_works_md?: string | null
          id?: string
          intro_md?: string | null
          is_published?: boolean
          item_count?: number
          meta_description: string
          namespace?: string
          page_type?: string
          published_at?: string | null
          published_dataset_id?: string | null
          schema_ld_json?: Json | null
          seo_title: string
          thumb_url?: string | null
          title: string
          updated_at?: string
          wiki_md?: string | null
          wiki_page_id: string
          wiki_slug: string
          wiki_sort_order?: number | null
        }
        Update: {
          canonical_path?: string | null
          code?: string
          collection_slug?: string
          created_at?: string
          description_json?: Json
          description_md?: string | null
          display_name?: string
          faq_json?: Json
          game_id?: string
          how_it_works_md?: string | null
          id?: string
          intro_md?: string | null
          is_published?: boolean
          item_count?: number
          meta_description?: string
          namespace?: string
          page_type?: string
          published_at?: string | null
          published_dataset_id?: string | null
          schema_ld_json?: Json | null
          seo_title?: string
          thumb_url?: string | null
          title?: string
          updated_at?: string
          wiki_md?: string | null
          wiki_page_id?: string
          wiki_slug?: string
          wiki_sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_collection_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
          {
            foreignKeyName: "game_collection_pages_published_dataset_id_id_fkey"
            columns: ["published_dataset_id", "id"]
            isOneToOne: false
            referencedRelation: "game_collection_datasets"
            referencedColumns: ["id", "collection_page_id"]
          },
          {
            foreignKeyName: "game_collection_pages_wiki_page_id_game_id_fkey"
            columns: ["wiki_page_id", "game_id"]
            isOneToOne: false
            referencedRelation: "game_wiki_pages"
            referencedColumns: ["id", "game_id"]
          },
          {
            foreignKeyName: "game_collection_pages_wiki_page_id_game_id_fkey"
            columns: ["wiki_page_id", "game_id"]
            isOneToOne: false
            referencedRelation: "game_wiki_pages_view"
            referencedColumns: ["id", "game_id"]
          },
        ]
      }
      game_collection_datasets: {
        Row: {
          collection_page_id: string
          content_hash: string
          created_at: string
          id: string
          item_count: number
          meta_json: Json
          namespace: string
          schema_version: number
          source_manifest_json: Json
          updated_at: string
          validation_json: Json
        }
        Insert: {
          collection_page_id: string
          content_hash: string
          created_at?: string
          id?: string
          item_count: number
          meta_json?: Json
          namespace?: string
          schema_version?: number
          source_manifest_json?: Json
          updated_at?: string
          validation_json?: Json
        }
        Update: {
          collection_page_id?: string
          content_hash?: string
          created_at?: string
          id?: string
          item_count?: number
          meta_json?: Json
          namespace?: string
          schema_version?: number
          source_manifest_json?: Json
          updated_at?: string
          validation_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "game_collection_datasets_collection_page_id_fkey"
            columns: ["collection_page_id"]
            isOneToOne: false
            referencedRelation: "game_collection_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_collection_datasets_collection_page_id_fkey"
            columns: ["collection_page_id"]
            isOneToOne: false
            referencedRelation: "game_collection_pages_view"
            referencedColumns: ["id"]
          },
        ]
      }
      game_collection_items: {
        Row: {
          created_at: string
          dataset_id: string
          fields_json: Json
          id: string
          image_bytes: number | null
          image_height: number | null
          image_key: string | null
          image_mime: string | null
          image_sha256: string | null
          image_width: number | null
          item_name: string
          item_slug: string
          namespace: string
          section: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dataset_id: string
          fields_json?: Json
          id?: string
          image_bytes?: number | null
          image_height?: number | null
          image_key?: string | null
          image_mime?: string | null
          image_sha256?: string | null
          image_width?: number | null
          item_name: string
          item_slug: string
          namespace?: string
          section: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dataset_id?: string
          fields_json?: Json
          id?: string
          image_bytes?: number | null
          image_height?: number | null
          image_key?: string | null
          image_mime?: string | null
          image_sha256?: string | null
          image_width?: number | null
          item_name?: string
          item_slug?: string
          namespace?: string
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_collection_items_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "game_collection_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      game_checklist_pages: {
        Row: {
          canonical_path: string | null
          created_at: string
          description_md: string | null
          game_id: string
          id: string
          is_public: boolean
          namespace: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          canonical_path?: string | null
          created_at?: string
          description_md?: string | null
          game_id: string
          id?: string
          is_public?: boolean
          namespace?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          canonical_path?: string | null
          created_at?: string
          description_md?: string | null
          game_id?: string
          id?: string
          is_public?: boolean
          namespace?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_checklist_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_checklist_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          item_key: string
          namespace: string
          page_id: string
          section_code: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          item_key: string
          namespace?: string
          page_id: string
          section_code: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          item_key?: string
          namespace?: string
          page_id?: string
          section_code?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_checklist_items_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "game_checklist_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_checklist_items_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "game_checklist_pages_view"
            referencedColumns: ["id"]
          },
        ]
      }
      game_tool_pages: {
        Row: {
          canonical_path: string | null
          code: string
          created_at: string
          description_json: Json
          description_md: string | null
          faq_json: Json
          game_id: string
          how_it_works_md: string
          id: string
          intro_md: string
          is_published: boolean
          meta_description: string
          namespace: string
          published_at: string | null
          rules_json: Json
          schema_ld_json: Json | null
          seo_title: string
          slug: string
          thumb_url: string | null
          title: string
          tool_key: string
          updated_at: string
        }
        Insert: {
          canonical_path?: string | null
          code?: string
          created_at?: string
          description_json?: Json
          description_md?: string | null
          faq_json?: Json
          game_id: string
          how_it_works_md?: string
          id?: string
          intro_md?: string
          is_published?: boolean
          meta_description: string
          namespace?: string
          published_at?: string | null
          rules_json?: Json
          schema_ld_json?: Json | null
          seo_title?: string
          slug: string
          thumb_url?: string | null
          title: string
          tool_key: string
          updated_at?: string
        }
        Update: {
          canonical_path?: string | null
          code?: string
          created_at?: string
          description_json?: Json
          description_md?: string | null
          faq_json?: Json
          game_id?: string
          how_it_works_md?: string
          id?: string
          intro_md?: string
          is_published?: boolean
          meta_description?: string
          namespace?: string
          published_at?: string | null
          rules_json?: Json
          schema_ld_json?: Json | null
          seo_title?: string
          slug?: string
          thumb_url?: string | null
          title?: string
          tool_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_tool_pages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_tool_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_releases: {
        Row: {
          checked_at: string
          edition: string
          game_id: string
          is_stable: boolean
          namespace: string
          release_order: number
          released_at: string | null
          source_url: string
          version: string
        }
        Insert: {
          checked_at?: string
          edition: string
          game_id: string
          is_stable?: boolean
          namespace?: string
          release_order: number
          released_at?: string | null
          source_url: string
          version: string
        }
        Update: {
          checked_at?: string
          edition?: string
          game_id?: string
          is_stable?: boolean
          namespace?: string
          release_order?: number
          released_at?: string | null
          source_url?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_releases_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_releases_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_collection_progress: {
        Row: {
          checked_item_slugs: string[]
          collection_code: string
          created_at: string
          namespace: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_item_slugs?: string[]
          collection_code: string
          created_at?: string
          namespace?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_item_slugs?: string[]
          collection_code?: string
          created_at?: string
          namespace?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_collection_progress_namespace_collection_code_fkey"
            columns: ["namespace", "collection_code"]
            isOneToOne: false
            referencedRelation: "game_collection_pages"
            referencedColumns: ["namespace", "code"]
          },
          {
            foreignKeyName: "game_collection_progress_namespace_collection_code_fkey"
            columns: ["namespace", "collection_code"]
            isOneToOne: false
            referencedRelation: "game_collection_pages_view"
            referencedColumns: ["namespace", "code"]
          },
          {
            foreignKeyName: "game_collection_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      game_code_pages: {
        Row: {
          canonical_path: string | null
          created_at: string
          faq_json: Json
          find_codes_md: string | null
          game_id: string
          id: string
          intro_md: string | null
          is_published: boolean
          meta_description: string | null
          namespace: string
          published_at: string | null
          redeem_md: string | null
          rewards_md: string | null
          seo_title: string | null
          slug: string
          sources_json: Json
          title: string
          troubleshoot_md: string | null
          updated_at: string
        }
        Insert: {
          canonical_path?: string | null
          created_at?: string
          faq_json?: Json
          find_codes_md?: string | null
          game_id: string
          id?: string
          intro_md?: string | null
          is_published?: boolean
          meta_description?: string | null
          namespace: string
          published_at?: string | null
          redeem_md?: string | null
          rewards_md?: string | null
          seo_title?: string | null
          slug: string
          sources_json?: Json
          title: string
          troubleshoot_md?: string | null
          updated_at?: string
        }
        Update: {
          canonical_path?: string | null
          created_at?: string
          faq_json?: Json
          find_codes_md?: string | null
          game_id?: string
          id?: string
          intro_md?: string | null
          is_published?: boolean
          meta_description?: string | null
          namespace?: string
          published_at?: string | null
          redeem_md?: string | null
          rewards_md?: string | null
          seo_title?: string | null
          slug?: string
          sources_json?: Json
          title?: string
          troubleshoot_md?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_code_pages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_code_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_codes: {
        Row: {
          code: string
          code_page_id: string
          first_seen_at: string
          id: string
          last_seen_at: string
          rewards_text: string | null
          source_url: string | null
          status: string
          verified_at: string | null
        }
        Insert: {
          code: string
          code_page_id: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          rewards_text?: string | null
          source_url?: string | null
          status: string
          verified_at?: string | null
        }
        Update: {
          code?: string
          code_page_id?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          rewards_text?: string | null
          source_url?: string | null
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_codes_code_page_id_fkey"
            columns: ["code_page_id"]
            isOneToOne: false
            referencedRelation: "game_code_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_codes_code_page_id_fkey"
            columns: ["code_page_id"]
            isOneToOne: false
            referencedRelation: "game_code_pages_view"
            referencedColumns: ["id"]
          },
        ]
      }
      game_map_pages: {
        Row: {
          canonical_path: string
          created_at: string
          description_md: string | null
          game_id: string
          id: string
          intro_md: string | null
          is_published: boolean
          map_data: Json
          meta_description: string | null
          namespace: string
          published_at: string | null
          renderer_key: string
          seo_title: string | null
          slug: string
          sources_json: Json
          title: string
          updated_at: string
        }
        Insert: {
          canonical_path: string
          created_at?: string
          description_md?: string | null
          game_id: string
          id?: string
          intro_md?: string | null
          is_published?: boolean
          map_data?: Json
          meta_description?: string | null
          namespace: string
          published_at?: string | null
          renderer_key?: string
          seo_title?: string | null
          slug: string
          sources_json?: Json
          title: string
          updated_at?: string
        }
        Update: {
          canonical_path?: string
          created_at?: string
          description_md?: string | null
          game_id?: string
          id?: string
          intro_md?: string | null
          is_published?: boolean
          map_data?: Json
          meta_description?: string | null
          namespace?: string
          published_at?: string | null
          renderer_key?: string
          seo_title?: string | null
          slug?: string
          sources_json?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_map_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_quiz_pages: {
        Row: {
          canonical_path: string
          created_at: string
          description_md: string | null
          game_id: string
          id: string
          intro_md: string | null
          is_published: boolean
          meta_description: string | null
          namespace: string
          published_at: string | null
          quiz_data: Json
          seo_title: string | null
          slug: string
          sources_json: Json
          title: string
          updated_at: string
        }
        Insert: {
          canonical_path: string
          created_at?: string
          description_md?: string | null
          game_id: string
          id?: string
          intro_md?: string | null
          is_published?: boolean
          meta_description?: string | null
          namespace: string
          published_at?: string | null
          quiz_data?: Json
          seo_title?: string | null
          slug: string
          sources_json?: Json
          title: string
          updated_at?: string
        }
        Update: {
          canonical_path?: string
          created_at?: string
          description_md?: string | null
          game_id?: string
          id?: string
          intro_md?: string | null
          is_published?: boolean
          meta_description?: string | null
          namespace?: string
          published_at?: string | null
          quiz_data?: Json
          seo_title?: string | null
          slug?: string
          sources_json?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_quiz_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_catalog_pages: {
        Row: {
          canonical_path: string
          catalog_data: Json
          created_at: string
          description_md: string | null
          game_id: string
          id: string
          intro_md: string | null
          is_published: boolean
          meta_description: string | null
          namespace: string
          published_at: string | null
          seo_title: string | null
          slug: string
          sources_json: Json
          title: string
          updated_at: string
        }
        Insert: {
          canonical_path: string
          catalog_data?: Json
          created_at?: string
          description_md?: string | null
          game_id: string
          id?: string
          intro_md?: string | null
          is_published?: boolean
          meta_description?: string | null
          namespace: string
          published_at?: string | null
          seo_title?: string | null
          slug: string
          sources_json?: Json
          title: string
          updated_at?: string
        }
        Update: {
          canonical_path?: string
          catalog_data?: Json
          created_at?: string
          description_md?: string | null
          game_id?: string
          id?: string
          intro_md?: string | null
          is_published?: boolean
          meta_description?: string | null
          namespace?: string
          published_at?: string | null
          seo_title?: string | null
          slug?: string
          sources_json?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_catalog_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_quiz_progress: {
        Row: {
          created_at: string
          last_attempt_at: string | null
          last_breakdown: Json
          last_score: number | null
          last_total: number | null
          namespace: string
          quiz_page_id: string
          seen_question_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_attempt_at?: string | null
          last_breakdown?: Json
          last_score?: number | null
          last_total?: number | null
          namespace: string
          quiz_page_id: string
          seen_question_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_attempt_at?: string | null
          last_breakdown?: Json
          last_score?: number | null
          last_total?: number | null
          namespace?: string
          quiz_page_id?: string
          seen_question_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_quiz_progress_quiz_page_id_namespace_fkey"
            columns: ["quiz_page_id", "namespace"]
            isOneToOne: false
            referencedRelation: "game_quiz_pages"
            referencedColumns: ["id", "namespace"]
          },
          {
            foreignKeyName: "game_quiz_progress_quiz_page_id_namespace_fkey"
            columns: ["quiz_page_id", "namespace"]
            isOneToOne: false
            referencedRelation: "game_quiz_pages_view"
            referencedColumns: ["id", "namespace"]
          },
          {
            foreignKeyName: "game_quiz_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      game_wiki_pages_view: {
        Row: {
          canonical_path: string | null
          content_updated_at: string | null
          controls_json: Json | null
          cover_image: string | null
          created_at: string | null
          description_md: string | null
          game_content_kind: string | null
          game_cover_image: string | null
          game_description_md: string | null
          game_developer: string | null
          game_hero_image: string | null
          game_id: string | null
          game_installment: string | null
          game_kind: string | null
          game_official_url: string | null
          game_parent_game_id: string | null
          game_platforms_json: Json | null
          game_publisher: string | null
          game_release_dates_json: Json | null
          game_short_title: string | null
          game_status: string | null
          game_title: string | null
          id: string | null
          is_published: boolean | null
          meta_description: string | null
          namespace: string | null
          parent_id: string | null
          published_at: string | null
          seo_title: string | null
          slug: string | null
          tips_md: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_wiki_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
          {
            foreignKeyName: "games_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_collection_pages_view: {
        Row: {
          canonical_path: string | null
          code: string | null
          collection_slug: string | null
          content_updated_at: string | null
          created_at: string | null
          description_json: Json | null
          description_md: string | null
          display_name: string | null
          faq_json: Json | null
          game_content_kind: string | null
          game_cover_image: string | null
          game_hero_image: string | null
          game_id: string | null
          game_parent_game_id: string | null
          game_short_title: string | null
          game_title: string | null
          how_it_works_md: string | null
          id: string | null
          intro_md: string | null
          is_published: boolean | null
          item_count: number | null
          meta_description: string | null
          namespace: string | null
          page_type: string | null
          published_at: string | null
          published_dataset_id: string | null
          schema_ld_json: Json | null
          seo_title: string | null
          thumb_url: string | null
          title: string | null
          updated_at: string | null
          wiki_md: string | null
          wiki_page_id: string | null
          wiki_slug: string | null
          wiki_sort_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_collection_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
          {
            foreignKeyName: "game_collection_pages_published_dataset_id_id_fkey"
            columns: ["published_dataset_id", "id"]
            isOneToOne: false
            referencedRelation: "game_collection_datasets"
            referencedColumns: ["id", "collection_page_id"]
          },
          {
            foreignKeyName: "game_collection_pages_wiki_page_id_game_id_fkey"
            columns: ["wiki_page_id", "game_id"]
            isOneToOne: false
            referencedRelation: "game_wiki_pages"
            referencedColumns: ["id", "game_id"]
          },
          {
            foreignKeyName: "game_collection_pages_wiki_page_id_game_id_fkey"
            columns: ["wiki_page_id", "game_id"]
            isOneToOne: false
            referencedRelation: "game_wiki_pages_view"
            referencedColumns: ["id", "game_id"]
          },
        ]
      }
      game_tool_pages_view: {
        Row: {
          canonical_path: string | null
          code: string | null
          content_updated_at: string | null
          created_at: string | null
          description_json: Json | null
          description_md: string | null
          faq_json: Json | null
          game_id: string | null
          how_it_works_md: string | null
          id: string | null
          intro_md: string | null
          is_published: boolean | null
          meta_description: string | null
          namespace: string | null
          published_at: string | null
          rules_json: Json | null
          schema_ld_json: Json | null
          seo_title: string | null
          slug: string | null
          thumb_url: string | null
          title: string | null
          tool_key: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_tool_pages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_tool_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_code_pages_view: {
        Row: {
          canonical_path: string | null
          created_at: string | null
          faq_json: Json | null
          find_codes_md: string | null
          game_id: string | null
          id: string | null
          intro_md: string | null
          is_published: boolean | null
          meta_description: string | null
          namespace: string | null
          published_at: string | null
          redeem_md: string | null
          rewards_md: string | null
          seo_title: string | null
          slug: string | null
          sources_json: Json | null
          title: string | null
          troubleshoot_md: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_code_pages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_code_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_checklist_pages_view: {
        Row: {
          canonical_path: string | null
          content_updated_at: string | null
          created_at: string | null
          description_md: string | null
          game_id: string | null
          game_slug: string | null
          game_title: string | null
          id: string | null
          image: string | null
          is_public: boolean | null
          leaf_item_count: number | null
          namespace: string | null
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_checklist_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_map_pages_view: {
        Row: {
          canonical_path: string | null
          created_at: string | null
          description_md: string | null
          game_id: string | null
          game_slug: string | null
          game_title: string | null
          id: string | null
          intro_md: string | null
          is_published: boolean | null
          map_data: Json | null
          meta_description: string | null
          namespace: string | null
          published_at: string | null
          renderer_key: string | null
          seo_title: string | null
          slug: string | null
          sources_json: Json | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_map_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_quiz_pages_view: {
        Row: {
          canonical_path: string | null
          created_at: string | null
          description_md: string | null
          game_id: string | null
          game_slug: string | null
          game_title: string | null
          id: string | null
          intro_md: string | null
          is_published: boolean | null
          meta_description: string | null
          namespace: string | null
          published_at: string | null
          quiz_data: Json | null
          seo_title: string | null
          slug: string | null
          sources_json: Json | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_quiz_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
      game_catalog_pages_view: {
        Row: {
          canonical_path: string | null
          catalog_data: Json | null
          created_at: string | null
          description_md: string | null
          game_id: string | null
          game_slug: string | null
          game_title: string | null
          id: string | null
          intro_md: string | null
          is_published: boolean | null
          meta_description: string | null
          namespace: string | null
          published_at: string | null
          seo_title: string | null
          slug: string | null
          sources_json: Json | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_catalog_pages_game_id_namespace_fkey"
            columns: ["game_id", "namespace"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "namespace"]
          },
        ]
      }
    }
    Functions: {
      save_game_quiz_progress: {
        Args: {
          breakdown: Json
          question_ids: string[]
          score: number
          target_namespace: string
          target_page: string
          target_user: string
          total: number
        }
        Returns: undefined
      }
      publish_game_content_batch: {
        Args: {
          apply_changes?: boolean
          payload: Json
          target_namespace: string
        }
        Returns: Json
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
