import "server-only";

import { supabaseAdmin } from "@/lib/supabase";

export const MAX_RED_DEAD_COLLECTION_PROGRESS_ITEMS = 2000;
export const MAX_RED_DEAD_COLLECTION_CODE_LENGTH = 200;

export function normalizeRedDeadCollectionCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > MAX_RED_DEAD_COLLECTION_CODE_LENGTH) return "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(normalized)) return "";
  return normalized;
}

export function normalizeRedDeadCollectionItemSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim().toLowerCase();
    if (
      !normalized ||
      normalized.length > 200 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ||
      seen.has(normalized)
    ) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= MAX_RED_DEAD_COLLECTION_PROGRESS_ITEMS) break;
  }
  return result;
}

type RedDeadProgressRow = {
  collection_code?: unknown;
  checked_item_slugs?: unknown;
};

export async function loadUserRedDeadCollectionProgress(userId: string, collectionCode: string): Promise<string[]> {
  const normalizedCode = normalizeRedDeadCollectionCode(collectionCode);
  if (!normalizedCode) return [];

  const { data, error } = await supabaseAdmin()
    .from("user_red_dead_collection_progress")
    .select("checked_item_slugs")
    .eq("user_id", userId)
    .eq("collection_code", normalizedCode)
    .maybeSingle();

  if (error) throw error;
  return normalizeRedDeadCollectionItemSlugs((data as RedDeadProgressRow | null)?.checked_item_slugs);
}

export async function loadUserRedDeadCollectionProgressIndex(
  userId: string
): Promise<Array<{ code: string; checkedCount: number }>> {
  const { data, error } = await supabaseAdmin()
    .from("user_red_dead_collection_progress")
    .select("collection_code, checked_item_slugs")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? [])
    .map((row) => {
      const typed = row as RedDeadProgressRow;
      const code = normalizeRedDeadCollectionCode(typed.collection_code);
      return code
        ? { code, checkedCount: normalizeRedDeadCollectionItemSlugs(typed.checked_item_slugs).length }
        : null;
    })
    .filter((entry): entry is { code: string; checkedCount: number } => Boolean(entry));
}

export async function saveUserRedDeadCollectionProgress(
  userId: string,
  collectionCode: string,
  checkedSlugsInput: unknown
): Promise<string[]> {
  const normalizedCode = normalizeRedDeadCollectionCode(collectionCode);
  if (!normalizedCode) return [];
  const checkedSlugs = normalizeRedDeadCollectionItemSlugs(checkedSlugsInput);
  const admin = supabaseAdmin();

  if (checkedSlugs.length === 0) {
    const { error } = await admin
      .from("user_red_dead_collection_progress")
      .delete()
      .eq("user_id", userId)
      .eq("collection_code", normalizedCode);
    if (error) throw error;
    return [];
  }

  const { error } = await admin
    .from("user_red_dead_collection_progress")
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
