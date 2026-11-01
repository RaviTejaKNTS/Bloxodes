import { renderGameCollectibleCollectionPage } from "@/components/games/GameCollectibleCollectionPage";
type Options = Parameters<typeof renderGameCollectibleCollectionPage>[0];
export function renderGtaCollectibleCollectionPage(options: Omit<Options, "namespaceTitle" | "wikiPath">) {
 return renderGameCollectibleCollectionPage({ ...options, landingPath: options.page.canonical_path.startsWith("/wiki/") ? "/games/gta" : "/gta", namespaceTitle: "GTA", wikiPath: options.page.canonical_path.slice(0, options.page.canonical_path.lastIndexOf("/")) });
}
