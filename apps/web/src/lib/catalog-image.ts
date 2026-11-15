import { SITE_URL } from "@/lib/seo";

export type CatalogImagePage = {
  code: string;
  thumb_url?: string | null;
};

/** Saved artwork overrides the generated cover in every consumer. */
export function resolveCatalogImage(page: CatalogImagePage): string {
  return page.thumb_url?.trim() || `${SITE_URL.replace(/\/$/, "")}/catalog-image/${page.code}.png`;
}

export function catalogImageType(code: string): "game" | "items" | "title" {
  if (/^roblox-(?:music|decal)-ids\/games\/[^/]+$/.test(code)) return "game";
  if (/^(?:roblox-items-and-bundles|roblox-decal-ids|free-roblox-items)(?:\/|$)/.test(code)) return "items";
  return "title";
}
