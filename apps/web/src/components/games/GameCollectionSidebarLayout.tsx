import type { ReactNode } from "react";
import { PageSidebar } from "@/components/PageSidebar";
import { GameCollectionsRail, type CollectionRailLink } from "@/components/game-sidebar/GameCollectionsRail";
import { WikiCard } from "@/components/game-sidebar/GameDiscoverySidebar";
import { SocialShare } from "@/components/SocialShare";
import { SITE_URL } from "@/lib/seo";
import "@/styles/ads-collections.css";

/**
 * Shared game collection pages: main column plus the
 * right rail. Mediavine adds sticky sidebar ads after the rail's short content.
 */
export function GameCollectionSidebarLayout({
  children,
  canonicalPath,
  title,
  code,
  gameName,
  wikiPath,
  collectionOptions,
  wikiImage,
  otherPages
}: {
  children: ReactNode;
  canonicalPath: string;
  title: string;
  code: string;
  gameName: string;
  wikiPath: string;
  collectionOptions: CollectionRailLink[];
  wikiImage: string | null;
  otherPages?: ReactNode;
}) {
  const rail = <GameCollectionsRail gameName={gameName} collections={collectionOptions} />;
  return (
    <div className="grid gap-8 content-sidebar-grid">
      <div className="min-w-0">{children}<div className="mt-10 lg:hidden">{rail}</div></div>
      <PageSidebar className="hidden lg:block">
        <SocialShare
          url={`${SITE_URL.replace(/\/$/, "")}${canonicalPath}`}
          title={title}
          heading="Share this collection with your friends"
          analytics={{ contentType: "game_collection", itemId: code }}
        />
        <WikiCard href={wikiPath} title={`${gameName} Wiki`} iconUrl={wikiImage} />
        {rail}
        {otherPages}
      </PageSidebar>
    </div>
  );
}
