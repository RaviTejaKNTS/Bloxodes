"use client";
import type { Edition, ToolRules } from "@/lib/minecraft-tools/types";
import type { MinecraftToolSlug } from "@/lib/minecraft-tools/manifest";
import { AnvilTool, BrewingTool, CommandTool, CraftingTool, GearTool } from "./DataTools";
import { BeaconTool, BuildingTool, CircleTool, FurnaceTool, NetherTool, StorageTool, StrongholdTool, XpTool } from "./BasicTools";
export function MinecraftToolClient({ slug, rules, edition }: { slug: MinecraftToolSlug; rules: ToolRules; edition: Edition }) {
  if (!rules.editions.includes(edition)) return <div role="status" className="not-prose rounded-lg border border-border p-4"><p className="font-medium">These rules have not been verified for {edition === "java" ? "Java" : "Bedrock"} Edition.</p><p className="mt-2 text-sm text-muted">Choose a supported edition above. The calculator does not substitute another edition's values.</p></div>;
  rules = { ...rules, ...rules.editionRules?.[edition] };
  switch (slug) {
    case "nether-coordinate-converter": return <NetherTool />;
    case "stack-and-storage-calculator": return <StorageTool rules={rules} edition={edition} />;
    case "furnace-fuel-calculator": return <FurnaceTool rules={rules} edition={edition} />;
    case "pixel-circle-generator": return <CircleTool />;
    case "anvil-enchantment-planner": return <AnvilTool rules={rules} edition={edition} />;
    case "crafting-materials-planner": return <CraftingTool rules={rules} edition={edition} />;
    case "brewing-planner": return <BrewingTool rules={rules} edition={edition} />;
    case "xp-calculator": return <XpTool />;
    case "beacon-materials-calculator": return <BeaconTool />;
    case "building-materials-estimator": return <BuildingTool />;
    case "gear-comparison": return <GearTool rules={rules} edition={edition} />;
    case "command-generator": return <CommandTool rules={rules} edition={edition} />;
    case "stronghold-triangulation": return <StrongholdTool />;
  }
}
