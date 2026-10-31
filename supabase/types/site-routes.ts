// Additive contract for migration 20261031194915. Regenerate from managed
// development after GitHub applies the migration; no database was changed locally.
import type { Json } from "./shared-games";

export type SiteRoute = {
  path: string;
  match_type: "exact" | "prefix";
  page_type: "hub" | "wiki" | "collection" | "code" | "quiz" | "checklist" | "tool" | "map" | "catalog" | "event" | "article" | "puzzle" | null;
  source: "roblox" | "game" | null;
  page_id: string | null;
  game_id: string | null;
  status: "live" | "old" | "gone";
  target_url: string | null;
  redirect_code: 301 | 308;
  origin: string;
  moved_at: string | null;
  created_at: string;
  updated_at: string;
  tail_mode: "append" | "drop" | "free-items";
  match_self: boolean;
};
type Conflict = { id: number; path: string; incumbent: Json; claimant: Json; origin: string; reason: string; created_at: string };
type Expected = Pick<SiteRoute, "path" | "source" | "page_type" | "page_id" | "game_id"> & { page_table: string };
export type SiteRoutesDatabase = {
  public: {
    Tables: {
      site_routes: {
        Row: SiteRoute;
        Insert: Pick<SiteRoute, "path" | "status" | "origin"> & Partial<Omit<SiteRoute, "path" | "status" | "origin">>;
        Update: Partial<SiteRoute>;
        Relationships: [{ foreignKeyName: "site_routes_game_id_fkey"; columns: ["game_id"]; isOneToOne: false; referencedRelation: "games"; referencedColumns: ["id"] }];
      };
      site_route_conflicts: {
        Row: Conflict;
        Insert: Omit<Conflict, "id" | "created_at"> & { created_at?: string };
        Update: Partial<Omit<Conflict, "id">>;
        Relationships: [];
      };
    };
    Views: {
      expected_site_routes: { Row: Expected; Relationships: [] };
      site_route_redirects: { Row: SiteRoute & { resolved_target: string | null }; Relationships: [] };
    };
    Functions: {
      resolve_site_route: { Args: { p_path: string }; Returns: { route: SiteRoute; resolved_target: string | null }[] };
      site_routes_report: { Args: Record<PropertyKey, never>; Returns: Json };
      sync_site_catalog_route: { Args: { p_path: string }; Returns: undefined };
      site_catalog_path: { Args: { code: string }; Returns: string | null };
      site_page_route: { Args: { p_table: string; p_row: Json }; Returns: SiteRoute };
      claim_site_route: { Args: { p_claim: Json; p_backfill?: boolean }; Returns: undefined };
      site_route_target: { Args: { r: SiteRoute; p_path: string }; Returns: string | null };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
