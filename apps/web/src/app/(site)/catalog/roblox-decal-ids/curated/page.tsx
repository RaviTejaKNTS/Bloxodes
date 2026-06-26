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
} from "../page-data";

export const revalidate = 21600;

const CATALOG_CODE_CANDIDATES = ["roblox-decal-ids"];
const TITLE = "Curated Roblox Decal IDs";
const DESCRIPTION = "Browse the best Roblox decal IDs from curated lists, strong Roblox ratings, useful categories, and verified image previews.";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildDecalCuratedPath()}`;
  return {
    title: `${TITLE} | ${SITE_NAME}`,
    description: DESCRIPTION,
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "website",
      url: canonical,
      title: TITLE,
      description: DESCRIPTION,
      siteName: SITE_NAME,
      images: [`${SITE_URL}/og-image.png`]
    }
  };
}

export default async function CuratedRobloxDecalIdsPage({ searchParams }: PageProps) {
  const search = await resolveDecalSearch(searchParams);
  const [{ decals, total, totalPages }, catalog] = await Promise.all([
    loadRobloxDecalIdsPageData(1, search, { curated: true }),
    getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES)
  ]);
  const contentHtml = await buildRobloxDecalCatalogContentHtml(catalog);

  return renderRobloxDecalIdsPage({
    decals,
    total,
    totalPages,
    currentPage: 1,
    showHero: true,
    contentHtml,
    search: search.search,
    sort: search.sort,
    section: "curated",
    pageTitleOverride: TITLE,
    pageDescription: DESCRIPTION
  });
}
