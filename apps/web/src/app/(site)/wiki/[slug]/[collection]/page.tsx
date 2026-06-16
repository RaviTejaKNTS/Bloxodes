import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { getGameDatasetCatalogConfigByWikiPath } from "@/lib/game-dataset-catalogs";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL, WIKI_DESCRIPTION } from "@/lib/seo";
import { buildPageContentHtml } from "@/lib/page-content";
import {
  buildWikiCatalogPath,
  getWikiCatalogPageByPath,
  listPublishedWikiCatalogPaths
} from "@/lib/wiki-catalog";
import {
  loadGameDatasetCatalogDataset,
  renderGameDatasetCatalogPage
} from "@/app/(site)/catalog/game-datasets/page-data";
import {
  getGrowGardenCatalogConfig,
  loadGrowGardenCatalogDataset,
  renderGrowGardenCatalogPage
} from "@/app/(site)/catalog/grow-a-garden/page-data";
import {
  getForgeCatalogConfig,
  loadForgeCatalogDataset,
  renderForgeCatalogPage
} from "@/app/(site)/catalog/the-forge/page-data";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ slug: string; collection: string }>;
};

type WikiCatalogContext =
  | {
      kind: "generic";
      wikiSlug: string;
      collectionSlug: string;
      code: string;
      config: NonNullable<ReturnType<typeof getGameDatasetCatalogConfigByWikiPath>>;
    }
  | {
      kind: "grow-a-garden";
      wikiSlug: string;
      collectionSlug: string;
      code: string;
      config: NonNullable<ReturnType<typeof getGrowGardenCatalogConfig>>;
    }
  | {
      kind: "the-forge";
      wikiSlug: string;
      collectionSlug: string;
      code: string;
      config: NonNullable<ReturnType<typeof getForgeCatalogConfig>>;
    };

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function resolveContext(wikiSlug: string, collectionSlug: string): WikiCatalogContext | null {
  const normalizedWikiSlug = normalizeSlug(wikiSlug);
  const normalizedCollectionSlug = normalizeSlug(collectionSlug);
  if (!normalizedWikiSlug || !normalizedCollectionSlug) return null;

  if (normalizedWikiSlug === "grow-a-garden") {
    const config = getGrowGardenCatalogConfig(normalizedCollectionSlug);
    return config
      ? {
          kind: "grow-a-garden",
          wikiSlug: normalizedWikiSlug,
          collectionSlug: normalizedCollectionSlug,
          code: `grow-a-garden-${normalizedCollectionSlug}`,
          config
        }
      : null;
  }

  if (normalizedWikiSlug === "the-forge") {
    const config = getForgeCatalogConfig(normalizedCollectionSlug);
    return config
      ? {
          kind: "the-forge",
          wikiSlug: normalizedWikiSlug,
          collectionSlug: normalizedCollectionSlug,
          code: `the-forge-${normalizedCollectionSlug}`,
          config
        }
      : null;
  }

  const config = getGameDatasetCatalogConfigByWikiPath(normalizedWikiSlug, normalizedCollectionSlug);
  return config
    ? {
        kind: "generic",
        wikiSlug: normalizedWikiSlug,
        collectionSlug: normalizedCollectionSlug,
        code: config.code,
        config
      }
    : null;
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, collection } = await params;
  const context = resolveContext(slug, collection);
  const canonicalPath = buildWikiCatalogPath(slug, collection);
  const canonical = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;

  if (!context) {
    return {
      title: `Roblox Wiki | ${SITE_NAME}`,
      description: WIKI_DESCRIPTION,
      alternates: buildAlternates(canonical)
    };
  }

  const page = await getWikiCatalogPageByPath(context.wikiSlug, context.collectionSlug);
  let fallbackTitle = page?.title ?? `${context.collectionSlug} Wiki Catalog`;
  let fallbackDescription = page?.meta_description ?? WIKI_DESCRIPTION;
  let image = page?.thumb_url ?? `${SITE_URL}/og-image.png`;

  if (context.kind === "generic") {
    if (!page) {
      return {
        title: `Roblox Wiki | ${SITE_NAME}`,
        description: WIKI_DESCRIPTION,
        alternates: buildAlternates(canonical),
        robots: { index: false, follow: false }
      };
    }
  } else if (context.kind === "grow-a-garden") {
    const dataset = await loadGrowGardenCatalogDataset(context.config);
    fallbackTitle = `All ${dataset.items.length.toLocaleString("en-US")} ${context.config.label} in Grow a Garden`;
    fallbackDescription = context.config.description;
  } else {
    const dataset = await loadForgeCatalogDataset(context.config);
    fallbackTitle = `All ${dataset.items.length.toLocaleString("en-US")} ${context.config.label} in The Forge`;
    fallbackDescription = context.config.description;
  }

  const title = resolveSeoTitle(page?.seo_title) ?? page?.title ?? fallbackTitle;
  const description = page?.meta_description ?? fallbackDescription;

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

export default async function WikiCatalogPage({ params }: PageProps) {
  const { slug, collection } = await params;
  const context = resolveContext(slug, collection);
  if (!context) {
    notFound();
  }

  const page = await getWikiCatalogPageByPath(context.wikiSlug, context.collectionSlug);

  if (context.kind === "generic") {
    if (!page) {
      notFound();
    }
    const dataset = await loadGameDatasetCatalogDataset(context.config);
    const contentHtml = await buildPageContentHtml(page);
    return renderGameDatasetCatalogPage({
      config: context.config,
      dataset,
      contentHtml
    });
  }

  if (context.kind === "grow-a-garden") {
    const dataset = await loadGrowGardenCatalogDataset(context.config);
    const contentHtml = await buildPageContentHtml(page);
    return renderGrowGardenCatalogPage({
      config: context.config,
      dataset,
      contentHtml
    });
  }

  const dataset = await loadForgeCatalogDataset(context.config);
  const contentHtml = await buildPageContentHtml(page);
  return renderForgeCatalogPage({
    config: context.config,
    dataset,
    contentHtml
  });
}
