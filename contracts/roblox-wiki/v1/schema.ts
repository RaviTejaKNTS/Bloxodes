import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = z.string().trim().min(1);
const file = text;
const missingImages = z.array(z.object({ slug, reason: text }).strict());
const game = z.object({
  slug,
  name: text,
  universeId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  universeNames: z.array(text).min(1),
  sortOrder: z.number().int().optional()
}).strict();

export const bundleSchema = z.object({
  contract: z.literal("roblox-wiki@1"),
  game,
  hub: z.object({ finalJson: file, coverImage: file.optional() }).strict().optional(),
  collections: z.array(z.object({
    manifest: file,
    missingImages: missingImages.optional()
  }).strict()).optional()
}).strict();

export const runtimeManifestSchema = z.object({
  schemaVersion: z.literal(1),
  game: game.omit({ universeNames: true, sortOrder: true }),
  collection: z.object({
    slug,
    label: text,
    sortOrder: z.number().int().optional(),
    pageType: z.enum(["database", "collectible"])
  }).strict(),
  dataset: file,
  finalJson: file,
  mediaRoot: file,
  sourceUrls: z.array(z.string().url().startsWith("https://")).min(1),
  missingImages: missingImages.optional()
}).strict();

export const hubFinalSchema = z.object({
  universe_id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  slug,
  title: z.string().min(4),
  seo_title: z.string().min(4),
  meta_description: z.string().min(60),
  description_md: z.string().min(200),
  tips_md: z.string().min(80),
  controls_json: z.array(z.record(z.string(), z.string())),
  cover_image: z.null().optional(),
  is_published: z.boolean().optional()
}).passthrough();

export const collectionFinalSchema = z.object({
  universe_id: z.number().int().positive(),
  wiki_slug: slug,
  collection_slug: slug,
  code: slug,
  title: text,
  display_name: text,
  seo_title: text,
  meta_description: text,
  intro_md: text,
  description_md: text,
  how_it_works_md: z.literal("").nullable().optional(),
  description_json: z.record(z.string(), z.string()),
  faq_json: z.array(z.object({ q: text, a: text })),
  wiki_md: text,
  wiki_sort_order: z.number().int().optional(),
  thumb_url: z.string().nullable().optional(),
  is_published: z.boolean().optional()
}).passthrough();

export type RobloxWikiBundle = z.infer<typeof bundleSchema>;
export const bundleJsonSchema = z.toJSONSchema(bundleSchema);
export const runtimeManifestJsonSchema = z.toJSONSchema(runtimeManifestSchema);
export const collectionFinalJsonSchema = z.toJSONSchema(collectionFinalSchema);
export const hubFinalJsonSchema = z.toJSONSchema(hubFinalSchema);
