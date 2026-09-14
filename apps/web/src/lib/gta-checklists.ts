import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { ChecklistItem } from "@/lib/db";
import type { ChecklistTemplatePage } from "@/lib/engagement/types";
import { GTA_CHECKLISTS } from "@/lib/engagement/config";

export const GTA_CHECKLISTS_DESCRIPTION = GTA_CHECKLISTS.description;
export type GtaChecklistPage = ChecklistTemplatePage & {
  game_id: string;
  game_title: string;
  game_slug: string;
  leaf_item_count: number;
};
export async function listPublishedGtaChecklists(page = 1, pageSize = 20) {
  const sb = supabaseAdmin();
  const { count, error: countError } = await sb.from("gta_checklist_pages_view").select("id", { count: "exact", head: true });
  if (countError) throw countError;
  const total = count ?? 0;
  const offset = (page - 1) * pageSize;
  if (offset >= total) return { checklists: [], total };
  const { data, error } = await sb.from("gta_checklist_pages_view")
    .select("*").order("published_at", { ascending: false }).order("slug")
    .range(offset, offset + pageSize - 1);
  if (error?.code === "PGRST103") return { checklists: [], total: 0 };
  if (error) throw error;
  return { checklists: (data ?? []) as GtaChecklistPage[], total };
}
export async function getGtaChecklistPageBySlug(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const { data: page, error } = await supabaseAdmin().from("gta_checklist_pages_view")
    .select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!page) return null;
  const { data: items, error: itemError } = await supabaseAdmin().from("gta_checklist_items")
    .select("*").eq("page_id", page.id).order("section_code");
  if (itemError) throw itemError;
  return { page: page as GtaChecklistPage, items: ((items ?? []) as ChecklistItem[]).sort((a, b) => a.section_code.localeCompare(b.section_code, "en", { numeric: true })) };
}
