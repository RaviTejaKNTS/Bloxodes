import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DedicatedToolPage, buildDedicatedToolMetadata } from "@/components/tools/DedicatedToolPage";
import { MinecraftEditionSelector } from "@/components/minecraft/MinecraftEditionSelector";
import { isMinecraftToolSlug } from "@/lib/minecraft-tools/manifest";
import { MinecraftToolClient } from "../MinecraftToolClient";
import { loadMinecraftTool, RelatedMinecraftCollections, RelatedMinecraftTools, resolveToolEdition, rulesForEdition, toolRules } from "../page-data";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ tool: string }>; searchParams: Promise<{ edition?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = await loadMinecraftTool(slug);
  if (!tool) return { title: "Minecraft tool not found", robots: { index: false, follow: false } };
  return buildDedicatedToolMetadata({ toolCode: slug, fallbackTitle: tool.title, fallbackDescription: tool.meta_description, content: tool, canonicalPath: `/minecraft/tools/${slug}` });
}
export default async function MinecraftToolPage({ params, searchParams }: Props) {
  const [{ tool: slug }, search] = await Promise.all([params, searchParams]);
  const tool = await loadMinecraftTool(slug);
  if (!tool || !isMinecraftToolSlug(slug)) notFound();
  const edition = await resolveToolEdition(search.edition), rules = rulesForEdition(toolRules(tool), edition);
  return <DedicatedToolPage toolCode={slug} content={tool} fallbackTitle={tool.title} fallbackDescription={tool.meta_description} canonicalPath={`/minecraft/tools/${slug}`} commentEntityType="minecraft_tool" breadcrumbItems={[{ label: "Home", href: "/" }, { label: "Minecraft", href: "/minecraft" }, { label: "Tools", href: "/minecraft/tools" }, { label: tool.title }]} relatedContent={<><RelatedMinecraftCollections tool={slug} /><RelatedMinecraftTools exclude={slug} /></>}>
    <div className="not-prose mb-5 space-y-3"><MinecraftEditionSelector edition={edition} basePath={`/minecraft/tools/${slug}`} searchParams={search} /><p className="text-xs text-muted">{rules.versions?.[edition] ? `Rules checked for ${edition === "java" ? "Java" : "Bedrock"} ${rules.versions[edition]}.` : "Block geometry is shared across editions."}</p></div>
    <MinecraftToolClient key={`${slug}-${edition}`} slug={slug} rules={rules} edition={edition} />
  </DedicatedToolPage>;
}
