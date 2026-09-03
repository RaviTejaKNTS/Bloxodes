import "server-only";

import { supabaseAdmin } from "@/lib/supabase";

const PREFIX = "wiki-collection:";
const MAX_CHECKED_IDS = 2000;

export function normalizeWikiCollectionCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const code = value.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code) && code.length <= 200 ? code : "";
}

export function normalizeWikiCollectionItemSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const slug = entry.trim().toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    result.push(slug);
    if (result.length >= MAX_CHECKED_IDS) break;
  }
  return result;
}

function storageSlug(code: string): string {
  return `${PREFIX}${code}`;
}

function codeFromStorageSlug(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return "";
  return normalizeWikiCollectionCode(value.slice(PREFIX.length));
}

function normalizeStoredIds(value: unknown): string[] {
  return normalizeWikiCollectionItemSlugs(value);
}

export async function loadUserWikiCollectionProgress(userId: string, code: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("user_checklist_progress")
    .select("checked_item_ids")
    .eq("user_id", userId)
    .eq("checklist_slug", storageSlug(code))
    .maybeSingle();
  if (error) throw error;
  return normalizeStoredIds((data as { checked_item_ids?: unknown } | null)?.checked_item_ids);
}

export async function loadUserWikiCollectionProgressIndex(userId: string) {
  const { data, error } = await supabaseAdmin()
    .from("user_checklist_progress")
    .select("checklist_slug, checked_item_ids")
    .eq("user_id", userId)
    .like("checklist_slug", `${PREFIX}%`);
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const code = codeFromStorageSlug((row as { checklist_slug?: unknown }).checklist_slug);
      if (!code) return null;
      return {
        slug: code,
        checkedCount: normalizeStoredIds((row as { checked_item_ids?: unknown }).checked_item_ids).length
      };
    })
    .filter((entry): entry is { slug: string; checkedCount: number } => Boolean(entry));
}

export async function saveUserWikiCollectionProgress(userId: string, code: string, checkedIds: string[]) {
  const normalized = normalizeWikiCollectionItemSlugs(checkedIds);
  if (!normalized.length) {
    const { error } = await supabaseAdmin()
      .from("user_checklist_progress")
      .delete()
      .eq("user_id", userId)
      .eq("checklist_slug", storageSlug(code));
    if (error) throw error;
    return [];
  }

  const { error } = await supabaseAdmin()
    .from("user_checklist_progress")
    .upsert(
      {
        user_id: userId,
        checklist_slug: storageSlug(code),
        checked_item_ids: normalized
      },
      { onConflict: "user_id,checklist_slug" }
    );
  if (error) throw error;
  return normalized;
}
