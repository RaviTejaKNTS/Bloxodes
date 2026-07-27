import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export const MAX_USED_CODES = 1000;
export const MAX_CODE_VALUE_LENGTH = 200;

export function normalizeCodeProgressSlug(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return "";
  return trimmed;
}

export function normalizeCodeProgressValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_CODE_VALUE_LENGTH) return "";
  return trimmed;
}

export function normalizeUsedCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const normalized = normalizeCodeProgressValue(entry);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= MAX_USED_CODES) break;
  }

  return result;
}

export async function loadUserCodeProgress(userId: string, gameSlug: string): Promise<string[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("user_code_progress")
    .select("used_code_ids")
    .eq("user_id", userId)
    .eq("game_slug", gameSlug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeUsedCodes((data as { used_code_ids?: unknown } | null)?.used_code_ids);
}

export async function saveUserCodeProgress(
  userId: string,
  gameSlug: string,
  usedCodesInput: unknown
): Promise<string[]> {
  const usedCodes = normalizeUsedCodes(usedCodesInput);
  const admin = supabaseAdmin();

  if (usedCodes.length === 0) {
    const { error } = await admin
      .from("user_code_progress")
      .delete()
      .eq("user_id", userId)
      .eq("game_slug", gameSlug);

    if (error) {
      throw error;
    }

    return [];
  }

  const { error } = await admin
    .from("user_code_progress")
    .upsert(
      {
        user_id: userId,
        game_slug: gameSlug,
        used_code_ids: usedCodes
      },
      { onConflict: "user_id,game_slug" }
    );

  if (error) {
    throw error;
  }

  return usedCodes;
}

export async function updateUserCodeProgress(params: {
  userId: string;
  gameSlug: string;
  code: string;
  used: boolean;
}): Promise<string[]> {
  const current = await loadUserCodeProgress(params.userId, params.gameSlug);
  const next = new Set(current);

  if (params.used) {
    next.add(params.code);
  } else {
    next.delete(params.code);
  }

  return saveUserCodeProgress(params.userId, params.gameSlug, Array.from(next));
}
