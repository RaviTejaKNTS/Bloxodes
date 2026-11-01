import "server-only";
import { notFound } from "next/navigation";
import type { SharedGameWikiCollectionPage } from "./shared-game-reader";

/** Reuse the specialist adapters: datasets, progress keys and comments keep their owners. */
export async function specializedCollectionRoute(page: SharedGameWikiCollectionPage, currentPage: number) {
  const props = { slug: page.wiki_slug, collection: page.collection_slug, currentPage };
  switch (page.namespace) {
    case "gta": {
      const adapter = await import("@/components/games/specialized/GtaCollection");
      return {
        render: () => { if (page.page_type === "collectible" && currentPage > 1) notFound(); return adapter.renderGtaCollectionPage(props); },
        metadata: () => adapter.generateGtaCollectionMetadata(props)
      };
    }
    case "red-dead": {
      const adapter = await import("@/components/games/specialized/RedDeadCollection");
      return {
        render: () => { if (page.page_type === "collectible" && currentPage > 1) notFound(); return adapter.renderRedDeadCollectionPageRoute(props); },
        metadata: () => adapter.generateRedDeadCollectionMetadata(props)
      };
    }
    case "minecraft": {
      const adapter = await import("@/components/games/specialized/MinecraftCollection");
      return {
        render: () => adapter.renderMinecraftCollectionPageRoute(props),
        metadata: () => adapter.generateMinecraftCollectionMetadata(props)
      };
    }
    default: return null;
  }
}

export async function specializedMinecraftToolRoute(namespace: string, slug: string) {
  if (namespace !== "minecraft") return null;
  const adapter = await import("@/components/games/specialized/minecraft/MinecraftTool");
  const props = { params: Promise.resolve({ tool: slug }) };
  return { render: () => adapter.default(props), metadata: () => adapter.generateMetadata(props) };
}

export async function specializedGtaMapRoute(namespace: string, slug: string) {
  if (namespace !== "gta") return null;
  if (slug === "gta5") {
    const adapter = await import("@/components/games/specialized/Gta5Map");
    return { render: () => adapter.default(), metadata: () => adapter.generateMetadata() };
  }
  const adapter = await import("@/components/games/specialized/GtaMap");
  const props = { params: Promise.resolve({ slug }) };
  return { render: () => adapter.default(props), metadata: () => adapter.generateMetadata(props) };
}
