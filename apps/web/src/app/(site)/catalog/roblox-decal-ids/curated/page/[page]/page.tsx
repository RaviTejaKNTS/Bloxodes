import type { Metadata } from "next";
import "@/styles/article-content.css";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import {
  buildDecalCuratedPath,
  buildRobloxDecalCatalogContentHtml,
  loadRobloxDecalIdsPageData,
  resolveDecalSearch,
  renderRobloxDecalIdsPage
} from "../../../page-data";

export const revalidate = 21600;

const CATALOG_CODE_CANDIDATES = ["roblox-decal-ids"];
const TITLE = "Curated Roblox Decal IDs";
const DESCRIPTION = "Browse the best Roblox decal IDs from curated lists, strong Roblox ratings, useful categories, and verified image previews.";

type PageProps = {
  params: Promise<{ page: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number.parseInt(page, 10);
  const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildDecalCuratedPath()}/page/${safePageNumber}`;
  return {
    title: `${TITLE} - Page ${safePageNumber} | ${SITE_NAME}`,
    description: DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: buildAlternates(canonical)
  };
}

export default async function CuratedRobloxDecalIdsPaginatedPage({ params, searchParams }: PageProps) {
  const { page } = await params;
  const pageNumber = Number.parseInt(page, 10);
  const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const search = await resolveDecalSearch(searchParams);

  const [{ decals, total, totalPages }, catalog] = await Promise.all([
    loadRobloxDecalIdsPageData(safePageNumber, search, { curated: true }),
    getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES)
  ]);
  const contentHtml = await buildRobloxDecalCatalogContentHtml(catalog);

  return renderRobloxDecalIdsPage({
    decals,
    total,
    totalPages,
    currentPage: safePageNumber,
    showHero: false,
    contentHtml,
    search: search.search,
    sort: search.sort,
    section: "curated",
    pageTitleOverride: TITLE,
    pageDescription: DESCRIPTION
  });
}
