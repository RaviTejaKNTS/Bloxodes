import type { Metadata } from "next";
import "@/styles/article-content.css";
import { notFound } from "next/navigation";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import {
  BASE_PATH,
  appendItemCountToSeoTitle,
  buildFreeItemCatalogCodeCandidates,
  buildFreeItemCategoryPath,
  buildFreeItemsCatalogContentHtml,
  loadFreeItemCategories,
  loadFreeItemCategoryBySlug,
  loadFreeItemSubcategories,
  loadFreeItemSubcategoryBySlug,
  loadFreeItemsPageData,
  resolveFreeItemsSearch,
  renderRobloxFreeItemsPage
} from "../../../../page-data";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ category: string; subcategory: string; page: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const FREE_ITEMS_CONTENT_CODES = buildFreeItemCatalogCodeCandidates();

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: categorySlug, subcategory: subcategorySlug, page } = await params;
  const category = await loadFreeItemCategoryBySlug(categorySlug);
  if (!category) {
    return {
      title: `Roblox free items | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION
    };
  }

  const subcategory = await loadFreeItemSubcategoryBySlug(category.label, subcategorySlug);
  if (!subcategory) {
    return {
      title: `Roblox free items | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION
    };
  }

  const pageNumber = Number.parseInt(page, 10);
  const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const baseTitle = `Free Roblox ${subcategory.label} items`;
  const title = `${appendItemCountToSeoTitle(baseTitle, subcategory.count)} - Page ${safePageNumber}`;
  const description = `Browse free Roblox ${subcategory.label} items in the ${category.label} category (page ${safePageNumber}).`;
  const canonical =
    `${SITE_URL.replace(/\/$/, "")}${buildFreeItemCategoryPath(category.slug, subcategory.slug)}/page/${safePageNumber}`;

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    robots: {
      index: false,
      follow: true,
      nocache: false,
      googleBot: {
        index: false,
        follow: true
      }
    },
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: SITE_NAME
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function RobloxFreeItemsSubcategoryPaginatedPage({ params, searchParams }: PageProps) {
  const { category: categorySlug, subcategory: subcategorySlug, page } = await params;
  const category = await loadFreeItemCategoryBySlug(categorySlug);
  if (!category) {
    notFound();
  }

  const subcategory = await loadFreeItemSubcategoryBySlug(category.label, subcategorySlug);
  if (!subcategory) {
    notFound();
  }

  const pageNumber = Number.parseInt(page, 10);
  const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const search = await resolveFreeItemsSearch(searchParams);

  const [subcategories, pageData, catalog] = await Promise.all([
    loadFreeItemSubcategories(category.label),
    loadFreeItemsPageData(safePageNumber, {
      category: category.label,
      subcategory: subcategory.label,
      search: search.search,
      sort: search.sort
    }),
    getCatalogPageContentByCodes(FREE_ITEMS_CONTENT_CODES)
  ]);
  const { items, total, totalPages } = pageData;
  const contentHtml = await buildFreeItemsCatalogContentHtml(catalog);

  const pageTitle = `Free Roblox ${subcategory.label} items`;
  const basePath = buildFreeItemCategoryPath(category.slug, subcategory.slug);

  return renderRobloxFreeItemsPage({
    items,
    total,
    totalPages,
    currentPage: safePageNumber,
    showHero: false,
    pageTitle,
    description: `Browse free Roblox ${subcategory.label} items in the ${category.label} category.`,
    breadcrumbItems: [
      { label: "Home", href: "/" },
      { label: "Catalog", href: "/catalog" },
      { label: "Roblox free items", href: BASE_PATH },
      { label: category.label, href: buildFreeItemCategoryPath(category.slug) },
      { label: subcategory.label, href: basePath },
      { label: `Page ${safePageNumber}`, href: null }
    ],
    basePath,
    navActive: category.slug,
    categorySlug: category.slug,
    categoryLabel: category.label,
    subcategories,
    activeSubcategorySlug: subcategory.slug,
    contentHtml,
    search: search.search,
    sort: search.sort
  });
}
