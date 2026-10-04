import Link from "next/link";
import { cache } from "react";
import { ContentCard } from "@/components/ContentCard";
import { ToolCard } from "@/components/ToolCard";
import { buildMinecraftCollectionPath, getMinecraftTool, listMinecraftTools, listPublishedMinecraftCollections, type MinecraftToolPage } from "@/lib/minecraft";
import { isMinecraftToolSlug, MINECRAFT_TOOL_COLLECTIONS } from "@/lib/minecraft-tools/manifest";
import type { ToolRules } from "@/lib/minecraft-tools/types";

export const loadMinecraftTool = cache(async (slug: string) => isMinecraftToolSlug(slug) ? getMinecraftTool(slug) : null);
export function toolRules(tool: MinecraftToolPage): ToolRules {
  const raw = tool.rules_json;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Published tool ${tool.slug} has no verified rules.`);
  const rules = raw as unknown as ToolRules;
  if (typeof rules.revision !== "string" || !Array.isArray(rules.editions) || !rules.editions.length) throw new Error(`Published tool ${tool.slug} has an invalid rules revision.`);
  return rules;
}
export function MinecraftToolCards({ tools, hub = false }: { tools: MinecraftToolPage[]; hub?: boolean }) {
  return (
    <section
      id={hub ? "article-body" : undefined}
      itemProp={hub ? "articleBody" : undefined}
      className="journey-content-stream journey-content-stream--index"
    >
      {tools.map((tool, index) => (
        <div
          key={tool.id}
          data-journey-item
          className="h-full"
          data-analytics-event="select_item"
          data-analytics-item-list-name={hub ? "minecraft_tools_index" : "minecraft_related_tools"}
          data-analytics-item-id={tool.slug}
          data-analytics-item-name={tool.title}
          data-analytics-position={index + 1}
          data-analytics-content-type="tool"
        >
          <ToolCard tool={tool} href={`/minecraft/tools/${tool.slug}`} />
        </div>
      ))}
    </section>
  );
}
export async function RelatedMinecraftTools({ exclude, collection }: { exclude?: string; collection?: string }) {
  const tools = (await listMinecraftTools()).filter(tool => tool.slug !== exclude && isMinecraftToolSlug(tool.slug) && (!collection || MINECRAFT_TOOL_COLLECTIONS[tool.slug].includes(collection)));
  if (!tools.length) return null;
  return <section className="mt-10 space-y-4"><h2 className="text-2xl font-semibold">{collection ? "Tools for this collection" : "More Minecraft tools"}</h2><MinecraftToolCards tools={tools.slice(0, 4)} /><Link href="/minecraft/tools" className="text-sm text-accent hover:underline">View all Minecraft tools</Link></section>;
}

export async function RelatedMinecraftCollections({ tool }: { tool: string }) {
  if (!isMinecraftToolSlug(tool)) return null;
  const relevant = MINECRAFT_TOOL_COLLECTIONS[tool];
  const collections = (await listPublishedMinecraftCollections()).filter(entry => relevant.includes(entry.collection_slug));
  if (!collections.length) return null;
  return <section className="mt-10 space-y-4"><h2 className="text-2xl font-semibold">Minecraft reference collections</h2><div className="space-y-3">{collections.map(entry => <ContentCard key={entry.code} type="wiki" variant="bar" href={buildMinecraftCollectionPath(entry.wiki_slug, entry.collection_slug)} title={entry.title} subtitle={entry.meta_description} />)}</div></section>;
}
