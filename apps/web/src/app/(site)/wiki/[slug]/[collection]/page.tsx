import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { getGameCollectionConfigByWikiPath } from "@/lib/game-collections";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL, WIKI_DESCRIPTION } from "@/lib/seo";
import { buildPageContentHtml } from "@/lib/page-content";
import {
  buildWikiCollectionPath,
  getWikiCollectionPageByPath,
  listPublishedWikiCollectionPaths
} from "@/lib/wiki-collections";
import {
  getPreparedGameCollectionPageCount,
  loadPreparedGameCollection,
  renderGameCollectionPage
} from "@/app/(site)/wiki/collections/games/generic";
import {
  getGrowGardenCollectionConfig,
  getPreparedGrowGardenCollectionPageCount,
  loadPreparedGrowGardenCollection,
  renderGrowGardenCollectionPage
} from "@/app/(site)/wiki/collections/games/grow-a-garden";
import {
  getTheForgeCollectionConfig,
  getPreparedTheForgeCollectionPageCount,
  loadPreparedTheForgeCollection,
  renderTheForgeCollectionPage
} from "@/app/(site)/wiki/collections/games/the-forge";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ slug: string; collection: string }>;
};

type WikiCollectionContext =
  | {
      kind: "generic";
      wikiSlug: string;
      collectionSlug: string;
      code: string;
      config: NonNullable<ReturnType<typeof getGameCollectionConfigByWikiPath>>;
    }
  | {
      kind: "grow-a-garden";
      wikiSlug: string;
      collectionSlug: string;
      code: string;
      config: NonNullable<ReturnType<typeof getGrowGardenCollectionConfig>>;
    }
  | {
      kind: "the-forge";
      wikiSlug: string;
      collectionSlug: string;
      code: string;
      config: NonNullable<ReturnType<typeof getTheForgeCollectionConfig>>;
    };

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function resolveContext(wikiSlug: string, collectionSlug: string): WikiCollectionContext | null {
  const normalizedWikiSlug = normalizeSlug(wikiSlug);
  const normalizedCollectionSlug = normalizeSlug(collectionSlug);
  if (!normalizedWikiSlug || !normalizedCollectionSlug) return null;

  if (normalizedWikiSlug === "grow-a-garden") {
    const config = getGrowGardenCollectionConfig(normalizedCollectionSlug);
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
    const config = getTheForgeCollectionConfig(normalizedCollectionSlug);
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

  const config = getGameCollectionConfigByWikiPath(normalizedWikiSlug, normalizedCollectionSlug);
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
  return generateWikiCollectionMetadata({ slug, collection, currentPage: 1 });
}

export async function generateWikiCollectionMetadata({
  slug,
  collection,
  currentPage
}: {
  slug: string;
  collection: string;
  currentPage: number;
}): Promise<Metadata> {
  const context = resolveContext(slug, collection);
  const basePath = buildWikiCollectionPath(slug, collection);
  const canonicalPath = currentPage <= 1 ? basePath : `${basePath}/page/${currentPage}`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;

  if (!context) {
    return {
      title: `Roblox Wiki | ${SITE_NAME}`,
      description: WIKI_DESCRIPTION,
      alternates: buildAlternates(canonical)
    };
  }

  const page = await getWikiCollectionPageByPath(context.wikiSlug, context.collectionSlug);
  let fallbackTitle = page?.title ?? `${context.collectionSlug} Wiki Collection`;
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
    const prepared = await loadPreparedGrowGardenCollection(context.config);
    fallbackTitle = `All ${prepared.itemCount.toLocaleString("en-US")} ${context.config.label} in Grow a Garden`;
    fallbackDescription = context.config.description;
  } else {
    const prepared = await loadPreparedTheForgeCollection(context.config);
    fallbackTitle = `All ${prepared.itemCount.toLocaleString("en-US")} ${context.config.label} in The Forge`;
    fallbackDescription = context.config.description;
  }

  const baseTitle = resolveSeoTitle(page?.seo_title) ?? page?.title ?? fallbackTitle;
  const baseDescription = page?.meta_description ?? fallbackDescription;
  const title = currentPage <= 1 ? baseTitle : `${baseTitle} - Page ${currentPage}`;
  const description = currentPage <= 1 ? baseDescription : `${baseDescription} Page ${currentPage}.`;

  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    robots: currentPage > 1 ? { index: false, follow: true } : undefined,
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

export default async function WikiCollectionPage({ params }: PageProps) {
  const { slug, collection } = await params;
  return renderWikiCollectionPage({ slug, collection, currentPage: 1 });
}

export async function renderWikiCollectionPage({
  slug,
  collection,
  currentPage
}: {
  slug: string;
  collection: string;
  currentPage: number;
}) {
  const context = resolveContext(slug, collection);
  if (!context) {
    notFound();
  }

  const page = await getWikiCollectionPageByPath(context.wikiSlug, context.collectionSlug);

  if (context.kind === "generic") {
    if (!page) {
      notFound();
    }
    const prepared = await loadPreparedGameCollection(context.config);
    if (currentPage > prepared.totalPages) {
      notFound();
    }
    const contentHtml = await buildPageContentHtml(page);
    return renderGameCollectionPage({
      config: context.config,
      dataset: prepared.dataset,
      contentHtml,
      currentPage,
      prepared
    });
  }

  if (context.kind === "grow-a-garden") {
    const prepared = await loadPreparedGrowGardenCollection(context.config);
    if (currentPage > prepared.totalPages) {
      notFound();
    }
    const contentHtml = await buildPageContentHtml(page);
    return renderGrowGardenCollectionPage({
      config: context.config,
      dataset: prepared.dataset,
      contentHtml,
      currentPage,
      prepared
    });
  }

  const prepared = await loadPreparedTheForgeCollection(context.config);
  if (currentPage > prepared.totalPages) {
    notFound();
  }
  const contentHtml = await buildPageContentHtml(page);
  return renderTheForgeCollectionPage({
    config: context.config,
    dataset: prepared.dataset,
    contentHtml,
    currentPage,
    prepared
  });
}

export async function getWikiCollectionPageCount(wikiSlug: string, collectionSlug: string): Promise<number> {
  const context = resolveContext(wikiSlug, collectionSlug);
  if (!context) return 1;

  if (context.kind === "generic") {
    return getPreparedGameCollectionPageCount(context.config);
  }

  if (context.kind === "grow-a-garden") {
    return getPreparedGrowGardenCollectionPageCount(context.config);
  }

  return getPreparedTheForgeCollectionPageCount(context.config);
}
