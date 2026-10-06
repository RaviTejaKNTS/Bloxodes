import { gameDatabase } from "@/lib/game-content-db";
import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// Existing Roblox progress keys stay unchanged. GTA standalone checklists share
// the same account/browser protocol with a disjoint namespace.
export async function validateGtaChecklistProgress(key: string, checkedIds?: string[]) {
  if (!key.includes(":") || key.startsWith("wiki-collection:")) return null;
  const [namespace, ...parts] = key.split(":");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace) || namespace === "roblox" || parts.length !== 1) return {status:400,error:"Invalid game checklist."};
  const slug = parts[0];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { status: 400, error: "Invalid game checklist." };
  const sb = supabaseAdmin();
  const { data: page, error } = await gameDatabase(sb, namespace).from("checklist_pages_view").select("id").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!page) return { status: 404, error: "Unknown game checklist." };
  if (checkedIds?.length) {
    const { data: items, error: itemError } = await gameDatabase(sb, namespace).from("checklist_items").select("id,section_code").eq("page_id", page.id);
    if (itemError) throw itemError;
    const valid = new Set((items ?? []).filter(item => item.section_code.split(".").length === 3).map(item => item.id));
    if (checkedIds.some(id => !valid.has(id))) return { status: 400, error: "Progress contains an unknown checklist task." };
  }
  return null;
}
