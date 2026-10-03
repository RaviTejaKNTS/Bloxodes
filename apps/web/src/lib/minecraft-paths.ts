import { parseMinecraftEdition, type MinecraftEdition } from "./minecraft-edition";

export function minecraftWikiSlug(edition: MinecraftEdition): string {
  return `minecraft-${edition}`;
}
export function minecraftEditionForWiki(slug: string): MinecraftEdition | null {
  return parseMinecraftEdition(slug.replace(/^minecraft-/, ""));
}
export function buildMinecraftWikiPath(slug: string): string {
  const edition = minecraftEditionForWiki(slug);
  return edition ? `/minecraft/${edition}/wiki` : "/minecraft/wiki";
}
export function buildMinecraftCollectionPath(wikiSlug: string, collectionSlug: string): string {
  return `${buildMinecraftWikiPath(wikiSlug)}/${collectionSlug.trim().toLowerCase()}`;
}
export function minecraftCollectionEventPath(code: string): string {
  const match = /^minecraft-(java|bedrock)-(.+)$/.exec(code);
  return match ? `/minecraft/${match[1]}/wiki/${match[2]}` : `/minecraft/wiki/${code.replace(/^minecraft-/, "")}`;
}

/** Migrate old links once. Cookies never decide a public content URL. */
export function minecraftLegacyRedirect(pathname: string, query: string): string | null {
  const params = new URLSearchParams(query);
  const explicit = parseMinecraftEdition(params.get("edition"));
  let target = pathname;
  const legacy = /^\/minecraft\/wiki(?:\/(.*))?$/.exec(pathname);
  if (legacy) {
    const tail = legacy[1];
    if (!tail && !params.has("edition")) return null;
    const edition = explicit ?? (tail?.split("/")[0] === "achievements" ? "bedrock" : "java");
    target = `/minecraft/${edition}/wiki${tail ? `/${tail}` : ""}`;
  } else if (!/^\/minecraft\/(?:(?:java|bedrock)\/wiki|tools)(?:\/|$)/.test(pathname) || !params.has("edition")) {
    return null;
  }
  params.delete("edition");
  return `${target}${params.size ? `?${params}` : ""}`;
}
