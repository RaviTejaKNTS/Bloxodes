import type { Metadata } from "next";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { buildPageContentHtml } from "@/lib/page-content";
import { loadRobloxMeshIdsPageData } from "@/lib/roblox-mesh-ids";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  CANONICAL,
  CATALOG_CODE,
  FALLBACK_DESCRIPTION,
  FALLBACK_SEO_TITLE,
  renderMeshIdsPage
} from "./page-data";

export const revalidate = 21600;

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCatalogPageContentByCodes([CATALOG_CODE]);
  const title = resolveSeoTitle(catalog?.seo_title) ?? catalog?.title ?? `${FALLBACK_SEO_TITLE} | ${SITE_NAME}`;
  const description = catalog?.meta_description ?? FALLBACK_DESCRIPTION;
  const image = catalog?.thumb_url || `${SITE_URL}/Bloxodes.png`;
  return {
    title,
    description,
    alternates: buildAlternates(CANONICAL),
    openGraph: { type: "website", url: CANONICAL, title, description, siteName: SITE_NAME, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

export default async function RobloxMeshIdsPage() {
  const [catalog, pageData] = await Promise.all([
    getCatalogPageContentByCodes([CATALOG_CODE]),
    loadRobloxMeshIdsPageData(1)
  ]);
  const contentHtml = await buildPageContentHtml(catalog);
  return renderMeshIdsPage({
    ...pageData,
    currentPage: 1,
    contentHtml,
    description: catalog?.meta_description?.trim() || FALLBACK_DESCRIPTION
  });
}
