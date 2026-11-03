export const MAX_GAME_COLLECTION_PROGRESS_ITEMS = 2000;
export const MAX_GAME_COLLECTION_CODE_LENGTH = 200;

export function normalizeGameCollectionCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > MAX_GAME_COLLECTION_CODE_LENGTH) return "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(normalized)) return "";
  return normalized;
}

export function normalizeGameCollectionItemSlugs(value: unknown): string[] {
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
    if (result.length >= MAX_GAME_COLLECTION_PROGRESS_ITEMS) break;
  }
  return result;
}

