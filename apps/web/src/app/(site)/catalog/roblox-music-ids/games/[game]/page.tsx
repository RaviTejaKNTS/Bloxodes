import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { getMusicGameIdPage, musicGameCatalogCode, MUSIC_GAME_ID_PAGES } from "@/lib/game-specific-id-pages";
import { normalizeSearchQuery, normalizeSortKey } from "@/lib/music-ids-search";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { loadGameMusicIdsPageData } from "../../page-data";
import { buildMusicGameContentHtml, MUSIC_GAMES_PATH, renderMusicGamePage } from "../page-data";

export const revalidate = 21600;
type Props = { params: Promise<{ game: string }>; searchParams: Promise<{ q?: string; sort?: string }> };

export function generateStaticParams() {
  return MUSIC_GAME_ID_PAGES.map((game) => ({ game: game.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = getMusicGameIdPage((await params).game);
  if (!game) return {};
  const [catalog, pageData] = await Promise.all([
    getCatalogPageContentByCodes([musicGameCatalogCode(game.slug)]),
    loadGameMusicIdsPageData(1, game.slug, game.datasetPreset)
  ]);
  const title = pageData.total > 0
    ? `${game.title} [${pageData.total.toLocaleString("en-US")} ${game.seoCountLabel}]`
    : game.title;
  const description = catalog?.meta_description ?? game.description;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${MUSIC_GAMES_PATH}/${game.slug}`;
  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    openGraph: { type: "website", url: canonical, title, description, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title, description }
  };
}

export default async function MusicGamePage({ params, searchParams }: Props) {
  const game = getMusicGameIdPage((await params).game);
  if (!game) notFound();
  const filters = await searchParams;
  const [pageData, catalog] = await Promise.all([
    loadGameMusicIdsPageData(1, game.slug, game.datasetPreset, {
      search: normalizeSearchQuery(filters.q),
      sort: normalizeSortKey(filters.sort)
    }),
    getCatalogPageContentByCodes([musicGameCatalogCode(game.slug)])
  ]);
  return renderMusicGamePage({ game, ...pageData, currentPage: 1, contentHtml: await buildMusicGameContentHtml(catalog) });
}
