import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase";
import { getGameArtwork, getGameRoot } from "./game-registry";
import type { GameExtendedPage } from "./game-page-data";
import type { ChecklistTemplateData } from "./engagement/types";

const readGameExtendedPage = cache(async (namespace: string, value: string, column: "canonical_path" | "id" | "slug", kind: "map" | "quiz" | "catalog"): Promise<GameExtendedPage | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const { data, error } = await supabaseAdmin().from(`game_${kind}_pages_view`).select("*").eq("namespace",namespace).eq(column,value).maybeSingle();
  if (error) throw new Error(`Game ${kind} read failed: ${error.message}`);
  return data ? { ...data, image: (await getGameArtwork(namespace, data.game_id))?.cover_image } as GameExtendedPage : null;
});
const readGameChecklist = cache(async (namespace: string, value: string, column: "canonical_path" | "id"): Promise<(ChecklistTemplateData & { namespace: string; canonical_path: string; game_id: string }) | null> => {
  if (!(await getGameRoot(namespace))) return null;
  const sb = supabaseAdmin();
  const { data: page, error } = await sb.from("game_checklist_pages_view").select("*").eq("namespace",namespace).eq(column,value).maybeSingle();
  if (error) throw new Error(`Game checklist read failed: ${error.message}`);
  if (!page) return null;
  const { data: items, error: itemError } = await sb.from("game_checklist_items").select("id,section_code,title,description,is_required").eq("namespace",namespace).eq("page_id",page.id).order("section_code");
  if (itemError) throw new Error(`Game checklist tasks read failed: ${itemError.message}`);
  return { page: { ...page, image: (await getGameArtwork(namespace, page.game_id))?.cover_image ?? null }, items: (items ?? []).sort((a,b) => a.section_code.localeCompare(b.section_code,"en",{numeric:true})), namespace, game_id: page.game_id, canonical_path:page.canonical_path } as ChecklistTemplateData & { namespace: string; canonical_path: string; game_id: string };
});

export const listGameMapPages = cache(async (namespace: string): Promise<GameExtendedPage[]> => {
  if (!(await getGameRoot(namespace))) return [];
  const { data, error } = await supabaseAdmin().from("game_map_pages_view").select("*")
    .eq("namespace", namespace).order("title");
  if (error) throw new Error(`Game map directory read failed: ${error.message}`);
  return Promise.all((data ?? []).map(async page => ({ ...page, image: (await getGameArtwork(namespace, page.game_id))?.cover_image }))) as Promise<GameExtendedPage[]>;
});

export const getGameExtendedPage = cache((namespace: string, path: string, kind: "map" | "quiz" | "catalog") => readGameExtendedPage(namespace, path, "canonical_path", kind));
export const getGameExtendedPageById = cache((namespace: string, id: string, kind: "map" | "quiz" | "catalog") => readGameExtendedPage(namespace, id, "id", kind));
export const getGameChecklistByPath = cache((namespace: string, path: string) => readGameChecklist(namespace, path, "canonical_path"));
export const getGameChecklistById = cache((namespace: string, id: string) => readGameChecklist(namespace, id, "id"));

/** Stable namespace and stored slug, independent of the public URL style. */
export const getGameMapBySlug = cache((namespace: string, slug: string) => readGameExtendedPage(namespace, slug, "slug", "map"));
