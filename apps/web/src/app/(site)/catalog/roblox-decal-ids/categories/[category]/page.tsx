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
} from "../../page-data";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ category: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildCategorySeoDescription(categoryLabel: string): string {
  return `Find ${categoryLabel.toLowerCase()} Roblox decal IDs with image previews, copy-ready codes, creator details, and Roblox links.`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await loadDecalCategoryBySlug(categorySlug);
  if (!category) {
    return { title: `Roblox Decal IDs | ${SITE_NAME}` };
  }
  const title = `${category.label} Roblox Decal IDs [Image Codes]`;
  const description = buildCategorySeoDescription(category.label);
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildDecalCategoryPath(category.slug)}`;
  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    robots: { index: false, follow: true },
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: SITE_NAME,
      images: [`${SITE_URL}/Bloxodes.png`]
    }
  };
}

export default async function RobloxDecalCategoryPage({ params, searchParams }: PageProps) {
  const { category: categorySlug } = await params;
  const category = await loadDecalCategoryBySlug(categorySlug);
  if (!category) notFound();
  const search = await resolveDecalSearch(searchParams);

  const { decals, total, totalPages } = await loadRobloxDecalIdsPageData(1, search, { category: category.slug });

  return renderRobloxDecalIdsPage({
    decals,
    total,
    totalPages,
    currentPage: 1,
    showHero: true,
    search: search.search,
    sort: search.sort,
    section: "category",
    category,
    pageTitleOverride: `${category.label} Roblox Decal IDs`,
    pageDescription: buildCategorySeoDescription(category.label)
  });
}
