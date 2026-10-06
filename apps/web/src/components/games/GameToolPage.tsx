import { DedicatedToolPage, buildDedicatedToolMetadata } from "@/components/tools/DedicatedToolPage";
import type { GameToolPage as ToolPage } from "@/lib/game-registry";
import { ResourceCostTool } from "./ResourceCostTool";
export function validateSharedTool(tool: ToolPage) {
  const rules = tool.rules_json;
  if (tool.tool_key !== "resource-cost" || !rules || typeof rules.unitCost !== "number" || !Number.isFinite(rules.unitCost) || rules.unitCost < 0 || typeof rules.resourceLabel !== "string" || !rules.resourceLabel.trim()) throw new Error(`Tool ${tool.code} needs a registered calculator and verified rules.`);
  return { unitCost: rules.unitCost, resourceLabel: rules.resourceLabel };
}
export function gameToolMetadata(tool: ToolPage) { return buildDedicatedToolMetadata({ toolCode: tool.code, fallbackTitle: tool.title, fallbackDescription: tool.meta_description, content: tool, canonicalPath: tool.canonical_path }); }
export function GameToolPage({ tool, namespaceTitle }: { tool: ToolPage; namespaceTitle: string }) {
  const rules = validateSharedTool(tool);
  return <DedicatedToolPage toolCode={tool.code} content={tool} fallbackTitle={tool.title} fallbackDescription={tool.meta_description} canonicalPath={tool.canonical_path} commentEntityType="game_tool" breadcrumbItems={[{ label: "Home", href: "/" }, { label: namespaceTitle, href: `/${tool.namespace}` }, { label: tool.title }]} relatedContent={null}><ResourceCostTool {...rules} /></DedicatedToolPage>;
}
