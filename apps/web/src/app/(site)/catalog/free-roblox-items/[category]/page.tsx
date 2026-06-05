import type { Metadata } from "next";
import "@/styles/article-content.css";
import { notFound } from "next/navigation";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import {
  BASE_PATH,
  appendItemCountToSeoTitle,
  buildFreeItemCatalogCodeCandidates,
  buildFreeItemsCatalogContentHtml,
  buildFreeItemCategoryPath,
  loadFreeItemCategoryBySlug,
  loadFreeItemSubcategories,
  loadFreeItemsPageData,
  resolveFreeItemsDescription,
  renderRobloxFreeItemsPage
} from "../page-data";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ category: string }>;
};

function getCatalogCodeCandidates(categorySlug: string) {
  return buildFreeItemCatalogCodeCandidates(categorySlug);
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await loadFreeItemCategoryBySlug(categorySlug);
  if (!category) {
    return {
      title: `Roblox free items | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION
    };
  }

  const catalog = await getCatalogPageContentByCodes(getCatalogCodeCandidates(category.slug));
  const baseTitle = catalog?.seo_title?.trim() || catalog?.title?.trim() || `Free Roblox ${category.label} items`;
  const title = appendItemCountToSeoTitle(baseTitle, category.count);
  const description = resolveFreeItemsDescription(
    catalog?.meta_description,
    `Browse free Roblox ${category.label} items with instant ID copy and category filters.`
  );
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildFreeItemCategoryPath(category.slug)}`;

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
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

export default async function RobloxFreeItemsCategoryPage({ params }: PageProps) {
  const { category: categorySlug } = await params;
  const category = await loadFreeItemCategoryBySlug(categorySlug);
  if (!category) {
    notFound();
  }

  const [subcategories, pageData, catalog] = await Promise.all([
    loadFreeItemSubcategories(category.label),
    loadFreeItemsPageData(1, { category: category.label }),
    getCatalogPageContentByCodes(getCatalogCodeCandidates(category.slug))
  ]);
  const { items, total, totalPages } = pageData;
  const contentHtml = await buildFreeItemsCatalogContentHtml(catalog);

  const pageTitle = catalog?.title?.trim() || `Free Roblox ${category.label} items`;
  const description = resolveFreeItemsDescription(
    catalog?.meta_description,
    `Browse every free Roblox ${category.label} item and copy IDs instantly.`
  );
  const basePath = buildFreeItemCategoryPath(category.slug);

  return renderRobloxFreeItemsPage({
    items,
    total,
    totalPages,
    currentPage: 1,
    showHero: true,
    pageTitle,
    description,
    breadcrumbItems: [
      { label: "Home", href: "/" },
      { label: "Catalog", href: "/catalog" },
      { label: "Roblox free items", href: BASE_PATH },
      { label: category.label, href: null }
    ],
    basePath,
    categorySlug: category.slug,
    categoryLabel: category.label,
    subcategories,
    contentHtml
  });
}
