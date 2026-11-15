import { cache } from "react";
import { getMusicGameIdPage, getDecalGameIdPage } from "@/lib/game-specific-id-pages";
import { resolveAvatarCatalogConfig, resolveAvatarCatalogTopLevelConfig, listAvatarCatalogItems } from "@/lib/roblox-avatar-catalog";

export type CatalogPreviewData = { count?: number; images?: string[] };
const thumbnails = (items: { thumbnail_url?: string | null }[]) =>
  items.slice(0, 6).flatMap(item => item.thumbnail_url ? [item.thumbnail_url] : []);

/** Reuse the page readers, including their eligibility rules and failure behavior. */
export const loadCatalogPreviewData = cache(async (code: string, page = 1, withImages = false): Promise<CatalogPreviewData> => {
  if (code === "roblox-decal-ids" || code === "roblox-decal-ids/curated" || code.startsWith("roblox-decal-ids/games/")) {
    const { loadRobloxDecalIdsPageData, loadGameDecalIdsPageData, CURATED_DECAL_OPTIONS } = await import("@/app/(site)/catalog/roblox-decal-ids/page-data");
    const game = getDecalGameIdPage(code.split("/")[2] ?? "");
    const data = game ? await loadGameDecalIdsPageData(page, game.slug, game.datasetPreset)
      : code.endsWith("/curated") ? await loadRobloxDecalIdsPageData(page, undefined, CURATED_DECAL_OPTIONS)
      : await loadRobloxDecalIdsPageData(page);
    return { count: data.total, images: withImages ? thumbnails(data.decals) : undefined };
  }
  if (code === "roblox-music-ids" || code === "roblox-music-ids/trending" || code.startsWith("roblox-music-ids/games/")) {
    const { loadRobloxMusicIdsPageData, loadGameMusicIdsPageData, loadMusicChartPageData } = await import("@/app/(site)/catalog/roblox-music-ids/page-data");
    const game = getMusicGameIdPage(code.split("/")[2] ?? "");
    const data = game ? await loadGameMusicIdsPageData(page, game.slug, game.datasetPreset)
      : code.endsWith("/trending") ? await loadMusicChartPageData("trending", page)
      : await loadRobloxMusicIdsPageData(page);
    return { count: data.total };
  }
  if (code === "roblox-mesh-ids") {
    const { loadRobloxMeshIdsPageData } = await import("@/lib/roblox-mesh-ids");
    return { count: (await loadRobloxMeshIdsPageData(page)).total };
  }
  if (code === "roblox-font-ids") {
    const { listRobloxFontIds } = await import("@/lib/roblox-font-ids");
    return { count: (await listRobloxFontIds()).length };
  }
  if (/^free-roblox-items(?:\/|$)/.test(code)) {
    const { loadFreeItemsPageData, loadFreeItemCategoryBySlug, loadFreeItemSubcategoryBySlug } = await import("@/app/(site)/catalog/free-roblox-items/page-data");
    const [, categorySlug, subcategorySlug] = code.split("/");
    const category = categorySlug ? await loadFreeItemCategoryBySlug(categorySlug) : null;
    if (categorySlug && !category) return {};
    const subcategory = category && subcategorySlug ? await loadFreeItemSubcategoryBySlug(category.label, subcategorySlug) : null;
    if (subcategorySlug && !subcategory) return {};
    const data = category ? await loadFreeItemsPageData(page, { category: category.label, ...(subcategory ? { subcategory: subcategory.label } : {}) }) : await loadFreeItemsPageData(page);
    return { count: data.total, images: withImages ? thumbnails(data.items) : undefined };
  }
  if (code === "roblox-dictionary") {
    const { loadRobloxDictionaryData } = await import("@/app/(site)/catalog/roblox-dictionary/page-data");
    return { count: (await loadRobloxDictionaryData()).items.length };
  }
  if (code === "roblox-errors-and-fixes") {
    const { loadRobloxErrorsPageData } = await import("@/app/(site)/catalog/roblox-errors-and-fixes/page-data");
    return { count: (await loadRobloxErrorsPageData()).items.length };
  }
  if (withImages && code === "roblox-emote-commands") {
    const { listRobloxEmoteCommands } = await import("@/lib/roblox-emote-commands");
    return { count: (await listRobloxEmoteCommands()).length };
  }
  if (withImages && code === "roblox-promo-codes") {
    const { loadPromoRewards } = await import("@/app/(site)/catalog/roblox-promo-codes/page-data");
    return { count: (await loadPromoRewards()).items.length };
  }
  if (withImages && code === "admin-commands") {
    const { loadAdminCommandDatasets } = await import("@/lib/admin-commands");
    return { count: (await loadAdminCommandDatasets()).reduce((total, dataset) => total + dataset.commandCount, 0) };
  }
  if (code.startsWith("admin-commands/")) {
    const { loadAdminCommandDataset } = await import("@/lib/admin-commands");
    return { count: (await loadAdminCommandDataset(code.split("/")[1]))?.commandCount };
  }
  if (withImages && code.startsWith("roblox-items-and-bundles")) {
    const parts = code.split("/");
    const config = resolveAvatarCatalogTopLevelConfig(code) ?? resolveAvatarCatalogConfig(parts.slice(0, -1).join("/"), parts[parts.length - 1]);
    if (config) {
      const data = await listAvatarCatalogItems(config, 1, 6, { search: "", sort: "featured", sale: "all", creator: "all" });
      return { count: data.total, images: thumbnails(data.items) };
    }
  }
  return {};
});
