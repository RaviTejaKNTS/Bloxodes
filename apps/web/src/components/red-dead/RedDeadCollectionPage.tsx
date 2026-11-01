import { renderGameCollectibleCollectionPage } from "@/components/games/GameCollectibleCollectionPage";
type Options = Parameters<typeof renderGameCollectibleCollectionPage>[0];
export function renderRedDeadCollectionPage(options: Omit<Options, "namespaceTitle" | "wikiPath">) {
 return renderGameCollectibleCollectionPage({ ...options, landingPath: options.page.canonical_path.startsWith("/wiki/") ? "/games/red-dead" : "/red-dead", namespaceTitle: "Red Dead", wikiPath: options.page.canonical_path.slice(0, options.page.canonical_path.lastIndexOf("/")) });
}
