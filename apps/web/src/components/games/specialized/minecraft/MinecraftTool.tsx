import { getGameLandingForLinks } from "@/lib/game-landing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DedicatedToolPage, buildDedicatedToolMetadata } from "@/components/tools/DedicatedToolPage";

import { isMinecraftToolSlug } from "@/lib/minecraft-tools/manifest";
import { MinecraftToolClient } from "./MinecraftToolClient";
import { loadMinecraftTool, RelatedMinecraftCollections, RelatedMinecraftTools, toolRules } from "./page-data";

type Props = { params: Promise<{ tool: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = await loadMinecraftTool(slug);
  if (!tool) return { title: "Minecraft tool not found", robots: { index: false, follow: false } };
  return buildDedicatedToolMetadata({ toolCode: slug, fallbackTitle: tool.title, fallbackDescription: tool.meta_description, content: tool, canonicalPath: tool.canonical_path });
}
export default async function MinecraftToolPage({ params }: Props) {
  const { tool: slug } = await params;
  const tool = await loadMinecraftTool(slug);
  if (!tool || !isMinecraftToolSlug(slug)) notFound();
  const rules = toolRules(tool);
  const landing = await getGameLandingForLinks("minecraft");
  return <DedicatedToolPage toolCode={slug} content={tool} fallbackTitle={tool.title} fallbackDescription={tool.meta_description} canonicalPath={tool.canonical_path} commentEntityType="game_tool" breadcrumbItems={[{ label: "Home", href: "/" }, { label: "Minecraft", href: landing.path }, { label: "Tools", href: "/tools" }, { label: tool.title }]} relatedContent={<><RelatedMinecraftCollections tool={slug} /><RelatedMinecraftTools exclude={slug} /></>}>
    <MinecraftToolClient slug={slug} rules={rules} />
  </DedicatedToolPage>;
}
