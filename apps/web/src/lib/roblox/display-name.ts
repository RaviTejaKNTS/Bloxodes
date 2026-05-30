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

function isMetadataTag(value: string): boolean {
  const normalized = normalizeWhitespace(removeEmoji(value))
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ");
  const compact = normalizeWhitespace(normalized);
  if (!compact) return true;
  if (/^\d+(?:\.\d+){0,3}$/.test(compact)) return true;
  if (/^(?:x\d+|\d+x)$/.test(compact)) return true;
  return /^(?:upd|update|updates|new|event|events|code|codes|free|sale|beta|alpha|wip|vip|limited|admin)$/.test(
    compact
  );
}

function cleanBracketGroup(match: string, inner: string): string {
  const cleanedInner = normalizeWhitespace(removeEmoji(inner).replace(VERSION_PATTERN, " "));
  if (!cleanedInner || isMetadataTag(cleanedInner)) return " ";
  return ` ${cleanedInner} `;
}

function cleanParentheticalMetadata(match: string, inner: string): string {
  return isMetadataTag(inner) ? " " : match;
}

export function cleanRobloxUniverseDisplayName(value?: string | null): string | null {
  if (!value) return null;

  let result = value;
  result = removeEmoji(result);
  result = result.replace(/[\[\{]([^\]\}]{0,80})[\]\}]/g, cleanBracketGroup);
  result = result.replace(/\(([^)]{0,80})\)/g, cleanParentheticalMetadata);
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
  if (/[\[\]{}]/.test(normalized)) return true;
  const parentheticalMatches = normalized.matchAll(/\(([^)]{0,80})\)/g);
  for (const match of parentheticalMatches) {
    if (isMetadataTag(match[1] ?? "")) return true;
  }
  return false;
}
