import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import {
  prepareGameCollectionDocument,
  renderGameCollectionPage,
  type GameDatasetPreparedCollection
} from "@/app/(site)/wiki/collections/games/generic";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { RelatedMinecraftTools } from "../../tools/page-data";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { MinecraftEditionSelector } from "@/components/minecraft/MinecraftEditionSelector";
import { minecraftCollectionEdition, minecraftCollectionTitleForCount, parseMinecraftEdition, selectMinecraftEdition, type MinecraftEdition } from "@/lib/minecraft-edition";
import type { GameCollectionRenderConfig } from "@/lib/game-collections";
import {
  buildMinecraftCollectionPath,
  getPublishedMinecraftWikiCollectionRuntime,
  getMinecraftWikiCollectionPageByPath,
  listPublishedMinecraftWikiCollectionsByWikiSlug,
  type MinecraftWikiCollectionPage
} from "@/lib/minecraft";
import { buildPageContentHtml } from "@/lib/page-content";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 21600;

type PageProps = { params: Promise<{ collection: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

type Context = {
  edition: MinecraftEdition;
  page: MinecraftWikiCollectionPage;
  config: GameCollectionRenderConfig;
  prepared: GameDatasetPreparedCollection;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveContext(slug: string, collection: string, edition?: MinecraftEdition): Promise<Context | null> {
  const wikiSlug = normalize(slug);
  const collectionSlug = normalize(collection);
  if (!wikiSlug || !collectionSlug) return null;
  const page = await getMinecraftWikiCollectionPageByPath(wikiSlug, collectionSlug);
  if (!page) return null;
  const runtime = await getPublishedMinecraftWikiCollectionRuntime(page);
  if (!runtime) throw new Error(`Required Minecraft database runtime for ${page.code} did not load.`);
  const selectedEdition = minecraftCollectionEdition(runtime.document.items, edition);
  const prepared = prepareGameCollectionDocument(runtime.config, selectMinecraftEdition(runtime.document, selectedEdition));
  return {
    edition: selectedEdition,
    page: {
      ...page,
      title: minecraftCollectionTitleForCount(page.title, runtime.itemCount, prepared.itemCount),
      seo_title: minecraftCollectionTitleForCount(page.seo_title, runtime.itemCount, prepared.itemCount)
    },
    config: runtime.config,
    prepared
  };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { collection } = await params;
  const slug = "minecraft";
  const query = await searchParams;
  return generateMinecraftCollectionMetadata({ slug, collection, currentPage: 1, edition: parseMinecraftEdition(query?.edition) ?? undefined });
}

export async function generateMinecraftCollectionMetadata({
  slug,
  collection,
  currentPage,
  edition
}: {
  slug: string;
  collection: string;
  currentPage: number;
  edition?: MinecraftEdition;
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
  const selectedCount = runtime ? selectMinecraftEdition(runtime.document, minecraftCollectionEdition(runtime.document.items, edition)).items.length : page.item_count;
  const titleBase = selectedCount === 0 ? `${page.display_name} in Minecraft` : minecraftCollectionTitleForCount(resolveSeoTitle(page.seo_title) ?? page.title ?? `Minecraft Wiki | ${SITE_NAME}`, page.item_count, selectedCount);
  const title = currentPage === 1 ? titleBase : `${titleBase} - Page ${currentPage}`;
  const description = currentPage === 1 ? page.meta_description : `${page.meta_description} Page ${currentPage}.`;
  const image = runtime?.document.items.find((item) => item.system.image)?.system.image || page.thumb_url || page.game_cover_image || `${SITE_URL}/Bloxodes.png`;
  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    robots: currentPage > 1 || selectedCount === 0 ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", url: canonical, title, description, siteName: SITE_NAME, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

export default async function MinecraftCollectionPage({ params, searchParams }: PageProps) {
  const { collection } = await params;
  const slug = "minecraft";
  const query = await searchParams;
  const edition = parseMinecraftEdition(query?.edition) ?? undefined;
  return renderMinecraftCollectionPageRoute({ slug, collection, currentPage: 1, edition, searchParams: query });
}

export async function renderMinecraftCollectionPageRoute({
  slug,
  collection,
  currentPage,
  edition,
  searchParams
}: {
  slug: string;
  collection: string;
  currentPage: number;
  edition?: MinecraftEdition;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const context = await resolveContext(slug, collection, edition);
  if (!context) notFound();
  edition = context.edition;
  if (currentPage > context.prepared.totalPages) notFound();
  if (!context.prepared.itemCount) {
    return <div className="space-y-6">
      <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Minecraft Wiki", href: "/minecraft/wiki" }, { label: context.page.display_name, href: null }]} />
      <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{context.page.display_name} in Minecraft</h1>
      <MinecraftEditionSelector edition={edition} basePath={buildMinecraftCollectionPath(slug, collection)} searchParams={searchParams} />
      <p className="text-base leading-7 text-muted">This collection has no entries for {edition === "java" ? "Java" : "Bedrock"} Edition. Select the other edition to view its entries.</p>
    </div>;
  }
  const [contentHtml, collections] = await Promise.all([
    buildPageContentHtml(context.page),
    listPublishedMinecraftWikiCollectionsByWikiSlug(context.page.wiki_slug)
  ]);
  const collectionOptions = collections.map((entry) => ({
    value: entry.code,
    label: entry.display_name,
    href: `${buildMinecraftCollectionPath(entry.wiki_slug, entry.collection_slug)}?edition=${edition}`,
    pageType: entry.page_type
  }));
  const databaseContentHtml = contentHtml ? { ...contentHtml, id: null } : null;
  const renderedCollection = renderGameCollectionPage({
    config: context.config,
    dataset: context.prepared.dataset,
    contentHtml: databaseContentHtml,
    currentPage,
    prepared: context.prepared,
    routeBase: "/minecraft/wiki",
    collectionBasePath: buildMinecraftCollectionPath("minecraft", collection),
    navigationQuery: `edition=${edition}`,
    wikiHomePath: "/minecraft/wiki",
    wikiLabel: "Minecraft Wiki",
    collectionOptions,
    showMoreCollections: false,
    enableItemFinder: true
  });
  return (
    <>
      <div className="mb-6"><MinecraftEditionSelector edition={edition} basePath={buildMinecraftCollectionPath(slug, collection)} searchParams={searchParams} /></div>
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
