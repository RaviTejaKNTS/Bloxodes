import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import {
  buildRobloxMusicCatalogContentHtml,
  loadRobloxMusicIdsPageData,
  resolveMusicSearch,
  renderRobloxMusicIdsPage
} from "../../page-data";
import { CATALOG_DESCRIPTION, buildAlternates } from "@/lib/seo";
import { buildPageParams } from "@/lib/static-params";

export const revalidate = 0;

const CATALOG_CODE_CANDIDATES = ["roblox-music-ids"];
const MAX_STATIC_PAGES = 20;

type PageProps = {
  params: Promise<{ page: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  const title = pageNumber > 1 ? `Roblox Music IDs - Page ${pageNumber}` : "Roblox Music IDs";
  return {
    title,
    description: CATALOG_DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: buildAlternates(pageNumber === 1 ? "/catalog/roblox-music-ids" : `/catalog/roblox-music-ids/page/${pageNumber}`)
  };
}

export default async function RobloxMusicIdsPaginatedPage({ params, searchParams }: PageProps) {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }
  const search = await resolveMusicSearch(searchParams);

  const [pageData, catalog] = await Promise.all([
    loadRobloxMusicIdsPageData(pageNumber, search),
    getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES)
  ]);
  const { songs, total, totalPages } = pageData;
  const contentHtml = await buildRobloxMusicCatalogContentHtml(catalog);
  if (pageNumber > totalPages) {
    notFound();
  }

  return renderRobloxMusicIdsPage({
    songs,
    total,
    totalPages,
    currentPage: pageNumber,
    showHero: pageNumber === 1,
    contentHtml,
    search: search.search,
    sort: search.sort
  });
}
