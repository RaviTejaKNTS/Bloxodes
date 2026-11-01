import { gameLinkPaths } from "@/lib/game-link-paths";
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

export const GTA_LINKS: HubsSidebarLink[] = [
  { href: "/gta/maps", title: "Interactive GTA maps", description: "Zoomable GTA maps with searchable locations and pins." },
  { href: "/gta/maps/gta5", title: "GTA V Story Mode map", description: "Collectible and challenge locations across Los Santos and Blaine County." },
  { href: "/gta/checklists", title: "GTA checklists", description: "100% completion checklists for GTA V, San Andreas, Vice City and GTA Online." },
  { href: "/gta/checklists/gta-5", title: "GTA V 100% checklist", description: "Track every task you need for 100% completion." },
  { href: "/gta/wiki/gta-5/spaceship-parts", title: "GTA V spaceship parts", description: "All 50 spaceship parts and where to find them." },
  { href: "/gta/wiki/gta-5/vehicles", title: "GTA V vehicles", description: "Browse the cars, bikes, planes and boats in GTA V." }
];

export const RED_DEAD_LINKS: HubsSidebarLink[] = [
  { href: "/red-dead/wiki/red-dead-redemption-2/cigarette-cards", title: "RDR2 cigarette cards", description: "All 144 cards across 12 sets, with locations." },
  { href: "/red-dead/wiki/red-dead-redemption-2/dinosaur-bones", title: "RDR2 dinosaur bones", description: "Find all 30 dinosaur bones for A Test of Faith." },
  { href: "/red-dead/wiki/red-dead-redemption-2/legendary-animals", title: "RDR2 legendary animals", description: "Where to find and hunt every legendary animal." },
  { href: "/red-dead/wiki/red-dead-redemption-2/story-missions", title: "RDR2 story missions", description: "Every story mission in Red Dead Redemption 2." },
  { href: "/red-dead/wiki/red-dead-redemption-2/horses", title: "RDR2 horses", description: "Browse the horse breeds in Red Dead Redemption 2." },
  { href: "/red-dead/wiki/red-dead-online/roles", title: "Red Dead Online roles", description: "Compare the five Red Dead Online roles." }
];

export const MINECRAFT_LINKS: HubsSidebarLink[] = [
  { href: "/minecraft/java/wiki", title: "Minecraft Java Edition wiki", description: "Collections and reference pages for Java Edition." },
  { href: "/minecraft/bedrock/wiki", title: "Minecraft Bedrock Edition wiki", description: "Collections and reference pages for Bedrock Edition." },
  { href: "/minecraft/tools", title: "Minecraft tools", description: "Calculators and planners for travel, building, crafting and equipment." },
  { href: "/minecraft/java/wiki/enchantments", title: "Minecraft enchantments", description: "Every enchantment and the items it works on." },
  { href: "/minecraft/java/wiki/potions", title: "Minecraft potions", description: "Brewing recipes and effects for every potion." },
  { href: "/minecraft/java/wiki/villager-trades", title: "Villager trades", description: "What each villager profession buys and sells." }
];

const LINKS_BY_NAMESPACE: Record<string, { heading: string; links: HubsSidebarLink[] }> = {
  gta: { heading: "Popular GTA pages", links: GTA_LINKS },
  "red-dead": { heading: "Popular Red Dead pages", links: RED_DEAD_LINKS },
  minecraft: { heading: "Popular Minecraft pages", links: MINECRAFT_LINKS }
};

/** Franchise rail links, or the site-wide popular pages for namespaces without a curated list. */
export function hubsSidebarLinksFor(namespace: string) {
  return LINKS_BY_NAMESPACE[namespace] ?? { heading: "Popular pages", links: POPULAR_LINKS };
}

/** Rail for pages that already own their `content-sidebar-grid` (static and policy pages). */
export async function HubsPageSidebar({ canonicalPath, title, shareHeading = "Share with your friends", heading = "Popular pages", links = POPULAR_LINKS }: {
  canonicalPath: string;
  title: string;
  shareHeading?: string;
  heading?: string;
  links?: HubsSidebarLink[];
}) {
  const paths = await gameLinkPaths();
  links = links.map(link => ({ ...link, href: paths[link.href] ?? link.href }));
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
  const paths = await gameLinkPaths();
  links = links.map(link => ({ ...link, href: paths[link.href] ?? link.href }));
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
