import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import {
  prepareGameCollectionDocument,
  renderGameCollectionPage,
  type GameDatasetPreparedCollection
} from "@/app/(site)/wiki/collections/games/generic";
import { RelatedMinecraftTools } from "@/app/(site)/minecraft/tools/page-data";
import { CommentsSection } from "@/components/comments/CommentsSection";


import type { GameCollectionRenderConfig } from "@/lib/game-collections";
import {
  buildMinecraftCollectionPath,
  buildMinecraftWikiPath,
  getPublishedMinecraftWikiCollectionRuntime,
  getMinecraftWikiCollectionPageByPath,
  listPublishedMinecraftWikiCollectionsByWikiSlug,
  type MinecraftWikiCollectionPage
} from "@/lib/minecraft";
import { buildPageContentHtml } from "@/lib/page-content";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 21600;

type Context = {
  page: MinecraftWikiCollectionPage;
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
  const page = await getMinecraftWikiCollectionPageByPath(wikiSlug, collectionSlug);
  if (!page) return null;
  const runtime = await getPublishedMinecraftWikiCollectionRuntime(page);
  if (!runtime) throw new Error(`Required Minecraft database runtime for ${page.code} did not load.`);
  const prepared = prepareGameCollectionDocument(runtime.config, runtime.document);
  return {
    page,
    config: runtime.config,
    prepared
  };
}

export async function generateMinecraftCollectionMetadata({
  slug,
  collection,
  currentPage
}: {
  slug: string;
  collection: string;
  currentPage: number;
}): Promise<Metadata> {
  const page = await getMinecraftWikiCollectionPageByPath(normalize(slug), normalize(collection));
  const basePath = buildMinecraftCollectionPath(slug, collection);
  const canonicalPath = currentPage === 1 ? basePath : `${basePath}/page/${currentPage}`;
  const canonical = `${SITE_URL}${canonicalPath}`;
  if (!page) {
    return { alternates: buildAlternates(canonical), robots: { index: false, follow: false } };
  }
  if (page.page_type === "collectible" && currentPage > 1) {
    const baseCanonical = `${SITE_URL}${basePath}`;
    return {
      title: page.title,
      description: page.meta_description,
      alternates: buildAlternates(baseCanonical),
      robots: { index: false, follow: false }
    };
  }
  const runtime = await getPublishedMinecraftWikiCollectionRuntime(page);
  const titleBase = resolveSeoTitle(page.seo_title) ?? page.title;
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

export async function renderMinecraftCollectionPageRoute({
  slug,
  collection,
  currentPage,
  searchParams
}: {
  slug: string;
  collection: string;
  currentPage: number;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const context = await resolveContext(slug, collection);
  if (!context) notFound();
  if (currentPage > context.prepared.totalPages) notFound();
  const [contentHtml, collections] = await Promise.all([
    buildPageContentHtml(context.page),
    listPublishedMinecraftWikiCollectionsByWikiSlug(context.page.wiki_slug)
  ]);
  const collectionOptions = collections.map((entry) => ({
    value: entry.code,
    label: entry.display_name,
    href: buildMinecraftCollectionPath(entry.wiki_slug, entry.collection_slug),
    pageType: entry.page_type
  }));
  const databaseContentHtml = contentHtml ? { ...contentHtml, id: null } : null;
  const renderedCollection = renderGameCollectionPage({
    config: context.config,
    dataset: context.prepared.dataset,
    contentHtml: databaseContentHtml,
    currentPage,
    prepared: context.prepared,
    routeBase: buildMinecraftWikiPath(slug),
    collectionBasePath: buildMinecraftCollectionPath(slug, collection),
    wikiHomePath: buildMinecraftWikiPath(slug),
    wikiLabel: `${context.page.game_title} Wiki`,
    collectionOptions,
    showMoreCollections: false,
    enableItemFinder: true
  });
  return (
    <>
      {renderedCollection}
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8"><RelatedMinecraftTools collection={collection} /></div>
      {contentHtml?.id ? (
        <div className="mx-auto mt-10 w-full max-w-5xl px-4 sm:px-6 lg:px-8">
          <CommentsSection entityType="minecraft_wiki_collection" entityId={contentHtml.id} />
        </div>
      ) : null}
    </>
  );
}

export async function getMinecraftCollectionPageCount(slug: string, collection: string): Promise<number> {
  const context = await resolveContext(slug, collection);
  if (!context) return 1;
  return context.page.page_type === "collectible" ? 1 : context.prepared.totalPages;
}
