import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import "@/styles/article-content.css";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { getWikiCatalogPageByCode } from "@/lib/wiki-catalog";
import {
  buildGrowGardenCatalogCodeCandidates,
  buildGrowGardenCatalogPath,
  getGrowGardenCatalogConfig,
  loadGrowGardenCatalogDataset
} from "./page-data";

export const revalidate = 86400;

export async function generateGrowGardenCollectionMetadata(collection: string): Promise<Metadata> {
  const config = getGrowGardenCatalogConfig(collection);
  const canonicalPath = config ? buildGrowGardenCatalogPath(config.slug) : `/catalog/${collection}`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;

  if (!config) {
    return {
      title: `Grow a Garden Catalog | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION,
      alternates: buildAlternates(canonical)
    };
  }

  const dataset = await loadGrowGardenCatalogDataset(config);
  const count = dataset.items.length;
  const fallbackTitle = `All ${count.toLocaleString("en-US")} ${config.label} in Grow a Garden`;
  const catalog = await getWikiCatalogPageByCode(buildGrowGardenCatalogCodeCandidates(config)[0]);
  const title = resolveSeoTitle(catalog?.seo_title) ?? catalog?.title ?? fallbackTitle;
  const description = catalog?.meta_description ?? config.description ?? CATALOG_DESCRIPTION;
  const image = catalog?.thumb_url ?? `${SITE_URL}/og-image.png`;

  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "website",
      url: canonical,
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

export async function renderGrowGardenCollectionRoute(collection: string) {
  const config = getGrowGardenCatalogConfig(collection);
  if (!config) {
    notFound();
  }

  permanentRedirect(buildGrowGardenCatalogPath(config.slug));
}
