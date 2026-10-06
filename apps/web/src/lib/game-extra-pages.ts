import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase";
import { getGameRoot } from "./game-registry";
import type { GameExtendedPage } from "./game-page-data";
import type { ChecklistTemplateData } from "./engagement/types";

export const getGameExtendedPage = cache(async (namespace: string, path: string, kind: "map" | "quiz" | "catalog"): Promise<GameExtendedPage | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const { data, error } = await supabaseAdmin().from(`game_${kind}_pages_view`).select("*").eq("namespace",namespace).eq("canonical_path",path).maybeSingle();
  if (error) throw new Error(`Game ${kind} read failed: ${error.message}`);
  return data as GameExtendedPage | null;
});
export const getGameChecklistByPath = cache(async (namespace: string, path: string): Promise<(ChecklistTemplateData & { namespace: string; canonical_path: string }) | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const sb = supabaseAdmin();
  const { data: page, error } = await sb.from("game_checklist_pages_view").select("*").eq("namespace",namespace).eq("canonical_path",path).maybeSingle();
  if (error) throw new Error(`Game checklist read failed: ${error.message}`);
  if (!page) return null;
  const { data: items, error: itemError } = await sb.from("game_checklist_items").select("id,section_code,title,description,is_required").eq("namespace",namespace).eq("page_id",page.id).order("section_code");
  if (itemError) throw new Error(`Game checklist tasks read failed: ${itemError.message}`);
  return { page, items: (items ?? []).sort((a,b) => a.section_code.localeCompare(b.section_code,"en",{numeric:true})), namespace, canonical_path:path } as ChecklistTemplateData & { namespace: string; canonical_path: string };
});

export const listGameMapPages = cache(async (namespace: string): Promise<GameExtendedPage[]> => {
  if (!(await getGameRoot(namespace))) return [];
  const { data, error } = await supabaseAdmin().from("game_map_pages_view").select("*")
    .eq("namespace", namespace).order("title");
  if (error) throw new Error(`Game map directory read failed: ${error.message}`);
  return data as GameExtendedPage[];
});
