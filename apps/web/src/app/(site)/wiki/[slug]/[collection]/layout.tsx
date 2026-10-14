import "@/styles/ads-collections.css";
import { PageSidebar } from "@/components/PageSidebar";
import { SocialShare } from "@/components/SocialShare";
import { GameDiscoverySidebar } from "@/components/game-sidebar/GameDiscoverySidebar";
import { getWikiPageBySlug } from "@/lib/wiki";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAlternates, SITE_URL } from "@/lib/seo";
import { buildWikiCollectionPath, getWikiCollectionPageByPath } from "@/lib/wiki-collections";

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
  return (
    <div className="grid gap-8 content-sidebar-grid">
      <div className="min-w-0">{children}</div>
      <PageSidebar className="hidden lg:block">
        <SocialShare url={`${SITE_URL.replace(/\/$/, "")}${buildWikiCollectionPath(slug, collection)}`} title={page.title} heading="Share this collection with your friends" analytics={{ contentType: "wiki_collection", itemId: page.code }} />
        <GameDiscoverySidebar universeId={page.universe_id ?? wiki?.universe_id} universeName={wiki?.universe_display_name ?? wiki?.universe_name ?? null} currentType="collection" />
      </PageSidebar>
    </div>
  );
}
