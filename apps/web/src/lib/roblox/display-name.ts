function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const EMOJI_PATTERN = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu;
const EMOJI_DETECT_PATTERN = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/u;
const VERSION_PATTERN = /\bv\d+(?:\.\d+){1,3}\b/gi;
const VERSION_DETECT_PATTERN = /\bv\d+(?:\.\d+){1,3}\b/i;

function removeEmoji(value: string): string {
  return value.replace(EMOJI_PATTERN, " ");
}

export function cleanRobloxUniverseDisplayName(value?: string | null): string | null {
  if (!value) return null;

  let result = value;
  result = removeEmoji(result);
  result = result.replace(/[\[\{][^\]\}]{0,80}[\]\}]/g, " ");
  result = result.replace(/\([^)]{0,80}\)/g, " ");
  result = result.replace(VERSION_PATTERN, " ");
  result = result.replace(/[\[\]{}]/g, " ");
  result = result.replace(/\s+([!?.,:;])/g, "$1");
  result = result.replace(/([!?.,:;]){2,}/g, "$1");
  result = result.replace(/^[\s!?.,:;|/_-]+|[\s!?.,:;|/_-]+$/g, "");
  result = normalizeWhitespace(result);

  return result || null;
}

export function isDirtyRobloxUniverseDisplayName(value?: string | null): boolean {
  const normalized = typeof value === "string" ? normalizeWhitespace(value) : "";
  if (!normalized) return false;
  if (EMOJI_DETECT_PATTERN.test(normalized)) return true;
  if (VERSION_DETECT_PATTERN.test(normalized)) return true;
  if (/[\[\]{}()]/.test(normalized)) return true;
  return false;
}
