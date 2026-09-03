import "server-only";

import { supabaseAdmin } from "@/lib/supabase";

export const MAX_GTA_COLLECTION_PROGRESS_ITEMS = 2000;
export const MAX_GTA_COLLECTION_CODE_LENGTH = 200;

export function normalizeGtaCollectionCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > MAX_GTA_COLLECTION_CODE_LENGTH) return "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(normalized)) return "";
  return normalized;
}

export function normalizeGtaCollectionItemSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim().toLowerCase();
    if (!normalized || normalized.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= MAX_GTA_COLLECTION_PROGRESS_ITEMS) break;
  }
  return result;
}

type GtaProgressRow = {
  collection_code?: unknown;
  checked_item_slugs?: unknown;
};

export async function loadUserGtaCollectionProgress(userId: string, collectionCode: string): Promise<string[]> {
  const normalizedCode = normalizeGtaCollectionCode(collectionCode);
  if (!normalizedCode) return [];

  const { data, error } = await supabaseAdmin()
    .from("user_gta_collection_progress")
    .select("checked_item_slugs")
    .eq("user_id", userId)
    .eq("collection_code", normalizedCode)
    .maybeSingle();

  if (error) throw error;
  return normalizeGtaCollectionItemSlugs((data as GtaProgressRow | null)?.checked_item_slugs);
}

export async function loadUserGtaCollectionProgressIndex(
  userId: string
): Promise<Array<{ code: string; checkedCount: number }>> {
  const { data, error } = await supabaseAdmin()
    .from("user_gta_collection_progress")
    .select("collection_code, checked_item_slugs")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? [])
    .map((row) => {
      const typed = row as GtaProgressRow;
      const code = normalizeGtaCollectionCode(typed.collection_code);
      return code ? { code, checkedCount: normalizeGtaCollectionItemSlugs(typed.checked_item_slugs).length } : null;
    })
    .filter((entry): entry is { code: string; checkedCount: number } => Boolean(entry));
}

export async function saveUserGtaCollectionProgress(
  userId: string,
  collectionCode: string,
  checkedSlugsInput: unknown
): Promise<string[]> {
  const normalizedCode = normalizeGtaCollectionCode(collectionCode);
  if (!normalizedCode) return [];
  const checkedSlugs = normalizeGtaCollectionItemSlugs(checkedSlugsInput);
  const admin = supabaseAdmin();

  if (checkedSlugs.length === 0) {
    const { error } = await admin
      .from("user_gta_collection_progress")
      .delete()
      .eq("user_id", userId)
      .eq("collection_code", normalizedCode);
    if (error) throw error;
    return [];
  }

  const { error } = await admin
    .from("user_gta_collection_progress")
    .upsert(
      {
        user_id: userId,
        collection_code: normalizedCode,
        checked_item_slugs: checkedSlugs
      },
      { onConflict: "user_id,collection_code" }
    );

  if (error) throw error;
  return checkedSlugs;
}
