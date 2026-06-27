import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  buildDecalCategoryPath,
  loadDecalCategoryBySlug,
  loadRobloxDecalIdsPageData,
  resolveDecalSearch,
  renderRobloxDecalIdsPage
} from "../../../../page-data";

export const revalidate = 21600;
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ category: string; page: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

  const { decals, total, totalPages } = await loadRobloxDecalIdsPageData(safePageNumber, search, { category: category.slug });

  return renderRobloxDecalIdsPage({
    decals,
    total,
    totalPages,
    currentPage: safePageNumber,
    showHero: false,
    search: search.search,
    sort: search.sort,
    section: "category",
    category,
    pageTitleOverride: `${category.label} Roblox Decal IDs`,
    pageDescription: category.description
  });
}
