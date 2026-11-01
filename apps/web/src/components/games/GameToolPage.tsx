import { DedicatedToolPage, buildDedicatedToolMetadata } from "@/components/tools/DedicatedToolPage";
import type { GameToolPage as ToolPage } from "@/lib/game-registry";
import { ResourceCostTool } from "./ResourceCostTool";
import type { ReactNode } from "react";
import { getGameLandingForLinks } from "@/lib/game-landing";
import { gameBreadcrumbs } from "@/lib/game-root-page";
export function validateSharedTool(tool: ToolPage) {
  const rules = tool.rules_json;
  if (tool.tool_key !== "resource-cost" || !rules || typeof rules.unitCost !== "number" || !Number.isFinite(rules.unitCost) || rules.unitCost < 0 || typeof rules.resourceLabel !== "string" || !rules.resourceLabel.trim()) throw new Error(`Tool ${tool.code} needs a registered calculator and verified rules.`);
  return { unitCost: rules.unitCost, resourceLabel: rules.resourceLabel };
}
export function gameToolMetadata(tool: ToolPage) { return buildDedicatedToolMetadata({ toolCode: tool.code, fallbackTitle: tool.title, fallbackDescription: tool.meta_description, content: tool, canonicalPath: tool.canonical_path }); }
export async function GameToolPage({ tool, namespaceTitle, sidebarContent }: { tool: ToolPage; namespaceTitle: string; sidebarContent?: ReactNode }) {
  const rules = validateSharedTool(tool);
  const landing = await getGameLandingForLinks(tool.namespace);
  return <GameToolPageLayout tool={tool} namespaceTitle={namespaceTitle} landingPath={landing.path} sidebarContent={sidebarContent}><ResourceCostTool {...rules} /></GameToolPageLayout>;
}
export function GameToolPageLayout({ tool, namespaceTitle, children, sidebarContent = <></>, landingPath = `/${tool.namespace}` }: { tool: ToolPage; namespaceTitle: string; children: ReactNode; sidebarContent?: ReactNode; landingPath?: string }) {
  const breadcrumbs = gameBreadcrumbs([{ label: "Home", href: "/" }, { label: namespaceTitle, href: landingPath }, { label: "Tools", href: tool.canonical_path.slice(0, tool.canonical_path.lastIndexOf("/")) }, { label: tool.title }], tool.canonical_path);
  return <DedicatedToolPage toolCode={tool.code} content={tool} fallbackTitle={tool.title} fallbackDescription={tool.meta_description} canonicalPath={tool.canonical_path} commentEntityType="game_tool" breadcrumbItems={breadcrumbs} sidebarContent={sidebarContent} relatedContent={null}>{children}</DedicatedToolPage>;
}
