import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import type { GameCollectionRenderConfig } from "@/lib/game-collections";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL, WIKI_DESCRIPTION } from "@/lib/seo";
import { buildPageContentHtml } from "@/lib/page-content";
import {
  buildWikiCollectionPath,
  getWikiCollectionPageByPath,
  listPublishedWikiCollectionPagesByWikiSlug,
  type WikiCollectionPageContent
} from "@/lib/wiki-collections";
import { getPublishedWikiCollectionRuntime } from "@/lib/wiki-collection-runtime";
import {
  prepareGameCollectionDocument,
  renderGameCollectionPage
} from "@/app/(site)/wiki/collections/games/generic";
import type { GameDatasetPreparedCollection } from "@/app/(site)/wiki/collections/games/generic";
import { renderRobloxCollectionChecklistPage } from "@/components/wiki/RobloxCollectionChecklistPage";
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
      config: GameCollectionRenderConfig;
      page: WikiCollectionPageContent;
      prepared: GameDatasetPreparedCollection;
    }
  | {
      kind: "grow-a-garden";
      wikiSlug: string;
      collectionSlug: string;
      code: string;
      config: NonNullable<ReturnType<typeof getGrowGardenCollectionConfig>>;
      page: WikiCollectionPageContent | null;
    }
  | {
      kind: "the-forge";
      wikiSlug: string;
      collectionSlug: string;
      code: string;
      config: NonNullable<ReturnType<typeof getTheForgeCollectionConfig>>;
      page: WikiCollectionPageContent | null;
    };

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveContext(wikiSlug: string, collectionSlug: string): Promise<WikiCollectionContext | null> {
  const normalizedWikiSlug = normalizeSlug(wikiSlug);
  const normalizedCollectionSlug = normalizeSlug(collectionSlug);
  if (!normalizedWikiSlug || !normalizedCollectionSlug) return null;

  const page = await getWikiCollectionPageByPath(normalizedWikiSlug, normalizedCollectionSlug);
  if (!page) return null;

  if (normalizedWikiSlug === "grow-a-garden") {
    const config = getGrowGardenCollectionConfig(normalizedCollectionSlug);
    if (config) {
      return {
        kind: "grow-a-garden",
        wikiSlug: normalizedWikiSlug,
        collectionSlug: normalizedCollectionSlug,
        code: `grow-a-garden-${normalizedCollectionSlug}`,
        config,
        page
      };
    }
  }

  if (normalizedWikiSlug === "the-forge") {
    const config = getTheForgeCollectionConfig(normalizedCollectionSlug);
    if (config) {
      return {
        kind: "the-forge",
        wikiSlug: normalizedWikiSlug,
        collectionSlug: normalizedCollectionSlug,
        code: `the-forge-${normalizedCollectionSlug}`,
        config,
        page
      };
    }
  }

  const runtime = await getPublishedWikiCollectionRuntime(page);
  if (!runtime) {
    throw new Error(`Required database runtime for ${page.code} did not load. Local fallback is disabled.`);
  }
  return {
    kind: "generic",
    wikiSlug: normalizedWikiSlug,
    collectionSlug: normalizedCollectionSlug,
    code: page.code,
    config: runtime.config,
    page,
    prepared: prepareGameCollectionDocument(runtime.config, runtime.document)
  };
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
  const wikiSlug = normalizeSlug(slug);
  const collectionSlug = normalizeSlug(collection);
  const page = await getWikiCollectionPageByPath(wikiSlug, collectionSlug);
  const basePath = buildWikiCollectionPath(wikiSlug, collectionSlug);
  const checklistPage = page?.page_type === "checklist";
  const canonicalPath = checklistPage || currentPage <= 1 ? basePath : `${basePath}/page/${currentPage}`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  let fallbackTitle = page?.title ?? `${collectionSlug} Wiki Collection`;
  let fallbackDescription = page?.meta_description ?? WIKI_DESCRIPTION;
  const databaseRuntime = page ? await getPublishedWikiCollectionRuntime(page) : null;
  const databaseImage = databaseRuntime?.document.items.find((item) => item.system.image)?.system.image;
  const image = databaseImage ?? page?.thumb_url ?? `${SITE_URL}/Bloxodes.png`;

  const growGardenConfig = wikiSlug === "grow-a-garden"
    ? getGrowGardenCollectionConfig(collectionSlug)
    : null;
  const forgeConfig = wikiSlug === "the-forge"
    ? getTheForgeCollectionConfig(collectionSlug)
    : null;

  if (!page) {
    return {
      title: `Roblox Wiki | ${SITE_NAME}`,
      description: WIKI_DESCRIPTION,
      alternates: buildAlternates(canonical),
      robots: { index: false, follow: false }
    };
  }

  if (growGardenConfig) {
    const prepared = await loadPreparedGrowGardenCollection(growGardenConfig);
    fallbackTitle = `All ${prepared.itemCount.toLocaleString("en-US")} ${growGardenConfig.label} in Grow a Garden`;
    fallbackDescription = growGardenConfig.description;
  } else if (forgeConfig) {
    const prepared = await loadPreparedTheForgeCollection(forgeConfig);
    fallbackTitle = `All ${prepared.itemCount.toLocaleString("en-US")} ${forgeConfig.label} in The Forge`;
    fallbackDescription = forgeConfig.description;
  } else {
    if (!databaseRuntime) {
      throw new Error(`Required database runtime for ${page.code} did not load. Local fallback is disabled.`);
    }
  }

  const baseTitle = resolveSeoTitle(page?.seo_title) ?? page?.title ?? fallbackTitle;
  const baseDescription = page?.meta_description ?? fallbackDescription;
  const title = checklistPage || currentPage <= 1 ? baseTitle : `${baseTitle} - Page ${currentPage}`;
  const description = checklistPage || currentPage <= 1 ? baseDescription : `${baseDescription} Page ${currentPage}.`;

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
  const context = await resolveContext(slug, collection);
  if (!context) {
    notFound();
  }

  const page = context.page;

  if (context.kind === "generic") {
    if (!page) {
      notFound();
    }
    const prepared = context.prepared;
    if (page.page_type === "checklist") {
      if (currentPage > 1) notFound();
      const contentHtml = await buildPageContentHtml(page);
      const collectionOptions = (await listPublishedWikiCollectionPagesByWikiSlug(context.wikiSlug)).map((entry) => ({
        value: entry.code,
        label: entry.display_name?.trim() || entry.title,
        href: buildWikiCollectionPath(entry.wiki_slug, entry.collection_slug)
      }));
      return renderRobloxCollectionChecklistPage({
        page,
        config: context.config,
        dataset: prepared.dataset,
        groupedSections: prepared.groupedSections,
        contentHtml,
        collectionOptions
      });
    }
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
  const context = await resolveContext(wikiSlug, collectionSlug);
  if (!context) return 1;

  if (context.kind === "generic") {
    if (context.page.page_type === "checklist") return 1;
    return context.prepared.totalPages;
  }

  if (context.kind === "grow-a-garden") {
    return getPreparedGrowGardenCollectionPageCount(context.config);
  }

  return getPreparedTheForgeCollectionPageCount(context.config);
}
