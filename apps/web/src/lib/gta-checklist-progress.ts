import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// Existing Roblox progress keys stay unchanged. GTA standalone checklists share
// the same account/browser protocol with a disjoint namespace.
export async function validateGtaChecklistProgress(key: string, checkedIds?: string[]) {
  if (!key.startsWith("gta:")) return null;
  const slug = key.slice(4);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { status: 400, error: "Invalid GTA checklist." };
  const sb = supabaseAdmin();
  const { data: page, error } = await sb.from("gta_checklist_pages_view").select("id").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!page) return { status: 404, error: "Unknown GTA checklist." };
  if (checkedIds?.length) {
    const { data: items, error: itemError } = await sb.from("gta_checklist_items").select("id,section_code").eq("page_id", page.id);
    if (itemError) throw itemError;
    const valid = new Set((items ?? []).filter(item => item.section_code.split(".").length === 3).map(item => item.id));
    if (checkedIds.some(id => !valid.has(id))) return { status: 400, error: "Progress contains an unknown checklist task." };
  }
  return null;
}
