import "server-only";
import { cache } from "react";
import { getGameRoot, getGameWikiByPath } from "./game-registry";
import { gameLandingPath } from "./game-root-page";
import type { SharedGameGame } from "./shared-game-reader";
import { toIsoDate, withSiteUrl, type SitemapUrlSetEntry } from "./sitemap";

const readGameLanding = cache(async (namespace: string, root: SharedGameGame | null) => {
  if (!root) return { root: null, wiki: null, path: `/${namespace}`, isAlias: false, hasIndependentRoot: false };
  const path = gameLandingPath(root);
  const wiki = await getGameWikiByPath(namespace, path);
  const hasIndependentRoot = false;
  return { root, wiki, path, isAlias: path !== `/${namespace}`, hasIndependentRoot };
});

export const getGameLanding = cache(async (namespace: string) => readGameLanding(namespace, await getGameRoot(namespace)));

type GameLandingForLinks = Awaited<ReturnType<typeof getGameLanding>> & { lookupFailed?: boolean };

// Navigation is optional. Required page-content readers keep their existing errors.
export const getGameLandingForLinks = cache(async (namespace: string): Promise<GameLandingForLinks> => {
  let root: SharedGameGame | null = null;
  try {
    root = await getGameRoot(namespace);
    return await readGameLanding(namespace, root);
  } catch {
    // Preserve namespace links when optional identity reads fail. A known moved
    // root can still supply its page-type destination if the wiki read fails.
    const path = root ? gameLandingPath(root) : `/${namespace}`;
    return { root: null, wiki: null, path, isAlias: false, hasIndependentRoot: true, lookupFailed: true };
  }
});

export function gameLandingSitemapEntries(landing: GameLandingForLinks): SitemapUrlSetEntry[] {
  const { root, wiki, path } = landing;
  if (!root) return landing.lookupFailed ? [{ loc: withSiteUrl(path), changefreq: "weekly", priority: "0.9" }] : [];
  const lastmod = landing.isAlias
    ? wiki?.content_updated_at ?? wiki?.updated_at ?? wiki?.published_at
    : root.updated_at ?? root.published_at;
  const entries: SitemapUrlSetEntry[] = [{ loc: withSiteUrl(path), changefreq: "weekly", priority: "0.9", lastmod: toIsoDate(lastmod) }];
  return entries;
}
