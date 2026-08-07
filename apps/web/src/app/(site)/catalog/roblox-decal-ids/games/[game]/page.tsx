import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { getDecalGameIdPage, decalGameCatalogCode, DECAL_GAME_ID_PAGES } from "@/lib/game-specific-id-pages";
import { normalizeSearchQuery, normalizeSortKey } from "@/lib/decal-ids-search";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import { loadGameDecalIdsPageData } from "../../page-data";
import { buildDecalGameContentHtml, DECAL_GAMES_PATH, renderDecalGamePage } from "../page-data";

export const revalidate = 21600;
type Props = { params: Promise<{ game: string }>; searchParams: Promise<{ q?: string; sort?: string }> };

export function generateStaticParams() {
  return DECAL_GAME_ID_PAGES.map((game) => ({ game: game.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = getDecalGameIdPage((await params).game);
  if (!game) return {};
  const catalog = await getCatalogPageContentByCodes([decalGameCatalogCode(game.slug)]);
  const title = resolveSeoTitle(catalog?.seo_title) ?? catalog?.title ?? `${game.title} | ${SITE_NAME}`;
  const description = catalog?.meta_description ?? game.description;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${DECAL_GAMES_PATH}/${game.slug}`;
  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    openGraph: { type: "website", url: canonical, title, description, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title, description }
  };
}

export default async function DecalGamePage({ params, searchParams }: Props) {
  const game = getDecalGameIdPage((await params).game);
  if (!game) notFound();
  const filters = await searchParams;
  const [pageData, catalog] = await Promise.all([
    loadGameDecalIdsPageData(1, game.slug, game.datasetPreset, {
      search: normalizeSearchQuery(filters.q),
      sort: normalizeSortKey(filters.sort)
    }),
    getCatalogPageContentByCodes([decalGameCatalogCode(game.slug)])
  ]);
  return renderDecalGamePage({ game, ...pageData, currentPage: 1, contentHtml: await buildDecalGameContentHtml(catalog) });
}
