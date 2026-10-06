import { gameDatabase } from "@/lib/game-content-db";
import "server-only";
import { createGameReader } from "./shared-game-reader";
import type { SharedGameWikiCollectionPage as MinecraftWikiCollectionPage } from "./shared-game-reader";
import type { PublishedSharedGameCollectionRuntime as PublishedMinecraftCollectionRuntime } from "./shared-game-reader";
import { publicContentCache } from "./public-content-cache";
import { supabaseAdmin } from "./supabase";
import { resolveWikiMediaUrl } from "./wiki-media";
import { validateMinecraftToolRules } from "./minecraft-tools/validate";
import { getMinecraftToolCover } from "./minecraft-tools/covers";
import { summarizeMinecraftCollectionEditions, type MinecraftCollectionEditionSummary } from "./minecraft-edition";
export { buildMinecraftCollectionPath, buildMinecraftWikiPath } from "./minecraft-paths";
const REVALIDATE_SECONDS = 3600;
const BYPASS_CACHE = process.env.NODE_ENV === "development";
function normalizeSlug(value: string) { return value.trim().toLowerCase(); }
const reader = createGameReader("minecraft");
export const resolveMinecraftWikiCoverImage = reader.resolveSharedGameWikiCoverImage;
export const resolveMinecraftWikiThumbnailImage = reader.resolveSharedGameWikiThumbnailImage;
export const listPublishedMinecraftGames = reader.listPublishedSharedGameGames;
export const getMinecraftGameBySlug = reader.getSharedGameGameBySlug;
export const listPublishedMinecraftWikiPages = reader.listPublishedSharedGameWikiPages;
export const getMinecraftWikiPageBySlug = reader.getSharedGameWikiPageBySlug;
export const getMinecraftWikiCollectionPageByPath = reader.getSharedGameWikiCollectionPageByPath;
export const listPublishedMinecraftWikiCollectionsByWikiSlug = reader.listPublishedSharedGameWikiCollectionsByWikiSlug;
export const listPublishedMinecraftWikiCollections = reader.listPublishedSharedGameWikiCollections;
export const listPublishedMinecraftWikiCollectionImageUrls = reader.listPublishedSharedGameWikiCollectionImageUrls;
export const getPublishedMinecraftWikiCollectionRuntime = reader.getPublishedSharedGameWikiCollectionRuntime;
export type { SharedGameGame as MinecraftGame } from "./shared-game-reader";
export type { SharedGameWikiPage as MinecraftWikiPage } from "./shared-game-reader";
export type { SharedGameWikiListEntry as MinecraftWikiListEntry } from "./shared-game-reader";
export type { SharedGameWikiCollectionPage as MinecraftWikiCollectionPage } from "./shared-game-reader";
export type { SharedGameCollectionDatasetDocument as MinecraftCollectionDatasetDocument } from "./shared-game-reader";
export type { PublishedSharedGameCollectionRuntime as PublishedMinecraftCollectionRuntime } from "./shared-game-reader";
async function withCache<T>(key: string[], tags: string[], loader: () => Promise<T>): Promise<T> {
  if (BYPASS_CACHE) return loader();
  return publicContentCache(loader, key, { revalidate: REVALIDATE_SECONDS, tags })();
}
/** Read only edition membership and images from the same immutable revision as the collection page. */
export async function getPublishedMinecraftWikiCollectionEditionSummary(
  page: MinecraftWikiCollectionPage
): Promise<MinecraftCollectionEditionSummary> {
  if (!page.published_dataset_id) throw new Error(`Minecraft collection ${page.code} has no published revision.`);
  return withCache(
    ["minecraft-wiki-collection-edition-summary-v1", page.code, page.published_dataset_id],
    ["minecraft-wiki-collection-index", `minecraft-wiki:${page.wiki_slug}`, `minecraft-wiki-collection:${page.collection_slug}`],
    async () => {
      const rows: Array<{ editions: unknown; image_key: string | null }> = [];
      const supabase = supabaseAdmin();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await gameDatabase(supabase, "minecraft").from("wiki_collection_items")
          .select("editions:fields_json->editions, image_key")
          .eq("dataset_id", page.published_dataset_id)
          .order("sort_order", { ascending: true })
          .order("item_slug", { ascending: true })
          .range(from, from + 999);
        if (error) throw new Error(`Could not load edition counts for ${page.code}: ${error.message}`);
        const chunk = (data ?? []) as typeof rows;
        rows.push(...chunk);
        if (chunk.length < 1000) break;
      }
      if (rows.length !== page.item_count) throw new Error(`Minecraft collection ${page.code} expected ${page.item_count} summary rows and loaded ${rows.length}.`);
      return summarizeMinecraftCollectionEditions(rows.map(row => ({ editions: row.editions, image: resolveWikiMediaUrl(row.image_key) })));
    }
  );
}

export type MinecraftEdition = "java" | "bedrock";
export type MinecraftToolPage = import("@/lib/tools").ToolContent & {
  id: string;
  slug: string;
  tool_key: string;
  rules_json: Record<string, unknown>;
  description_md?: string | null;
};

export async function getMinecraftTool(slug: string): Promise<MinecraftToolPage | null> {
  const normalized = normalizeSlug(slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return null;
  return withCache(["minecraft-tool-v1", normalized], ["minecraft-tools-index", `minecraft-tool:${normalized}`], async () => {
    const { data, error } = await gameDatabase(supabaseAdmin(), "minecraft").from("tools_view").select("*").eq("slug", normalized).eq("is_published", true).maybeSingle();
    if (error) throw new Error(`Minecraft tool read failed: ${error.message}`);
    if (data) {
      if (data.tool_key !== normalized) throw new Error("Minecraft tool ownership does not match its route.");
      validateMinecraftToolRules(data.tool_key, data.rules_json);
    }
    return data ? { ...data, thumb_url: getMinecraftToolCover(normalized) ?? data.thumb_url } as MinecraftToolPage : null;
  });
}

export async function listMinecraftTools(): Promise<MinecraftToolPage[]> {
  return withCache(["minecraft-tools-index-v1"], ["minecraft-tools-index"], async () => {
    const { data, error } = await gameDatabase(supabaseAdmin(), "minecraft").from("tools_view").select("*").eq("is_published", true).order("title");
    if (error) throw new Error(`Minecraft tool directory read failed: ${error.message}`);
    return (data ?? []).map(tool => ({ ...tool, thumb_url: getMinecraftToolCover(tool.slug) ?? tool.thumb_url })) as MinecraftToolPage[];
  });
}

export const getMinecraftToolBySlug = getMinecraftTool;
export const listPublishedMinecraftTools = listMinecraftTools;
export function getMinecraftWiki() { return getMinecraftWikiPageBySlug("minecraft"); }
export function listPublishedMinecraftCollections() { return Promise.all([listPublishedMinecraftWikiCollectionsByWikiSlug("minecraft-java"), listPublishedMinecraftWikiCollectionsByWikiSlug("minecraft-bedrock")]).then(groups => groups.flat()); }
export function getMinecraftCollectionBySlug(slug: string) { return getMinecraftWikiCollectionPageByPath("minecraft", slug); }
export const getPublishedMinecraftCollectionRuntime = getPublishedMinecraftWikiCollectionRuntime;
export type MinecraftCollectionPage = MinecraftWikiCollectionPage;

export async function getMinecraftToolData(collectionSlugs: string[]): Promise<Record<string, PublishedMinecraftCollectionRuntime>> {
  const pairs = await Promise.all([...new Set(collectionSlugs)].map(async (slug) => {
    const page = await getMinecraftCollectionBySlug(slug);
    if (!page) throw new Error(`Required Minecraft collection ${slug} is not published.`);
    const runtime = await getPublishedMinecraftCollectionRuntime(page);
    if (!runtime) throw new Error(`Required Minecraft collection ${slug} has no published runtime.`);
    return [slug, runtime] as const;
  }));
  return Object.fromEntries(pairs);
}
