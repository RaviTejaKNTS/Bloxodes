import type { Metadata } from "next";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import { buildDecalGameContentHtml, DECAL_GAMES_PATH, renderDecalGamesHub } from "./page-data";

export const revalidate = 86400;
const CATALOG_CODE = "roblox-decal-ids/games";
const FALLBACK_TITLE = "Game-Specific Roblox Decal IDs";
const FALLBACK_DESCRIPTION = "Choose a Roblox game and find image IDs for crosshairs, faces, pictures, billboards, and custom-image tools.";

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCatalogPageContentByCodes([CATALOG_CODE]);
  const title = resolveSeoTitle(catalog?.seo_title) ?? catalog?.title ?? `${FALLBACK_TITLE} | ${SITE_NAME}`;
  const description = catalog?.meta_description ?? FALLBACK_DESCRIPTION;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${DECAL_GAMES_PATH}`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: buildAlternates(canonical),
    openGraph: { type: "website", url: canonical, title, description, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title, description }
  };
}

export default async function DecalGamesPage() {
  const catalog = await getCatalogPageContentByCodes([CATALOG_CODE]);
  return renderDecalGamesHub({ contentHtml: await buildDecalGameContentHtml(catalog) });
}
