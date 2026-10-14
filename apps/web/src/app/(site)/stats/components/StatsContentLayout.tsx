import type { ReactNode } from "react";
import { PageSidebar } from "@/components/PageSidebar";
import { RailLinkList } from "@/components/RailLinkList";
import { SocialShare } from "@/components/SocialShare";
import { SITE_URL } from "@/lib/seo";
import { PUBLISHED_STATS_REPORTS } from "@/data/reports/published";
import "@/styles/ads-stats.css";

const latestReport = PUBLISHED_STATS_REPORTS[0];

const pages = [
  { href: "/stats", title: "Roblox stats", description: "See player counts, rising games, visits and genre trends." },
  { href: "/stats/games", title: "Roblox game rankings", description: "Compare games by players, visits, ratings and growth." },
  { href: "/stats/items", title: "Roblox item stats", description: "Compare favorites, prices and resale history for avatar items." },
  { href: "/stats/creators", title: "Roblox creator stats", description: "Compare creators by players, games, visits and group size." },
  { href: "/stats/roblox-platform", title: "Roblox platform stats", description: "Follow player trends and the most active Roblox genres." },
  { href: "/stats/reports", title: "Monthly Roblox reports", description: "Read about the games and events that shaped each month." },
  { href: latestReport.href, title: `Roblox in ${latestReport.month}`, description: latestReport.description }
];

export function StatsContentLayout({ children, title, canonicalPath }: {
  children: ReactNode;
  title: string;
  canonicalPath: string;
}) {
  return (
    <div className="stats-ad-layout grid gap-8 content-sidebar-grid">
      <div className="stats-ad-main min-w-0">{children}</div>
      <PageSidebar className="stats-ad-sidebar">
        <SocialShare url={`${SITE_URL}${canonicalPath}`} title={title} heading="Share these stats" />
        <RailLinkList heading="More Roblox stats" links={pages.filter(page => page.href !== canonicalPath).slice(0, 6)} />
      </PageSidebar>
    </div>
  );
}
