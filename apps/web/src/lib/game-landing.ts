import "server-only";
import { cache } from "react";
import { getGameRoot, getGameWikiByPath } from "./game-registry";
import { gameLandingPath } from "./game-root-page";
import type { SharedGameGame } from "./shared-game-reader";
import { supabaseAdmin } from "./supabase";
import { toIsoDate, withSiteUrl, type SitemapUrlSetEntry } from "./sitemap";

// Exact stored root content takes precedence in the generic route. Do not consolidate it.
const hasIndependentRootPage = cache(async (namespace: string): Promise<boolean> => {
  const tables = ["wiki", "collection", "code", "tool", "map", "quiz", "catalog", "checklist"];
  const matches = await Promise.all(tables.map(async kind => {
    try {
      let query = supabaseAdmin().from(`game_${kind}_pages_view`).select("id")
        .eq("namespace", namespace).eq("canonical_path", `/${namespace}`);
      if (kind !== "checklist") query = query.eq("is_published", true);
      const { data, error } = await query.limit(1).maybeSingle();
      // Unknown root content must retain the bare-root canonical.
      return Boolean(error || data);
    } catch {
      return true;
    }
  }));
  return matches.some(Boolean);
});

const readGameLanding = cache(async (namespace: string, root: SharedGameGame | null) => {
  if (!root) return { root: null, wiki: null, path: `/${namespace}`, isAlias: false, hasIndependentRoot: false };
  const wiki = await getGameWikiByPath(namespace, root.url_style === "page_type" ? gameLandingPath(root) : `/${namespace}/wiki`);
  const hasIndependentRoot = root.url_style !== "page_type" && gameLandingPath(root, wiki) !== `/${namespace}` ? await hasIndependentRootPage(namespace) : false;
  const path = gameLandingPath(root, wiki, hasIndependentRoot);
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
    const path = root?.url_style === "page_type" ? gameLandingPath(root) : `/${namespace}`;
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
  if (wiki?.is_published && wiki.namespace === root.namespace && wiki.canonical_path === `/${root.namespace}/wiki` && path !== wiki.canonical_path) {
    entries.push({ loc: withSiteUrl(wiki.canonical_path), changefreq: "weekly", priority: "0.9", lastmod: toIsoDate(wiki.content_updated_at ?? wiki.updated_at ?? wiki.published_at) });
  }
  return entries;
}
