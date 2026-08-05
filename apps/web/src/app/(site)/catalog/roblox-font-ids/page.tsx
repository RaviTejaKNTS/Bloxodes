import type { Metadata } from "next";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { buildPageContentHtml } from "@/lib/page-content";
import { listRobloxFontIds } from "@/lib/roblox-font-ids";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  CANONICAL,
  CATALOG_CODE,
  FALLBACK_DESCRIPTION,
  FALLBACK_TITLE,
  renderFontIdsPage
} from "./page-data";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCatalogPageContentByCodes([CATALOG_CODE]);
  const title = resolveSeoTitle(catalog?.seo_title) ?? catalog?.title ?? `${FALLBACK_TITLE} | ${SITE_NAME}`;
  const description = catalog?.meta_description ?? FALLBACK_DESCRIPTION;
  const image = catalog?.thumb_url || `${SITE_URL}/Bloxodes.png`;

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
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

export default async function RobloxFontIdsPage() {
  const [catalog, fonts] = await Promise.all([
    getCatalogPageContentByCodes([CATALOG_CODE]),
    listRobloxFontIds()
  ]);
  const contentHtml = await buildPageContentHtml(catalog);
  return renderFontIdsPage({
    fonts,
    contentHtml,
    description: catalog?.meta_description?.trim() || FALLBACK_DESCRIPTION
  });
}
