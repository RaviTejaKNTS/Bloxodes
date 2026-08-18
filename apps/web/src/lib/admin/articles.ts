import "server-only";

import {
  AdminInputError,
  normalizeAdminRequiredText,
  normalizeAdminText,
  normalizeAdminUniverseId,
  normalizeAdminUrl
} from "@/lib/admin/http";
import type { ArticleFaqEntry } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

export const ARTICLE_PATCH_FIELDS: ReadonlySet<string> = new Set([
  "title",
  "meta_description",
  "cover_image",
  "universe_id",
  "author_id",
  "content_md",
  "tags",
  "sources",
  "faq_json"
]);

export type AdminArticle = {
  id: string;
  slug: string;
  title: string;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
  word_count: number | null;
  meta_description: string | null;
  cover_image: string | null;
  universe_id: number | null;
  author_id: string | null;
  author_name: string | null;
  content_md: string;
  tags: string[];
  sources: string[];
  faq_json: ArticleFaqEntry[];
};

export type AdminArticlePatch = Partial<{
  title: string;
  meta_description: string | null;
  cover_image: string | null;
  universe_id: number | null;
  author_id: string | null;
  content_md: string;
  tags: string[];
  sources: string[];
  faq_json: ArticleFaqEntry[];
}>;

type ArticleRow = Omit<AdminArticle, "author_name" | "tags" | "sources" | "faq_json"> & {
  tags: string[] | null;
  sources: string[] | null;
  faq_json: unknown;
  author: { name: string | null } | { name: string | null }[] | null;
};

const SELECT_COLUMNS =
  "id,slug,title,is_published,published_at,updated_at,word_count,meta_description,cover_image,universe_id,author_id,content_md,tags,sources,faq_json,author:authors(name)";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mirrors `estimateWordCount` in scripts/articles/generate-articles.ts so admin edits keep `word_count` consistent. */
export function estimateArticleWordCount(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[#>*_\-\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(" ").length : 0;
}

function normalizeFaq(value: unknown): ArticleFaqEntry[] {
  if (!Array.isArray(value)) throw new AdminInputError("faq_json must be an array of {q, a}");
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") throw new AdminInputError(`FAQ ${index + 1} must be an object`);
      const q = typeof (entry as { q?: unknown }).q === "string" ? (entry as { q: string }).q.trim() : "";
      const a = typeof (entry as { a?: unknown }).a === "string" ? (entry as { a: string }).a.trim() : "";
      if ((q && !a) || (!q && a)) throw new AdminInputError(`FAQ ${index + 1} needs both a question and an answer`);
      return { q, a };
    })
    .filter((entry) => entry.q && entry.a);
}

function normalizeStringList(value: unknown, field: string, mapItem: (item: string, index: number) => string | null): string[] {
  if (!Array.isArray(value)) throw new AdminInputError(`${field} must be an array`);
  const items = value.map((item, index) => {
    if (typeof item !== "string") throw new AdminInputError(`${field} entries must be strings`);
    return mapItem(item, index);
  });
  return Array.from(new Set(items.filter((item): item is string => Boolean(item))));
}

function toAdminArticle(row: ArticleRow): AdminArticle {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    is_published: row.is_published,
    published_at: row.published_at,
    updated_at: row.updated_at,
    word_count: row.word_count,
    meta_description: row.meta_description,
    cover_image: row.cover_image,
    universe_id: row.universe_id,
    author_id: row.author_id,
    author_name: author?.name ?? null,
    content_md: row.content_md ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    sources: Array.isArray(row.sources) ? row.sources : [],
    faq_json: Array.isArray(row.faq_json)
      ? (row.faq_json as Array<{ q?: unknown; a?: unknown }>).map((entry) => ({
          q: typeof entry?.q === "string" ? entry.q : "",
          a: typeof entry?.a === "string" ? entry.a : ""
        }))
      : []
  };
}

export async function getAdminArticle(slug: string): Promise<AdminArticle | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("articles").select(SELECT_COLUMNS).eq("slug", slug.trim().toLowerCase()).maybeSingle<ArticleRow>();
  if (error) throw error;
  return data ? toAdminArticle(data) : null;
}

export function buildAdminArticleUpdate(patch: AdminArticlePatch): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (patch.title !== undefined) update.title = normalizeAdminRequiredText(patch.title, "title");
  if (patch.meta_description !== undefined) update.meta_description = normalizeAdminText(patch.meta_description, "meta_description");
  if (patch.cover_image !== undefined) update.cover_image = normalizeAdminText(patch.cover_image, "cover_image");
  if (patch.universe_id !== undefined) update.universe_id = normalizeAdminUniverseId(patch.universe_id);

  if (patch.author_id !== undefined) {
    const authorId = normalizeAdminText(patch.author_id, "author_id");
    if (authorId && !UUID_PATTERN.test(authorId)) throw new AdminInputError("author_id must be a UUID or empty");
    update.author_id = authorId;
  }

  if (patch.content_md !== undefined) {
    const content = normalizeAdminRequiredText(patch.content_md, "content_md");
    update.content_md = content;
    update.word_count = estimateArticleWordCount(content);
  }

  if (patch.tags !== undefined) {
    update.tags = normalizeStringList(patch.tags, "tags", (item) => item.trim().toLowerCase().replace(/\s+/g, "-") || null);
  }

  if (patch.sources !== undefined) {
    update.sources = normalizeStringList(patch.sources, "sources", (item, index) => normalizeAdminUrl(item, `Source ${index + 1}`));
  }

  if (patch.faq_json !== undefined) update.faq_json = normalizeFaq(patch.faq_json);

  return update;
}

/** Applies a partial admin edit. Revalidation and `updated_at` are handled by `articles` triggers. */
export async function updateAdminArticle(slug: string, patch: AdminArticlePatch): Promise<AdminArticle | null> {
  const update = buildAdminArticleUpdate(patch);
  if (Object.keys(update).length === 0) return getAdminArticle(slug);

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("articles")
    .update(update)
    .eq("slug", slug.trim().toLowerCase())
    .select(SELECT_COLUMNS)
    .maybeSingle<ArticleRow>();
  if (error) throw error;
  return data ? toAdminArticle(data) : null;
}
