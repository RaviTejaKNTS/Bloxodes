import type { ReactNode } from "react";
import { PageSidebar } from "@/components/PageSidebar";
import { RailLinkList } from "@/components/RailLinkList";
import { SocialShare } from "@/components/SocialShare";
import { SITE_URL } from "@/lib/seo";
import { listStatsReportsOrStatic } from "@/lib/stats-reports";
import "@/styles/ads-stats.css";



const pages = [
  { href: "/stats", title: "Roblox stats", description: "See player counts, rising games, visits and genre trends." },
  { href: "/stats/games", title: "Roblox game rankings", description: "Compare games by players, visits, ratings and growth." },
  { href: "/stats/items", title: "Roblox item stats", description: "Compare favorites, prices and resale history for avatar items." },
  { href: "/stats/creators", title: "Roblox creator stats", description: "Compare creators by players, games, visits and group size." },
  { href: "/stats/roblox-platform", title: "Roblox platform stats", description: "Follow player trends and the most active Roblox genres." },
  { href: "/stats/reports", title: "Monthly Roblox reports", description: "Read about the games and events that shaped each month." },

];

export async function StatsContentLayout({ children, title, canonicalPath }: {
  children: ReactNode;
  title: string;
  canonicalPath: string;
}) {
  const latestReport = (await listStatsReportsOrStatic("the stats rail"))[0];
  const reportPages = [...(latestReport ? [{ href: latestReport.href, title: `Roblox in ${latestReport.month}`, description: latestReport.description }] : []), ...pages];
  return (
    <div className="stats-ad-layout grid gap-8 content-sidebar-grid">
      <div className="stats-ad-main min-w-0">{children}</div>
      <PageSidebar className="stats-ad-sidebar">
        <SocialShare url={`${SITE_URL}${canonicalPath}`} title={title} heading="Share these stats" />
        <RailLinkList heading="More Roblox stats" links={reportPages.filter(page => page.href !== canonicalPath).slice(0, 6)} />
      </PageSidebar>
    </div>
  );
}
