import type { Metadata } from "next";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import { buildMusicGameContentHtml, MUSIC_GAMES_PATH, renderMusicGamesHub } from "./page-data";

export const revalidate = 86400;
const CATALOG_CODE = "roblox-music-ids/games";
const FALLBACK_TITLE = "Game-Specific Roblox Music IDs";
const FALLBACK_DESCRIPTION = "Choose a Roblox game and find compatible music, radio, kill-sound, and custom-audio IDs.";

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCatalogPageContentByCodes([CATALOG_CODE]);
  const title = resolveSeoTitle(catalog?.seo_title) ?? catalog?.title ?? `${FALLBACK_TITLE} | ${SITE_NAME}`;
  const description = catalog?.meta_description ?? FALLBACK_DESCRIPTION;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${MUSIC_GAMES_PATH}`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: buildAlternates(canonical),
    openGraph: { type: "website", url: canonical, title, description, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title, description }
  };
}

export default async function MusicGamesPage() {
  const catalog = await getCatalogPageContentByCodes([CATALOG_CODE]);
  return renderMusicGamesHub({ contentHtml: await buildMusicGameContentHtml(catalog) });
}
