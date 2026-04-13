function normalizeText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatAgeRating(value?: string | null): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const upper = normalized.toUpperCase();
  if (upper === "AGE_RATING_UNSPECIFIED") return "9+";

  if (["AGE_RATING_ALL", "AGE_RATING_ALL_AGES", "ALL_AGES", "ALL AGES"].includes(upper)) {
    return "All ages";
  }

  const plusMatch = upper.match(/(\d+)\s*(?:_PLUS|\+)/);
  if (plusMatch) return `${plusMatch[1]}+`;

  return titleCase(upper.replace(/^AGE_RATING_/, ""));
}
