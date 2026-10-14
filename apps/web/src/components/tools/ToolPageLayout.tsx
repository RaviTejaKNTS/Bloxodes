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
const minecraftTools = [
  { code: "xp-calculator", title: "Minecraft XP calculator", description: "Work out the experience needed to reach your target level." },
  { code: "nether-coordinate-converter", title: "Nether coordinate converter", description: "Convert coordinates between the Overworld and Nether." },
  { code: "stack-and-storage-calculator", title: "Stack and storage calculator", description: "Calculate stacks and containers for your items." },
  { code: "furnace-fuel-calculator", title: "Furnace fuel calculator", description: "Plan fuel for your next batch of smelting." },
  { code: "crafting-materials-planner", title: "Crafting materials planner", description: "Work out the materials needed for your crafts." },
  { code: "beacon-materials-calculator", title: "Beacon materials calculator", description: "Calculate the blocks needed for your beacon pyramid." },
  { code: "building-materials-estimator", title: "Building materials estimator", description: "Estimate the blocks needed for your next build." }
];

export function ToolPageLayout({ children, title, canonicalPath, toolCode, sidebarContent }: {
  children: ReactNode;
  title: string;
  canonicalPath: string;
  toolCode?: string;
  sidebarContent?: ReactNode;
}) {
  const minecraft = canonicalPath.startsWith("/minecraft/");
  const links = (minecraft ? minecraftTools : robloxTools).filter(tool => tool.code !== toolCode).slice(0, 6);
  const basePath = minecraft ? "/minecraft/tools" : "/tools";
  return (
    <div className="grid gap-8 content-sidebar-grid ads-tools-layout">
      <div className="min-w-0 ads-tools-main">{children}</div>
      <PageSidebar>
        <SocialShare url={`${SITE_URL.replace(/\/$/, "")}${canonicalPath}`} title={title} heading="Share this tool" analytics={{ contentType: "tool", itemId: toolCode ?? basePath }} />
        {sidebarContent ?? (
          <RailLinkList heading="More tools" links={links.map(tool => ({ href: `${basePath}/${tool.code}`, title: tool.title, description: tool.description }))} />
        )}
      </PageSidebar>
    </div>
  );
}
