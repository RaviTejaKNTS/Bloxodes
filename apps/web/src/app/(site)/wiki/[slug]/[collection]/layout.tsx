import "@/styles/ads-collections.css";
import { PageSidebar } from "@/components/PageSidebar";
import { SocialShare } from "@/components/SocialShare";
import { GameCollectionsRail, orderOtherCollections } from "@/components/game-sidebar/GameCollectionsRail";
import { listPublishedWikiCollectionRuntimeImages } from "@/lib/wiki-collection-runtime";
import { GameDiscoverySidebar, WikiCard } from "@/components/game-sidebar/GameDiscoverySidebar";
import { getGameSidebarData } from "@/lib/game-sidebar";
import { getWikiPageBySlug } from "@/lib/wiki";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAlternates, SITE_URL } from "@/lib/seo";
import { buildWikiCollectionPath, getWikiCollectionPageByPath, listPublishedWikiCollectionPagesByWikiSlug } from "@/lib/wiki-collections";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; collection: string }>;
}): Promise<Metadata> {
  const { slug, collection } = await params;
  const page = await getWikiCollectionPageByPath(slug, collection);
  if (page?.page_type !== "collectible") return {};

  // Next keeps layout metadata when a child page returns notFound().
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildWikiCollectionPath(slug, collection)}`;
  return { alternates: buildAlternates(canonical) };
}

export default async function WikiCollectionLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string; collection: string }> }) {
  const { slug, collection } = await params;
  const page = await getWikiCollectionPageByPath(slug, collection);
  if (!page) return <>{children}</>;
  const wiki = await getWikiPageBySlug(slug);
  const gameName = wiki?.universe_display_name || wiki?.universe_name || wiki?.title.replace(/ Wiki$/, "") || slug;
  const collections = await listPublishedWikiCollectionPagesByWikiSlug(slug);
  const ordered = orderOtherCollections(collections.map(entry => ({ value: entry.code, label: entry.display_name?.trim() || entry.title, href: buildWikiCollectionPath(entry.wiki_slug, entry.collection_slug), count: entry.item_count })), page.code);
  const railCollections = await Promise.all(ordered.map(async (entry, index) => {
    if (index >= 3) return entry;
    const collectionPage = collections.find(collection => collection.code === entry.value);
    const images = collectionPage ? await listPublishedWikiCollectionRuntimeImages(collectionPage, 1) : null;
    return { ...entry, image: images?.[0] ?? null };
  }));
  const universeId = page.universe_id ?? wiki?.universe_id;
  // The same request-cached data GameDiscoverySidebar reads below, so the wiki card keeps the game's icon.
  const sidebarData = typeof universeId === "number" ? await getGameSidebarData(universeId) : null;
  const rail = <GameCollectionsRail gameName={gameName} collections={railCollections} />;
  return (
    <div className="grid gap-8 content-sidebar-grid">
      <div className="min-w-0">{children}<div className="mt-10 lg:hidden">{rail}</div></div>
      <PageSidebar className="hidden lg:block">
        <SocialShare url={`${SITE_URL.replace(/\/$/, "")}${buildWikiCollectionPath(slug, collection)}`} title={page.title} heading="Share this collection with your friends" analytics={{ contentType: "wiki_collection", itemId: page.code }} />
        {wiki ? <WikiCard slug={slug} title={`${gameName} Wiki`} iconUrl={sidebarData?.universeIcon ?? null} /> : null}
        {rail}
        <GameDiscoverySidebar hideWiki articlesWithoutCover universeId={universeId} universeName={wiki?.universe_display_name ?? wiki?.universe_name ?? null} currentType="collection" />
      </PageSidebar>
    </div>
  );
}
