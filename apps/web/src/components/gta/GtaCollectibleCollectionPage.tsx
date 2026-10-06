import { renderGameCollectibleCollectionPage } from "@/components/games/GameCollectibleCollectionPage";
type Options = Parameters<typeof renderGameCollectibleCollectionPage>[0];
export function renderGtaCollectibleCollectionPage(options: Omit<Options, "namespaceTitle" | "wikiPath">) {
 return renderGameCollectibleCollectionPage({ ...options, namespaceTitle: "GTA", wikiPath: `/gta/wiki/${options.page.wiki_slug}` });
}
