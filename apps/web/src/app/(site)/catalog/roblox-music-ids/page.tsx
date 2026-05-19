import type { Metadata } from "next";
import "@/styles/article-content.css";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import {
  buildRobloxMusicCatalogContentHtml,
  CANONICAL,
  loadRobloxMusicIdsPageData,
  resolveMusicSearch,
  renderRobloxMusicIdsPage
} from "./page-data";

export const revalidate = 86400;

const CATALOG_CODE_CANDIDATES = ["roblox-music-ids"];
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES);
  if (!catalog) {
    return {
      title: `Roblox Music IDs | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION,
      alternates: buildAlternates(CANONICAL)
    };
  }

  const title = resolveSeoTitle(catalog.seo_title) ?? catalog.title ?? `Roblox Music IDs | ${SITE_NAME}`;
  const description = catalog.meta_description ?? CATALOG_DESCRIPTION;
  const image = catalog.thumb_url || FALLBACK_IMAGE;

  return {
    title,
    description,
    alternates: buildAlternates(CANONICAL),
    openGraph: {
      type: "website",
      url: CANONICAL,
      title,
      description,
      siteName: SITE_NAME,
      images: [image]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function RobloxMusicIdsPage({ searchParams }: PageProps) {
  const search = await resolveMusicSearch(searchParams);
  const [{ songs, total, totalPages }, catalog] = await Promise.all([
    loadRobloxMusicIdsPageData(1, search),
    getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES)
  ]);
  const contentHtml = await buildRobloxMusicCatalogContentHtml(catalog);

  return renderRobloxMusicIdsPage({
    songs,
    total,
    totalPages,
    currentPage: 1,
    showHero: true,
    contentHtml,
    search: search.search,
    sort: search.sort
  });
}
