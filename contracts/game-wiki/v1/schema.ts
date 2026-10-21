import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = z.string().trim().min(1);
const missingImages = z.array(z.object({ slug, reason: text }).strict());
const game = z.object({ slug, name: text, kind: z.enum(["franchise", "game"]), parent: slug.optional() }).strict();

export const bundleSchema = z.object({
  contract: z.literal("game-wiki@1"),
  namespace: slug,
  game,
  hub: z.object({ finalJson: z.literal("wiki/final.json") }).strict().optional(),
  collections: z.array(z.object({ manifest: text, missingImages: missingImages.optional() }).strict()).optional()
}).strict();

// Keep the franchise writers' existing names. UUIDs from exports are accepted as
// hints only; the publisher always resolves target rows by natural key.
export const gameSchema = z.object({
  slug, title: text, kind: z.enum(["franchise", "game"]).optional(), parent_slug: slug.nullable().optional(),
  id: z.string().uuid().optional(), namespace: slug.optional(), parent_id: z.string().uuid().nullable().optional(),
  short_title: z.string().nullable().optional(), installment: z.string().nullable().optional(),
  content_kind: z.enum(["game", "expansion", "online"]).optional(),
  developer: z.string().nullable().optional(), publisher: z.string().nullable().optional(),
  description_md: z.string().nullable().optional(), official_url: z.union([z.string().url().startsWith("https://"), z.literal(""), z.null()]).optional(),
  release_dates_json: z.record(z.string(), z.unknown()).optional(), platforms_json: z.array(z.unknown()).optional(),
  status: z.enum(["announced", "upcoming", "released"]), cover_image: text, hero_image: text,
  is_published: z.literal(true).optional()
}).strict();

export const hubFinalSchema = z.object({
  game_slug: slug, slug, title: text, seo_title: text, meta_description: text,
  description_md: text, tips_md: z.string(), controls_json: z.array(z.record(z.string(), z.string())),
  cover_image: z.string().nullable().optional(), is_published: z.literal(true).optional(),
  id: z.string().uuid().optional(), game_id: z.string().uuid().optional(), namespace: slug.optional(), canonical_path: text.optional()
}).strict();

export const runtimeManifestSchema = z.object({
  schemaVersion: z.literal(1), namespace: slug.optional(),
  game: z.object({ slug, name: text }).strict(),
  collection: z.object({ slug, label: text, sortOrder: z.number().int().optional(), pageType: z.enum(["database", "collectible"]) }).strict(),
  route: text.optional(), dataset: z.literal("dataset.json"), finalJson: z.literal("final.json"), mediaRoot: z.literal("media"),
  sourceUrls: z.array(z.string().url().startsWith("https://")).min(1), missingImages: missingImages.optional()
}).strict();

export const collectionFinalSchema = z.object({
  wiki_slug: slug, collection_slug: slug, code: slug, display_name: text, title: text, seo_title: text, meta_description: text,
  intro_md: text, description_md: text, how_it_works_md: z.literal("").nullable().optional(),
  description_json: z.record(z.string(), z.string()), faq_json: z.array(z.object({ q: text, a: text }).strict()), wiki_md: text,
  wiki_sort_order: z.number().int().optional(), thumb_url: z.string().nullable().optional(), schema_ld_json: z.record(z.string(), z.unknown()).nullable().optional(),
  is_published: z.literal(true).optional(), id: z.string().uuid().optional(), game_id: z.string().uuid().optional(),
  wiki_page_id: z.string().uuid().optional(), namespace: slug.optional(), canonical_path: text.optional()
}).strict();

export type GameWikiBundle = z.infer<typeof bundleSchema>;
export const bundleJsonSchema = z.toJSONSchema(bundleSchema);
export const gameJsonSchema = z.toJSONSchema(gameSchema);
export const hubFinalJsonSchema = z.toJSONSchema(hubFinalSchema);
export const runtimeManifestJsonSchema = z.toJSONSchema(runtimeManifestSchema);
export const collectionFinalJsonSchema = z.toJSONSchema(collectionFinalSchema);
