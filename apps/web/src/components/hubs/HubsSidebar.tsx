import { listGameMenus } from "@/lib/game-site-data";
import { gameSidebarLinks } from "@/lib/game-site-navigation";
import type { ReactNode } from "react";
import { PageSidebar } from "@/components/PageSidebar";
import { RailLinkList, type RailLink } from "@/components/RailLinkList";
import { SocialShare } from "@/components/SocialShare";
import { SITE_URL } from "@/lib/seo";
import "@/styles/ads-hubs.css";

export type HubsSidebarLink = RailLink;

export const POPULAR_LINKS: HubsSidebarLink[] = [
  { href: "/codes", title: "Roblox codes", description: "Active codes and rewards for popular Roblox games." },
  { href: "/wiki", title: "Roblox game wikis", description: "Items, progression and mechanics for Roblox games." },
  { href: "/stats", title: "Live Roblox stats", description: "See which Roblox games players are in right now." },
  { href: "/catalog/roblox-music-ids", title: "Roblox music IDs", description: "Find songs and copy audio IDs for radios and boomboxes." },
  { href: "/catalog/free-roblox-items", title: "Free Roblox items", description: "Find free accessories, clothing, body parts and avatar bundles." },
  { href: "/tools", title: "Roblox tools", description: "Calculators for Robux, DevEx and popular games." }
];

export async function hubsSidebarLinksFor(namespace: string, gameId?: string) {
  const menu = (await listGameMenus(namespace, gameId).catch(() => [])).find(menu => menu.namespace === namespace);
  return menu ? { heading: `More for ${menu.title}`, links: gameSidebarLinks(menu, gameId) } : { heading: "Popular pages", links: POPULAR_LINKS };
}

/** Rail for pages that already own their `content-sidebar-grid` (static and policy pages). */
export async function HubsPageSidebar({ canonicalPath, title, shareHeading = "Share with your friends", heading = "Popular pages", links = POPULAR_LINKS }: {
  canonicalPath: string;
  title: string;
  shareHeading?: string;
  heading?: string;
  links?: HubsSidebarLink[];
}) {
  return (
    <PageSidebar className="hidden lg:block">
      <SocialShare url={`${SITE_URL.replace(/\/$/, "")}${canonicalPath}`} title={title} heading={shareHeading} />
      <RailLinkList heading={heading} links={links.filter(link => link.href !== canonicalPath).slice(0, 6)} />
    </PageSidebar>
  );
}

/**
 * Hub, landing, author and static pages: main column plus the right rail. Mediavine adds sticky
 * sidebar ads after the rail's short content (share box plus one six-link list).
 */
export async function HubsSidebarLayout({
  children,
  canonicalPath,
  title,
  shareHeading = "Share this page with your friends",
  analytics,
  heading,
  links,
  footer,
  className
}: {
  children: ReactNode;
  canonicalPath: string;
  title: string;
  shareHeading?: string;
  analytics?: { contentType: string; itemId: string };
  heading: string;
  links: HubsSidebarLink[];
  footer?: { href: string; label: string };
  className?: string;
}) {
  const visible = links.filter(link => link.href !== canonicalPath).slice(0, 6);
  return (
    <div className={className ? `grid gap-8 content-sidebar-grid ${className}` : "grid gap-8 content-sidebar-grid"}>
      <div className="min-w-0 hubs-main">{children}</div>
      <PageSidebar className="hidden lg:block">
        <SocialShare url={`${SITE_URL.replace(/\/$/, "")}${canonicalPath}`} title={title} heading={shareHeading} analytics={analytics} />
        <RailLinkList heading={heading} links={visible} footer={footer} />
      </PageSidebar>
    </div>
  );
}
