import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prepareGameCollectionDocument, renderGameCollectionPage } from "@/app/(site)/wiki/collections/games/generic";
import { createGameReader, type SharedGameWikiCollectionPage } from "@/lib/shared-game-reader";
import { supabaseAdmin } from "@/lib/supabase";
import { buildPageContentHtml } from "@/lib/page-content";
import { buildAlternates, resolveSeoTitle, SITE_URL, SITE_NAME } from "@/lib/seo";
import { renderGameCollectibleCollectionPage } from "./GameCollectibleCollectionPage";

export async function gameCollectionMetadata(page: SharedGameWikiCollectionPage, currentPage = 1): Promise<Metadata> {
  const runtime = await createGameReader(page.namespace).getPublishedSharedGameWikiCollectionRuntime(page);
  if (!runtime) throw new Error(`Published collection ${page.code} has no verified runtime.`);
  const prepared = prepareGameCollectionDocument(runtime.config, runtime.document);
  if (!Number.isSafeInteger(currentPage) || currentPage < 1 || currentPage > prepared.totalPages || (page.page_type === "collectible" && currentPage !== 1)) notFound();
  const path = currentPage === 1 ? page.canonical_path : `${page.canonical_path}/page/${currentPage}`;
  const title = `${resolveSeoTitle(page.seo_title) ?? page.title}${currentPage === 1 ? "" : ` - Page ${currentPage}`}`;
  return { title, description: page.meta_description, alternates: buildAlternates(`${SITE_URL}${path}`), robots: currentPage > 1 && page.namespace !== "gta" ? { index: false, follow: true } : undefined, openGraph: { title, description: page.meta_description, url: `${SITE_URL}${path}`, siteName: SITE_NAME } };
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
  if (page.page_type === "collectible") return renderGameCollectibleCollectionPage({ page, namespaceTitle, wikiPath: wiki.data.canonical_path, config: runtime.config, dataset: prepared.dataset, groupedSections: prepared.groupedSections, contentHtml, collectionOptions });
  return renderGameCollectionPage({ config: runtime.config, dataset: prepared.dataset, contentHtml, currentPage, prepared, collectionBasePath: page.canonical_path, routeBase: `/${page.namespace}/wiki`, wikiHomePath: wiki.data.canonical_path, wikiLabel: `${namespaceTitle} Wiki`, collectionOptions, commentsEntityType: page.namespace === "gta" ? "gta_wiki_collection" : page.namespace === "red-dead" ? "red_dead_wiki_collection" : page.namespace === "minecraft" ? "minecraft_wiki_collection" : "game_collection", showMoreCollections: false, enableItemFinder: true });
}
