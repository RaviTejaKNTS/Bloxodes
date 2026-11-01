import { beforeEach, describe, expect, it, vi } from "vitest";
import { gameBreadcrumbs, gameLandingPath, gameRootWikiPage } from "../game-root-page";
import type { SharedGameGame, SharedGameWikiPage } from "../shared-game-reader";
const db = vi.hoisted(() => ({ root: vi.fn(), wiki: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("@/lib/game-registry", () => ({ getGameRoot: db.root, getGameWikiByPath: db.wiki }));
import { getGameLanding, getGameLandingForLinks, gameLandingSitemapEntries } from "../game-landing";
const root = { id: "root", namespace: "example", slug: "example", kind: "game", parent_id: null, is_published: true, url_style: "page_type", updated_at: "2026-01-01" } as SharedGameGame;
const wiki = { id: "wiki", game_id: root.id, namespace: "example", is_published: true, canonical_path: "/wiki/example", updated_at: "2026-02-01" } as SharedGameWikiPage;
beforeEach(() => { vi.clearAllMocks(); db.root.mockResolvedValue(root); db.wiki.mockResolvedValue(wiki); });
describe("page-type game landing", () => {
  it.each(["game", "franchise"] as const)("uses the %s destination for reads, presentation and sitemaps", async kind => {
    const game = { ...root, kind }; db.root.mockResolvedValue(game);
    const path = kind === "franchise" ? "/games/example" : "/wiki/example";
    expect(gameLandingPath(game)).toBe(path);
    expect(gameRootWikiPage(game, wiki)).toMatchObject({ id: "wiki", game_id: "root", canonical_path: path });
    const landing = await getGameLanding("example");
    expect(db.wiki).toHaveBeenCalledWith("example", path);
    expect(gameLandingSitemapEntries(landing)).toEqual([expect.objectContaining({ loc: `https://bloxodes.com${path}`, lastmod: "2026-02-01T00:00:00.000Z" })]);
  });
  it("keeps a known destination when the optional wiki read fails", async () => {
    db.wiki.mockRejectedValue(new Error("Unavailable"));
    await expect(getGameLanding("example")).rejects.toThrow("Unavailable");
    expect(await getGameLandingForLinks("example")).toMatchObject({ path: "/wiki/example", lookupFailed: true });
  });
  it("omits unpublished roots and preserves root artwork without a wiki", async () => {
    db.root.mockResolvedValue(null);
    expect(gameLandingSitemapEntries(await getGameLanding("example"))).toEqual([]);
    expect(db.wiki).not.toHaveBeenCalled();
    expect(gameRootWikiPage(root, { ...wiki, game_id: "sibling" }).id).toBe("root");
  });
  it("removes duplicate breadcrumb destinations", () => {
    expect(gameBreadcrumbs([{ label: "Home", href: "/" }, { label: "Root", href: "/wiki/example" }, { label: "Wiki", href: "/wiki/example" }, { label: "Items" }], "/wiki/example/items")).toHaveLength(3);
  });
});
