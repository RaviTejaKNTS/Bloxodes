import { beforeEach, describe, expect, it, vi } from "vitest";
import { gameBreadcrumbs, gameLandingPath, gameRootWikiPage, gameWikiCanonicalPath } from "../game-root-page";
import type { SharedGameGame, SharedGameWikiPage } from "../shared-game-reader";

const db = vi.hoisted(() => ({ root: vi.fn(), wiki: vi.fn(), failedView: "", rejectProbe: false, exactRoots: new Set<string>(), queries: [] as Array<{ table: string; filters: Record<string, unknown> }> }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-registry", () => ({ getGameRoot: db.root, getGameWikiByPath: db.wiki }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  const filters: Record<string, unknown> = {};
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters[key] = value; return query; },
    limit: () => query,
    maybeSingle: async () => {
      db.queries.push({ table, filters });
      if (table === db.failedView) {
        if (db.rejectProbe) throw new Error("View unavailable");
        return { data: null, error: { message: "View unavailable" } };
      }
      return { data: db.exactRoots.has(table) ? { id: "independent" } : null, error: null };
    }
  };
  return query;
} }) }));

import { getGameLanding, getGameLandingForLinks, gameLandingSitemapEntries } from "../game-landing";

const root = { id: "root", namespace: "future-game", slug: "future-game", title: "Future Game", kind: "game", is_published: true, parent_id: null, updated_at: "2026-01-01" } as SharedGameGame;
const wiki = { id: "wiki", game_id: root.id, namespace: root.namespace, canonical_path: "/future-game/wiki", is_published: true, updated_at: "2026-02-01" } as SharedGameWikiPage;

beforeEach(() => {
  vi.clearAllMocks();
  db.root.mockResolvedValue(root);
  db.wiki.mockResolvedValue(wiki);
  db.exactRoots.clear();
  db.failedView = "";
  db.rejectProbe = false;
  db.queries.length = 0;
});

describe("namespace canonical ownership", () => {
  it.each(["game", "franchise"] as const)("consolidates a published matching %s root without changing render identity", kind => {
    const game = { ...root, kind };
    expect(gameLandingPath(game, wiki)).toBe("/future-game/wiki");
    const page = gameRootWikiPage(game, wiki);
    expect(page.canonical_path).toBe("/future-game");
    expect(gameWikiCanonicalPath(page)).toBe("/future-game/wiki");
    expect(page.id).toBe(wiki.id);
    expect(page.game_id).toBe(root.id);
    expect(gameWikiCanonicalPath(wiki)).toBe(wiki.canonical_path);
  });

  it.each([
    ["missing wiki", root, null],
    ["unpublished wiki", root, { ...wiki, is_published: false }],
    ["different owner", root, { ...wiki, game_id: "child" }],
    ["different namespace", root, { ...wiki, namespace: "another-game" }],
    ["different exact path", root, { ...wiki, canonical_path: "/future-game/wiki/child" }],
    ["unpublished root", { ...root, is_published: false }, wiki],
    ["child registry identity", { ...root, parent_id: "parent" }, wiki]
  ] as const)("keeps the root self-canonical for %s", (_label, game, page) => {
    expect(gameLandingPath(game, page)).toBe("/future-game");
    expect(gameWikiCanonicalPath(gameRootWikiPage(game, page))).toBe("/future-game");
  });

  it("preserves independently matched root content", () => {
    expect(gameLandingPath(root, wiki, true)).toBe("/future-game");
  });
});

describe("published landing reader and sitemap entries", () => {
  it("reads the exact root wiki and uses its timestamp", async () => {
    const landing = await getGameLanding(root.namespace);
    expect(db.root).toHaveBeenCalledWith("future-game");
    expect(db.wiki).toHaveBeenCalledWith("future-game", "/future-game/wiki");
    expect(landing.isAlias).toBe(true);
    expect(db.queries).toHaveLength(8);
    for (const { table, filters } of db.queries) {
      expect(filters).toMatchObject({ namespace: "future-game", canonical_path: "/future-game" });
      if (table !== "game_checklist_pages_view") expect(filters.is_published).toBe(true);
    }
    expect(gameLandingSitemapEntries(landing)).toEqual([expect.objectContaining({ loc: "https://bloxodes.com/future-game/wiki", lastmod: "2026-02-01T00:00:00.000Z" })]);
  });

  it.each(["wiki", "collection", "code", "tool", "map", "quiz", "catalog", "checklist"])("retains a separately matched %s root", async kind => {
    db.exactRoots.add(`game_${kind}_pages_view`);
    const landing = await getGameLanding(root.namespace);
    expect(landing.path).toBe("/future-game");
    expect(landing.hasIndependentRoot).toBe(true);
    expect(gameLandingSitemapEntries(landing).map(entry => entry.loc)).toEqual(["https://bloxodes.com/future-game", "https://bloxodes.com/future-game/wiki"]);
  });

  it.each([false, true])("keeps the root self-canonical when one view fails, rejection=%s", async rejectProbe => {
    db.failedView = "game_catalog_pages_view";
    db.rejectProbe = rejectProbe;
    const landing = await getGameLanding(root.namespace);
    expect(db.queries).toHaveLength(8);
    expect(landing.path).toBe("/future-game");
    expect(gameRootWikiPage(root, wiki, landing.hasIndependentRoot).seo_canonical_path).toBe("/future-game");
    expect(gameLandingSitemapEntries(landing).map(entry => entry.loc)).toEqual(["https://bloxodes.com/future-game", "https://bloxodes.com/future-game/wiki"]);
  });

  it.each(["root", "wiki"] as const)("falls back for links while preserving required %s read errors", async reader => {
    db[reader].mockRejectedValue(new Error("Required content unavailable"));
    await expect(getGameLanding(root.namespace)).rejects.toThrow("Required content unavailable");
    const landing = await getGameLandingForLinks(root.namespace);
    expect(landing).toMatchObject({ path: "/future-game", isAlias: false, lookupFailed: true });
    expect(gameLandingSitemapEntries(landing).map(entry => entry.loc)).toEqual(["https://bloxodes.com/future-game"]);
  });

  it("retains a published fallback root without inventing a wiki URL", async () => {
    db.wiki.mockResolvedValue(null);
    const landing = await getGameLanding(root.namespace);
    expect(db.queries).toHaveLength(0);
    expect(gameLandingSitemapEntries(landing).map(entry => entry.loc)).toEqual(["https://bloxodes.com/future-game"]);
  });

  it("does not publish sitemap entries for an unknown or unpublished root", async () => {
    db.root.mockResolvedValue(null);
    const landing = await getGameLanding(root.namespace);
    expect(db.wiki).not.toHaveBeenCalled();
    expect(gameLandingSitemapEntries(landing)).toEqual([]);
  });
});

describe("canonical breadcrumbs", () => {
  it("removes duplicate and current-page ancestor links", () => {
    expect(gameBreadcrumbs([
      { label: "Home", href: "/" }, { label: "Game", href: "/future-game/wiki" },
      { label: "Wiki", href: "/future-game/wiki" }, { label: "Items" }
    ], "/future-game/wiki/items")).toEqual([
      { label: "Home", href: "/" }, { label: "Game", href: "/future-game/wiki" }, { label: "Items" }
    ]);
    expect(gameBreadcrumbs([{ label: "Home", href: "/" }, { label: "Game", href: "/future-game/wiki" }, { label: "Game" }], "/future-game/wiki")).toHaveLength(2);
  });
});
