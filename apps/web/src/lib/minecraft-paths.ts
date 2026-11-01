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
export function minecraftLegacyRedirect(
  pathname: string,
  query: string,
  resolvePath: (path: string) => string = path => path
): string | null {
  const params = new URLSearchParams(query);
  const direct = resolvePath(pathname);
  if (/^\/minecraft\/wiki(?:\/|$)/.test(pathname) && direct !== pathname && /^(\/wiki\/|\/games\/)/.test(direct)
    && (!params.has("edition") || pathname === "/minecraft/wiki/legacy-minecraft")) {
    params.delete("edition");
    return `${direct}${params.size ? `?${params}` : ""}`;
  }
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
  // Resolve the edition/tool destination against the same redirect snapshot as
  // the request. Before a move it stays namespace-style; afterwards an old row
  // points straight at its live owner. Edition-less legacy links never hop via
  // an edition URL that has itself moved.
  target = resolvePath(target);
  params.delete("edition");
  return `${target}${params.size ? `?${params}` : ""}`;
}
