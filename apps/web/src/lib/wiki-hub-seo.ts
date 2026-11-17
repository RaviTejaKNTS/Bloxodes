import { resolveSeoTitle } from "./seo";

type HubCollection = {
  display_name?: string | null;
  collection_slug: string;
  page_type?: string | null;
};

/** Prefer stored identity; title parsing is only a fallback for missing game data. */
export function wikiHubGameName(title: string, ...names: (string | null | undefined)[]): string {
  return names.find(name => name?.trim())?.trim() || title.replace(/ Wiki$/i, "").trim();
}

/** Match the hubs' game-data group followed by their collectibles group. */
export function orderWikiHubCollections<T extends HubCollection>(collections: readonly T[]): T[] {
  return [
    ...collections.filter(collection => collection.page_type !== "collectible"),
    ...collections.filter(collection => collection.page_type === "collectible")
  ];
}

export function wikiHubSeoTitle({ gameName, gameNameAliases = [], seoTitle, collections }: {
  gameName: string;
  gameNameAliases?: string[];
  seoTitle?: string | null;
  collections: readonly HubCollection[];
}): string {
  const name = gameName.trim().replace(/\s+/g, " ");
  const bare = `${name} Wiki`;
  const stored = resolveSeoTitle(seoTitle);
  const bareTitles = [name, ...gameNameAliases].flatMap(alias => {
    const value = alias.trim().replace(/\s+/g, " ").toLowerCase();
    return [`${value} wiki`, `${value} roblox wiki`];
  });
  if (stored && !bareTitles.includes(stored.toLowerCase())) return stored;

  const labels = orderWikiHubCollections(collections).slice(0, 3).map(collection =>
    collection.display_name?.trim() || collection.collection_slug.split("-").filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
  );
  for (let count = labels.length; count >= 2; count--) {
    const title = `${bare}: ${labels.slice(0, count).join(", ")} and Tips`;
    if (title.length <= 60) return title;
  }
  return bare;
}
