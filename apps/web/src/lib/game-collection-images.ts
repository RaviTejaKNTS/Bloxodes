import "server-only";

import { publicContentCache } from "@/lib/public-content-cache";
import { getWikiCollectionPageByCode } from "@/lib/wiki-collections";
import { listPublishedWikiCollectionRuntimeImages } from "@/lib/wiki-collection-runtime";

const COLLECTION_IMAGES_REVALIDATE_SECONDS = 86400;

function normalizeCollectionCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\/+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function readCollectionImageUrls(code: string, limit: number): Promise<string[]> {
  const page = await getWikiCollectionPageByCode(code);
  if (!page) return [];

  const runtimeImages = await listPublishedWikiCollectionRuntimeImages(page, limit);
  if (runtimeImages === null) {
    throw new Error(`Required database runtime images for ${code} did not load. Local fallback is disabled.`);
  }
  return runtimeImages;
}

export async function listGameCollectionImageUrls(code: string, limit = 6): Promise<string[]> {
  const normalizedCode = normalizeCollectionCode(code);
  if (!normalizedCode) return [];

  const requestedLimit = Number.isFinite(limit) ? Math.floor(limit) : 6;
  const safeLimit = Math.max(1, Math.min(12, requestedLimit));
  const cached = publicContentCache(
    () => readCollectionImageUrls(normalizedCode, safeLimit),
    ["game-collection-images-v3", normalizedCode, String(safeLimit)],
    {
      revalidate: COLLECTION_IMAGES_REVALIDATE_SECONDS,
      tags: ["collection-index", `collection:${normalizedCode}`]
    }
  );

  return cached();
}
