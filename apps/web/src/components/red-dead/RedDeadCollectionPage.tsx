import { renderGameCollectibleCollectionPage } from "@/components/games/GameCollectibleCollectionPage";
type Options = Parameters<typeof renderGameCollectibleCollectionPage>[0];
export function renderRedDeadCollectionPage(options: Omit<Options, "namespaceTitle" | "wikiPath">) {
 return renderGameCollectibleCollectionPage({ ...options, namespaceTitle: "Red Dead", wikiPath: `/red-dead/wiki/${options.page.wiki_slug}` });
}
