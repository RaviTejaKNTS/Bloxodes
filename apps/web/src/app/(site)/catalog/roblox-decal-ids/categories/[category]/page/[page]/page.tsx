import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import {
  buildDecalCategoryPath,
  buildRobloxDecalCatalogContentHtml,
  loadDecalCategoryBySlug,
  loadRobloxDecalIdsPageData,
  resolveDecalSearch,
  renderRobloxDecalIdsPage
} from "../../../../page-data";

export const revalidate = 21600;

const CATALOG_CODE_CANDIDATES = ["roblox-decal-ids"];

type PageProps = {
  params: Promise<{ category: string; page: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: categorySlug, page } = await params;
  const category = await loadDecalCategoryBySlug(categorySlug);
  if (!category) {
    return { title: `Roblox Decal IDs | ${SITE_NAME}` };
  }
  const pageNumber = Number.parseInt(page, 10);
  const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const title = `${category.label} Roblox Decal IDs - Page ${safePageNumber}`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildDecalCategoryPath(category.slug)}/page/${safePageNumber}`;
  return {
    title: `${title} | ${SITE_NAME}`,
    description: category.description,
    robots: { index: false, follow: true },
    alternates: buildAlternates(canonical)
  };
}

export default async function RobloxDecalCategoryPaginatedPage({ params, searchParams }: PageProps) {
  const { category: categorySlug, page } = await params;
  const category = await loadDecalCategoryBySlug(categorySlug);
  if (!category) notFound();
  const pageNumber = Number.parseInt(page, 10);
  const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const search = await resolveDecalSearch(searchParams);

  const [{ decals, total, totalPages }, catalog] = await Promise.all([
    loadRobloxDecalIdsPageData(safePageNumber, search, { category: category.slug }),
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
    section: "category",
    category,
    pageTitleOverride: `${category.label} Roblox Decal IDs`,
    pageDescription: category.description
  });
}
