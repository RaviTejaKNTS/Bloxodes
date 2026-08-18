import "server-only";

import {
  AdminInputError,
  normalizeAdminRequiredText,
  normalizeAdminText,
  normalizeAdminUniverseId,
  normalizeAdminUrl
} from "@/lib/admin/http";
import { supabaseAdmin } from "@/lib/supabase";

export const CODE_PAGE_SOURCE_COLUMNS = [
  "source_url",
  "source_url_2",
  "source_url_3",
  "source_url_4",
  "source_url_5",
  "source_url_6",
  "source_url_7",
  "source_url_8",
  "source_url_9",
  "source_url_10"
] as const;

export const CODE_PAGE_MAX_SOURCES = CODE_PAGE_SOURCE_COLUMNS.length;

/** Every field the admin editor may send in a PATCH. */
export const CODE_PAGE_PATCH_FIELDS: ReadonlySet<string> = new Set([
  "name",
  "universe_id",
  "sources",
  "roblox_link",
  "community_link",
  "discord_link",
  "twitter_link",
  "youtube_link",
  "seo_title",
  "seo_description",
  "cover_image",
  "intro_md",
  "redeem_md",
  "find_codes_md",
  "troubleshoot_md",
  "rewards_md"
]);

/** URL-valued columns the admin editor may change. Values are normalized to http(s) URLs or null. */
export const CODE_PAGE_LINK_FIELDS = ["roblox_link", "community_link", "discord_link", "twitter_link", "youtube_link"] as const;

/** Free-text columns the admin editor may change. Empty strings are stored as null. */
export const CODE_PAGE_TEXT_FIELDS = [
  "seo_title",
  "seo_description",
  "cover_image",
  "intro_md",
  "redeem_md",
  "find_codes_md",
  "troubleshoot_md",
  "rewards_md"
] as const;

type LinkField = (typeof CODE_PAGE_LINK_FIELDS)[number];
type TextField = (typeof CODE_PAGE_TEXT_FIELDS)[number];
type SourceColumn = (typeof CODE_PAGE_SOURCE_COLUMNS)[number];

export type AdminCodePage = {
  id: string;
  slug: string;
  name: string;
  is_published: boolean;
  universe_id: number | null;
  /** Positional: index 0 is `source_url`, index 9 is `source_url_10`. Always length 10. */
  sources: Array<string | null>;
  updated_at: string;
} & Record<LinkField, string | null> &
  Record<TextField, string | null>;

export type AdminCodePagePatch = Partial<
  { name: string; universe_id: number | null; sources: Array<string | null> } & Record<LinkField, string | null> &
    Record<TextField, string | null>
>;

type CodePageRow = {
  id: string;
  slug: string;
  name: string;
  is_published: boolean;
  universe_id: number | null;
  updated_at: string;
} & Record<LinkField, string | null> &
  Record<TextField, string | null> &
  Record<SourceColumn, string | null>;

const SELECT_COLUMNS = [
  "id",
  "slug",
  "name",
  "is_published",
  "universe_id",
  "updated_at",
  ...CODE_PAGE_LINK_FIELDS,
  ...CODE_PAGE_TEXT_FIELDS,
  ...CODE_PAGE_SOURCE_COLUMNS
].join(",");

export function normalizeCodePageSlug(value: string): string {
  return value.trim().toLowerCase();
}

function toAdminCodePage(row: CodePageRow): AdminCodePage {
  const page = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    is_published: row.is_published,
    universe_id: row.universe_id,
    sources: CODE_PAGE_SOURCE_COLUMNS.map((column) => row[column] ?? null),
    updated_at: row.updated_at
  } as AdminCodePage;
  for (const field of CODE_PAGE_LINK_FIELDS) page[field] = row[field] ?? null;
  for (const field of CODE_PAGE_TEXT_FIELDS) page[field] = row[field] ?? null;
  return page;
}

export async function getAdminCodePage(slug: string): Promise<AdminCodePage | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages")
    .select(SELECT_COLUMNS)
    .eq("slug", normalizeCodePageSlug(slug))
    .maybeSingle<CodePageRow>();
  if (error) throw error;
  return data ? toAdminCodePage(data) : null;
}

/**
 * Builds the column update for a patch. Only fields present in the patch are
 * written. `sources` is positional: entry i writes `source_url_(i+1)`, and only
 * the provided prefix of slots is touched, so shorter arrays leave later slots as-is.
 */
export function buildAdminCodePageUpdate(patch: AdminCodePagePatch): Record<string, string | number | null> {
  const update: Record<string, string | number | null> = {};

  if (patch.name !== undefined) update.name = normalizeAdminRequiredText(patch.name, "name");
  if (patch.universe_id !== undefined) update.universe_id = normalizeAdminUniverseId(patch.universe_id);

  for (const field of CODE_PAGE_LINK_FIELDS) {
    if (patch[field] !== undefined) update[field] = normalizeAdminUrl(patch[field], field);
  }

  for (const field of CODE_PAGE_TEXT_FIELDS) {
    if (patch[field] !== undefined) update[field] = normalizeAdminText(patch[field], field);
  }

  if (patch.sources !== undefined) {
    if (!Array.isArray(patch.sources)) throw new AdminInputError("sources must be an array");
    if (patch.sources.length > CODE_PAGE_MAX_SOURCES) {
      throw new AdminInputError(`At most ${CODE_PAGE_MAX_SOURCES} sources are supported`);
    }
    patch.sources.forEach((value, index) => {
      update[CODE_PAGE_SOURCE_COLUMNS[index]] = normalizeAdminUrl(value, `Source ${index + 1}`);
    });
  }

  return update;
}

/** Applies a partial admin edit. Revalidation and `updated_at` are handled by `code_pages` triggers. */
export async function updateAdminCodePage(slug: string, patch: AdminCodePagePatch): Promise<AdminCodePage | null> {
  const update = buildAdminCodePageUpdate(patch);
  if (Object.keys(update).length === 0) return getAdminCodePage(slug);

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages")
    .update(update)
    .eq("slug", normalizeCodePageSlug(slug))
    .select(SELECT_COLUMNS)
    .maybeSingle<CodePageRow>();
  if (error) throw error;
  return data ? toAdminCodePage(data) : null;
}
