import "server-only";
import {
  buildMinecraftCollectionPath,
  getPublishedMinecraftWikiCollectionEditionSummary,
  type MinecraftWikiCollectionPage
} from "@/lib/minecraft";
import { minecraftEditionHref, type MinecraftEdition } from "@/lib/minecraft-edition";
import { renderMarkdown } from "@/lib/markdown";

export async function loadMinecraftWikiCollectionCards(collections: MinecraftWikiCollectionPage[], edition: MinecraftEdition) {
  const cards = await Promise.all(collections.map(async collection => {
    const summary = (await getPublishedMinecraftWikiCollectionEditionSummary(collection))[edition];
    if (!summary.itemCount) return null;
    const copyHtml = collection.wiki_md ? await renderMarkdown(collection.wiki_md, { paragraphizeLineBreaks: true }) : "";
    return {
      collection,
      copyHtml,
      itemCount: summary.itemCount,
      imageUrls: summary.imageUrls,
      href: minecraftEditionHref(buildMinecraftCollectionPath(collection.wiki_slug, collection.collection_slug), edition)
    };
  }));
  return cards.filter(card => card !== null);
}
