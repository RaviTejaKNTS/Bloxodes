import type { Metadata } from "next";
import { getGameLandingForLinks } from "@/lib/game-landing";
import { notFound } from "next/navigation";
import { prepareGameCollectionDocument, renderGameCollectionPage } from "@/app/(site)/wiki/collections/games/generic";
import { createGameReader, type SharedGameWikiCollectionPage } from "@/lib/shared-game-reader";
import { supabaseAdmin } from "@/lib/supabase";
import { buildPageContentHtml } from "@/lib/page-content";
import { buildAlternates, resolveSeoTitle, SITE_URL, SITE_NAME } from "@/lib/seo";
import { renderGameCollectibleCollectionPage } from "./GameCollectibleCollectionPage";
import { GameCollectionSidebarLayout } from "./GameCollectionSidebarLayout";

export async function gameCollectionMetadata(page: SharedGameWikiCollectionPage, currentPage = 1): Promise<Metadata> {
  const runtime = await createGameReader(page.namespace).getPublishedSharedGameWikiCollectionRuntime(page);
  if (!runtime) throw new Error(`Published collection ${page.code} has no verified runtime.`);
  const prepared = prepareGameCollectionDocument(runtime.config, runtime.document);
  if (!Number.isSafeInteger(currentPage) || currentPage < 1 || currentPage > prepared.totalPages || (page.page_type === "collectible" && currentPage !== 1)) notFound();
  const path = currentPage === 1 ? page.canonical_path : `${page.canonical_path}/page/${currentPage}`;
  const title = `${resolveSeoTitle(page.seo_title) ?? page.title}${currentPage === 1 ? "" : ` - Page ${currentPage}`}`;
  const image = runtime.document.items.find(item => item.system.image)?.system.image || page.thumb_url || page.game_cover_image || `${SITE_URL}/Bloxodes.png`;
  return { twitter: { card: "summary_large_image", images: image ? [image] : [] }, title, description: page.meta_description, alternates: buildAlternates(`${SITE_URL}${path}`), robots: currentPage > 1 ? { index: false, follow: true } : undefined, openGraph: { title, description: page.meta_description, url: `${SITE_URL}${path}`, siteName: SITE_NAME, images: image ? [image] : [] } };
}
export async function renderSharedGameCollection({ page, namespaceTitle, currentPage = 1 }: { page: SharedGameWikiCollectionPage; namespaceTitle: string; currentPage?: number }) {
  const reader = createGameReader(page.namespace);
  const runtime = await reader.getPublishedSharedGameWikiCollectionRuntime(page);
  if (!runtime) throw new Error(`Published collection ${page.code} has no verified runtime.`);
  const prepared = prepareGameCollectionDocument(runtime.config, runtime.document);
  if (!Number.isSafeInteger(currentPage) || currentPage < 1 || currentPage > prepared.totalPages || (page.page_type === "collectible" && currentPage !== 1)) notFound();
  const [contentHtml, collections, wiki] = await Promise.all([buildPageContentHtml(page), reader.listPublishedSharedGameWikiCollectionsByWikiSlug(page.wiki_slug), supabaseAdmin().from("game_wiki_pages_view").select("canonical_path").eq("id", page.wiki_page_id).eq("is_published", true).single()]);
  if (wiki.error || !wiki.data) throw new Error("Published collection wiki is missing.");
  const collectionOptions = collections.map(p => ({ value: p.code, label: p.display_name, href: p.canonical_path, pageType: p.page_type }));
  const landing = await getGameLandingForLinks(page.namespace);
  const rendered = page.page_type === "collectible"
    ? renderGameCollectibleCollectionPage({ page, namespaceTitle, wikiPath: wiki.data.canonical_path, config: runtime.config, dataset: prepared.dataset, groupedSections: prepared.groupedSections, contentHtml, collectionOptions, landingPath: landing?.path })
    : renderGameCollectionPage({ config: runtime.config, dataset: prepared.dataset, contentHtml, currentPage, prepared, collectionBasePath: page.canonical_path, routeBase: page.canonical_path.startsWith("/wiki/") ? (landing.path.startsWith("/games/") ? landing.path : "/wiki") : `/${page.namespace}/wiki`, wikiHomePath: wiki.data.canonical_path, wikiLabel: page.canonical_path.startsWith("/wiki/") ? (landing.path.startsWith("/games/") ? namespaceTitle : "Wiki") : `${namespaceTitle} Wiki`, collectionOptions, commentsEntityType: "game_collection", showMoreCollections: false, enableItemFinder: true, stream: true });
  return <GameCollectionSidebarLayout canonicalPath={page.canonical_path} title={page.title} code={page.code} gameName={page.game_short_title || page.game_title} wikiPath={wiki.data.canonical_path} collectionOptions={collections.map(p => ({ value: p.code, label: p.display_name, href: p.canonical_path, description: p.meta_description }))}>{rendered}</GameCollectionSidebarLayout>;
}
