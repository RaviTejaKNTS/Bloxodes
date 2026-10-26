import { catalogIdTitle } from "@/lib/catalog-id-title";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MUSIC_IDS_PAGE_SIZE } from "@/lib/catalog-page-sizes";
import { isCatalogPageRangeValid } from "@/lib/catalog-pagination";
import "@/styles/article-content.css";
import { getMusicGameIdPage } from "@/lib/game-specific-id-pages";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { loadGameMusicIdsPageData } from "../../../../page-data";
import { MUSIC_GAMES_PATH, renderMusicGamePage } from "../../../page-data";

export const revalidate = 21600;
type Props = {
  params: Promise<{ game: string; page: string }>;
};

export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const values = await params;
  const game = getMusicGameIdPage(values.game);
  const page = Number.parseInt(values.page, 10);
  if (!game || !Number.isFinite(page) || page < 2) return {};
  const title = catalogIdTitle(`${game.title} - Page ${page}`);
  const canonical = `${SITE_URL.replace(/\/$/, "")}${MUSIC_GAMES_PATH}/${game.slug}/page/${page}`;
  return {
    title: catalogIdTitle(`${title} | ${SITE_NAME}`),
    description: game.description,
    robots: { index: false, follow: true },
    alternates: buildAlternates(canonical)
  };
}

export default async function PaginatedMusicGamePage({ params }: Props) {
  const values = await params;
  if (!/^\d+$/.test(values.page)) notFound();
  const game = getMusicGameIdPage(values.game);
  const page = Number.parseInt(values.page, 10);
  if (!game || page < 2 || !isCatalogPageRangeValid(page, MUSIC_IDS_PAGE_SIZE)) notFound();
  const pageData = await loadGameMusicIdsPageData(page, game.slug, game.datasetPreset);
  if (page > pageData.totalPages) notFound();
  return renderMusicGamePage({ game, ...pageData, currentPage: page, contentHtml: null });
}
