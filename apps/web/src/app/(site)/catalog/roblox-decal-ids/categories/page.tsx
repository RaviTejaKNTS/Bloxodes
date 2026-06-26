import type { Metadata } from "next";
import "@/styles/article-content.css";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import {
  buildDecalCategoriesPath,
  buildRobloxDecalCatalogContentHtml,
  loadDecalCategories,
  renderRobloxDecalCategoriesPage
} from "../page-data";

export const revalidate = 21600;

const CATALOG_CODE_CANDIDATES = ["roblox-decal-ids"];
const TITLE = "Roblox Decal ID Categories";
const DESCRIPTION = "Browse Roblox decal IDs by image style, theme, and common decal search intent.";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildDecalCategoriesPath()}`;
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

export default async function RobloxDecalCategoriesPage() {
  const [categories, catalog] = await Promise.all([
    loadDecalCategories(),
    getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES)
  ]);
  const contentHtml = await buildRobloxDecalCatalogContentHtml(catalog);

  return renderRobloxDecalCategoriesPage({ categories, contentHtml });
}
