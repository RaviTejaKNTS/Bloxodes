import type { ReactNode } from "react";
import { PageSidebar } from "@/components/PageSidebar";
import { RailLinkList } from "@/components/RailLinkList";
import { SocialShare } from "@/components/SocialShare";
import { SITE_URL } from "@/lib/seo";
import "@/styles/ads-collections.css";

type CollectionLink = { value: string; label: string; href: string; description?: string | null };

const MAX_RELATED = 6;

/** Sibling collections that follow the current one, wrapping around, so every collection gets linked from somewhere. */
function pickRelated(options: CollectionLink[], currentCode: string): CollectionLink[] {
  const index = options.findIndex(option => option.value === currentCode);
  if (index < 0) return options.slice(0, MAX_RELATED);
  const ordered = [...options.slice(index + 1), ...options.slice(0, index)];
  return ordered.slice(0, MAX_RELATED);
}

/**
 * Franchise collection pages (GTA, Red Dead, Minecraft and shared games): main column plus the
 * right rail. Mediavine adds sticky sidebar ads after the rail's short content.
 */
export function GameCollectionSidebarLayout({
  children,
  canonicalPath,
  title,
  code,
  gameName,
  wikiPath,
  collectionOptions
}: {
  children: ReactNode;
  canonicalPath: string;
  title: string;
  code: string;
  gameName: string;
  wikiPath: string;
  collectionOptions: CollectionLink[];
}) {
  const related = pickRelated(collectionOptions, code);
  return (
    <div className="grid gap-8 content-sidebar-grid">
      <div className="min-w-0">{children}</div>
      <PageSidebar className="hidden lg:block">
        <SocialShare
          url={`${SITE_URL.replace(/\/$/, "")}${canonicalPath}`}
          title={title}
          heading="Share this collection with your friends"
          analytics={{ contentType: "game_collection", itemId: code }}
        />
        <RailLinkList
          heading={`More ${gameName} collections`}
          links={related.map(option => ({ href: option.href, title: option.label, description: option.description }))}
          footer={{ href: wikiPath, label: `${gameName} wiki` }}
        />
      </PageSidebar>
    </div>
  );
}
