import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import {
  prepareGameCollectionDocument,
  renderGameCollectionPage,
  type GameDatasetPreparedCollection
} from "@/app/(site)/wiki/collections/games/generic";
import { renderGtaCollectibleCollectionPage } from "@/components/gta/GtaCollectibleCollectionPage";
import type { GameCollectionRenderConfig } from "@/lib/game-collections";
import {
  buildGtaCollectionPath,
  getGtaWikiCollectionPageByPath,
  getPublishedGtaWikiCollectionRuntime,
  listPublishedGtaWikiCollectionsByWikiSlug,
  type GtaWikiCollectionPage
} from "@/lib/gta";
import { buildPageContentHtml } from "@/lib/page-content";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 21600;

type PageProps = { params: Promise<{ slug: string; collection: string }> };

type Context = {
  page: GtaWikiCollectionPage;
  config: GameCollectionRenderConfig;
  prepared: GameDatasetPreparedCollection;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveContext(slug: string, collection: string): Promise<Context | null> {
  const wikiSlug = normalize(slug);
  const collectionSlug = normalize(collection);
  if (!wikiSlug || !collectionSlug) return null;
  const page = await getGtaWikiCollectionPageByPath(wikiSlug, collectionSlug);
  if (!page) return null;
  const runtime = await getPublishedGtaWikiCollectionRuntime(page);
  if (!runtime) throw new Error(`Required GTA database runtime for ${page.code} did not load.`);
  return {
    page,
    config: runtime.config,
    prepared: prepareGameCollectionDocument(runtime.config, runtime.document)
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, collection } = await params;
  return generateGtaCollectionMetadata({ slug, collection, currentPage: 1 });
}

export async function generateGtaCollectionMetadata({
  slug,
  collection,
  currentPage
}: {
  slug: string;
  collection: string;
  currentPage: number;
}): Promise<Metadata> {
  const page = await getGtaWikiCollectionPageByPath(normalize(slug), normalize(collection));
  const basePath = buildGtaCollectionPath(slug, collection);
  const canonicalPath = currentPage === 1 ? basePath : `${basePath}/page/${currentPage}`;
  const canonical = `${SITE_URL}${canonicalPath}`;
  if (!page) {
    return { alternates: buildAlternates(canonical), robots: { index: false, follow: false } };
  }
  if (page.page_type === "checklist" && currentPage > 1) {
    const baseCanonical = `${SITE_URL}${basePath}`;
    return {
      title: page.title,
      description: page.meta_description,
      alternates: buildAlternates(baseCanonical),
      robots: { index: false, follow: false }
    };
  }
  const runtime = await getPublishedGtaWikiCollectionRuntime(page);
  const titleBase = resolveSeoTitle(page.seo_title) ?? page.title ?? `GTA Wiki | ${SITE_NAME}`;
  const title = currentPage === 1 ? titleBase : `${titleBase} - Page ${currentPage}`;
  const description = currentPage === 1 ? page.meta_description : `${page.meta_description} Page ${currentPage}.`;
  const image = runtime?.document.items.find((item) => item.system.image)?.system.image || page.thumb_url || page.game_cover_image || `${SITE_URL}/Bloxodes.png`;
  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    robots: currentPage > 1 ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", url: canonical, title, description, siteName: SITE_NAME, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

export default async function GtaCollectionPage({ params }: PageProps) {
  const { slug, collection } = await params;
  return renderGtaCollectionPage({ slug, collection, currentPage: 1 });
}

export async function renderGtaCollectionPage({
  slug,
  collection,
  currentPage
}: {
  slug: string;
  collection: string;
  currentPage: number;
}) {
  const context = await resolveContext(slug, collection);
  if (!context) notFound();
  if (currentPage > context.prepared.totalPages) notFound();
  const [contentHtml, collections] = await Promise.all([
    buildPageContentHtml(context.page),
    listPublishedGtaWikiCollectionsByWikiSlug(context.page.wiki_slug)
  ]);
  const collectionOptions = collections.map((entry) => ({
    value: entry.code,
    label: entry.display_name,
    href: buildGtaCollectionPath(entry.wiki_slug, entry.collection_slug),
    pageType: entry.page_type
  }));
  if (context.page.page_type === "checklist") {
    return renderGtaCollectibleCollectionPage({
      page: context.page,
      config: context.config,
      dataset: context.prepared.dataset,
      groupedSections: context.prepared.groupedSections,
      contentHtml,
      collectionOptions
    });
  }
  return renderGameCollectionPage({
    config: context.config,
    dataset: context.prepared.dataset,
    contentHtml,
    currentPage,
    prepared: context.prepared,
    routeBase: "/gta/wiki",
    wikiLabel: "GTA Wiki",
    collectionOptions,
    commentsEntityType: "gta_wiki_collection",
    showMoreCollections: false
  });
}

export async function getGtaCollectionPageCount(slug: string, collection: string): Promise<number> {
  const context = await resolveContext(slug, collection);
  if (!context) return 1;
  return context.page.page_type === "checklist" ? 1 : context.prepared.totalPages;
}
