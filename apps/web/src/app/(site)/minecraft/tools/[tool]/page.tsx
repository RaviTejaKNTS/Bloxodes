import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DedicatedToolPage, buildDedicatedToolMetadata } from "@/components/tools/DedicatedToolPage";

import { isMinecraftToolSlug } from "@/lib/minecraft-tools/manifest";
import { MinecraftToolClient } from "../MinecraftToolClient";
import { loadMinecraftTool, RelatedMinecraftCollections, RelatedMinecraftTools, toolRules } from "../page-data";

export const revalidate = 21600;
type Props = { params: Promise<{ tool: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = await loadMinecraftTool(slug);
  if (!tool) return { title: "Minecraft tool not found", robots: { index: false, follow: false } };
  return buildDedicatedToolMetadata({ toolCode: slug, fallbackTitle: tool.title, fallbackDescription: tool.meta_description, content: tool, canonicalPath: `/minecraft/tools/${slug}` });
}
export default async function MinecraftToolPage({ params }: Props) {
  const { tool: slug } = await params;
  const tool = await loadMinecraftTool(slug);
  if (!tool || !isMinecraftToolSlug(slug)) notFound();
  const rules = toolRules(tool);
  return <DedicatedToolPage toolCode={slug} content={tool} fallbackTitle={tool.title} fallbackDescription={tool.meta_description} canonicalPath={`/minecraft/tools/${slug}`} commentEntityType="minecraft_tool" breadcrumbItems={[{ label: "Home", href: "/" }, { label: "Minecraft", href: "/minecraft" }, { label: "Tools", href: "/minecraft/tools" }, { label: tool.title }]} relatedContent={<><RelatedMinecraftCollections tool={slug} /><RelatedMinecraftTools exclude={slug} /></>}>
    <MinecraftToolClient slug={slug} rules={rules} />
  </DedicatedToolPage>;
}
