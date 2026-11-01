import { getGameMenuForPath } from "@/lib/game-site-data";
import { headers } from "next/headers";
import { REQUEST_GAME_PATH_HEADER } from "@/lib/request-headers";
import type { ReactNode } from "react";
import { PageSidebar } from "@/components/PageSidebar";
import { RailLinkList } from "@/components/RailLinkList";
import { SocialShare } from "@/components/SocialShare";
import { SITE_URL } from "@/lib/seo";
import "@/styles/ads-tools.css";

const robloxTools = [
  { code: "robux-to-usd-calculator", title: "Robux to USD calculator", description: "Compare Robux purchases and work out their dollar cost." },
  { code: "roblox-devex-calculator", title: "Roblox DevEx calculator", description: "Calculate the cash value of Earned Robux." },
  { code: "roblox-username-generator", title: "Roblox username generator", description: "Find username ideas and check their availability." },
  { code: "the-forge-inventory-optimizer", title: "The Forge inventory optimizer", description: "Plan what to craft with the ores in your inventory." },
  { code: "grow-a-garden-crop-value-calculator", title: "Grow a Garden crop value calculator", description: "Calculate crop values with weight and mutations." },
  { code: "wizard-alchemy-potion-planner", title: "Wizard Alchemy potion planner", description: "Plan potion Magic totals and material shortfalls." },
  { code: "wizard-alchemy-race-reroll-calculator", title: "Wizard Alchemy race reroll calculator", description: "Compare race odds and plan your reroll budget." }
];
export async function RelatedToolLinks({ canonicalPath, toolCode }: { canonicalPath: string; toolCode?: string }) {
  const gamePath = (await headers()).get(REQUEST_GAME_PATH_HEADER);
  const menu = gamePath === canonicalPath ? await getGameMenuForPath(canonicalPath) : null;
  const owner = menu?.pages.find(page => page.href === canonicalPath);
  const links = menu
    ? menu.pages.filter(page => page.kind === "tool" && page.gameId === owner?.gameId && page.href !== canonicalPath).map(page => ({ href: page.href, title: page.title }))
    : robloxTools.filter(tool => tool.code !== toolCode).map(tool => ({ href: `/tools/${tool.code}`, title: tool.title, description: tool.description }));
  return <RailLinkList heading="More tools" links={links.slice(0, 6)} />;
}

export function ToolPageLayout({ children, title, canonicalPath, toolCode, sidebarContent }: {
  children: ReactNode;
  title: string;
  canonicalPath: string;
  toolCode?: string;
  sidebarContent?: ReactNode;
}) {
  return (
    <div className="grid gap-8 content-sidebar-grid ads-tools-layout">
      <div className="min-w-0 ads-tools-main">{children}</div>
      <PageSidebar>
        <SocialShare url={`${SITE_URL.replace(/\/$/, "")}${canonicalPath}`} title={title} heading="Share this tool" analytics={{ contentType: "tool", itemId: toolCode ?? canonicalPath }} />
        {sidebarContent ?? (
          <RailLinkList heading="More tools" links={robloxTools.filter(tool => tool.code !== toolCode).slice(0, 6).map(tool => ({ href: `/tools/${tool.code}`, title: tool.title, description: tool.description }))} />
        )}
      </PageSidebar>
    </div>
  );
}
