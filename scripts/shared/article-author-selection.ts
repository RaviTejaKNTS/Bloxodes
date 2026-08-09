export type ArticleAuthorCandidate = {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
};

const EXCLUDED_AUTHOR_SLUGS = new Set(["ravi-teja-knts"]);
const EXCLUDED_AUTHOR_NAMES = new Set(["ravi teja knts"]);

function normalizeAuthorText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

export function eligibleArticleAuthorIds(authors: ArticleAuthorCandidate[]): string[] {
  const ids = new Set<string>();

  for (const author of authors) {
    const id = typeof author.id === "string" ? author.id.trim() : "";
    if (!id) continue;

    const slug = normalizeAuthorText(author.slug);
    const name = normalizeAuthorText(author.name);
    if (EXCLUDED_AUTHOR_SLUGS.has(slug) || EXCLUDED_AUTHOR_NAMES.has(name)) continue;

    ids.add(id);
  }

  return [...ids];
}

export function pickEligibleArticleAuthorId(
  authors: ArticleAuthorCandidate[],
  options: { preferredAuthorId?: string | null; random?: () => number } = {}
): string {
  const eligibleIds = eligibleArticleAuthorIds(authors);
  if (!eligibleIds.length) {
    throw new Error("No eligible article authors are available after excluding Ravi Teja KNTS.");
  }

  const preferredAuthorId = options.preferredAuthorId?.trim();
  if (preferredAuthorId && eligibleIds.includes(preferredAuthorId)) return preferredAuthorId;

  const random = options.random ?? Math.random;
  const index = Math.min(eligibleIds.length - 1, Math.floor(random() * eligibleIds.length));
  return eligibleIds[index];
}
