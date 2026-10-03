import "server-only";
import { buildMinecraftCollectionPath, listPublishedMinecraftWikiCollectionImageUrls, type MinecraftWikiCollectionPage } from "@/lib/minecraft";
import { renderMarkdown } from "@/lib/markdown";

export async function loadMinecraftWikiCollectionCards(collections: MinecraftWikiCollectionPage[]) {
  return Promise.all(collections.map(async collection => {
    const [imageUrls, copyHtml] = await Promise.all([
      listPublishedMinecraftWikiCollectionImageUrls(collection, 6),
      collection.wiki_md ? renderMarkdown(collection.wiki_md, { paragraphizeLineBreaks: true }) : Promise.resolve("")
    ]);
    return { collection, copyHtml, imageUrls, href: buildMinecraftCollectionPath(collection.wiki_slug, collection.collection_slug) };
  }));
}
