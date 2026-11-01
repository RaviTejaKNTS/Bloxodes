import "server-only";
import { cache } from "react";
import { getGameRoot, getGameWikiByPath } from "./game-registry";
import { gameLandingPath } from "./game-root-page";
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

export const getGameLanding = cache(async (namespace: string) => {
  const root = await getGameRoot(namespace);
  if (!root) return { root: null, wiki: null, path: `/${namespace}`, isAlias: false, hasIndependentRoot: false };
  const wiki = await getGameWikiByPath(namespace, root.url_style === "page_type" ? gameLandingPath(root) : `/${namespace}/wiki`);
  const hasIndependentRoot = root.url_style !== "page_type" && gameLandingPath(root, wiki) !== `/${namespace}` ? await hasIndependentRootPage(namespace) : false;
  const path = gameLandingPath(root, wiki, hasIndependentRoot);
  return { root, wiki, path, isAlias: path !== `/${namespace}`, hasIndependentRoot };
});

type GameLandingForLinks = Awaited<ReturnType<typeof getGameLanding>> & { lookupFailed?: boolean };

// Navigation is optional. Required page-content readers keep their existing errors.
export const getGameLandingForLinks = cache(async (namespace: string): Promise<GameLandingForLinks> => {
  try {
    return await getGameLanding(namespace);
  } catch {
    // With identity unavailable, use the stable directory rather than guessing
    // an old namespace URL that may already redirect.
    return { root: null, wiki: null, path: "/games", isAlias: false, hasIndependentRoot: false, lookupFailed: true };
  }
});

export function gameLandingSitemapEntries(landing: GameLandingForLinks): SitemapUrlSetEntry[] {
  const { root, wiki, path } = landing;
  if (!root) return [];
  const lastmod = landing.isAlias
    ? wiki?.content_updated_at ?? wiki?.updated_at ?? wiki?.published_at
    : root.updated_at ?? root.published_at;
  const entries: SitemapUrlSetEntry[] = [{ loc: withSiteUrl(path), changefreq: "weekly", priority: "0.9", lastmod: toIsoDate(lastmod) }];
  if (wiki?.is_published && wiki.namespace === root.namespace && wiki.canonical_path === `/${root.namespace}/wiki` && path !== wiki.canonical_path) {
    entries.push({ loc: withSiteUrl(wiki.canonical_path), changefreq: "weekly", priority: "0.9", lastmod: toIsoDate(wiki.content_updated_at ?? wiki.updated_at ?? wiki.published_at) });
  }
  return entries;
}
