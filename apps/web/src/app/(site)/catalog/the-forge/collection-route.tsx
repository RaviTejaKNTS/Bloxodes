import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import "@/styles/article-content.css";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { getWikiCatalogPageByCode } from "@/lib/wiki-catalog";
import {
  buildForgeCatalogCodeCandidates,
  buildForgeCatalogPath,
  getForgeCatalogConfig,
  loadPreparedForgeCatalog
} from "./page-data";

export const revalidate = 21600;

export async function generateForgeCollectionMetadata(collection: string): Promise<Metadata> {
  const config = getForgeCatalogConfig(collection);
  const canonicalPath = config ? buildForgeCatalogPath(config.slug) : `/catalog/${collection}`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;

  if (!config) {
    return {
      title: `The Forge Catalog | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION,
      alternates: buildAlternates(canonical)
    };
  }

  const prepared = await loadPreparedForgeCatalog(config);
  const count = prepared.itemCount;
  const fallbackTitle = `All ${count.toLocaleString("en-US")} ${config.label} in The Forge`;
  const catalog = await getWikiCatalogPageByCode(buildForgeCatalogCodeCandidates(config)[0]);
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

export async function renderForgeCollectionRoute(collection: string) {
  const config = getForgeCatalogConfig(collection);
  if (!config) {
    notFound();
  }

  permanentRedirect(buildForgeCatalogPath(config.slug));
}
