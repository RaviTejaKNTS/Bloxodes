import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { getDecalGameIdPage } from "@/lib/game-specific-id-pages";
import { normalizeSearchQuery, normalizeSortKey } from "@/lib/decal-ids-search";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { loadGameDecalIdsPageData } from "../../../../page-data";
import { DECAL_GAMES_PATH, renderDecalGamePage } from "../../../page-data";

export const revalidate = 21600;
type Props = { params: Promise<{ game: string; page: string }>; searchParams: Promise<{ q?: string; sort?: string }> };
export function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const values = await params;
  const game = getDecalGameIdPage(values.game);
  const page = Number.parseInt(values.page, 10);
  if (!game || !Number.isFinite(page) || page < 2) return {};
  const title = `${game.title} - Page ${page}`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${DECAL_GAMES_PATH}/${game.slug}/page/${page}`;
  return {
    title: `${title} | ${SITE_NAME}`,
    description: game.description,
    robots: { index: false, follow: true },
    alternates: buildAlternates(canonical)
  };
}

export default async function PaginatedDecalGamePage({ params, searchParams }: Props) {
  const values = await params;
  if (!/^\d+$/.test(values.page)) notFound();
  const game = getDecalGameIdPage(values.game);
  const page = Number.parseInt(values.page, 10);
  if (!game || page < 2) notFound();
  const filters = await searchParams;
  const pageData = await loadGameDecalIdsPageData(page, game.slug, game.datasetPreset, {
    search: normalizeSearchQuery(filters.q),
    sort: normalizeSortKey(filters.sort)
  });
  if (page > pageData.totalPages) notFound();
  return renderDecalGamePage({ game, ...pageData, currentPage: page, contentHtml: null });
}
