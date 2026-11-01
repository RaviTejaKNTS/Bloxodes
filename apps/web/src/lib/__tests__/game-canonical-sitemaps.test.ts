import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "cheerio";

const state = vi.hoisted(() => ({ wikiPublished: true, wrongOwner: false, independent: false, failedRead: "" }));
vi.mock("server-only", () => ({}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), cache: (loader: unknown) => loader }));
vi.mock("@/lib/game-registry", () => ({
  getGameRoot: async (namespace: string) => {
    if (state.failedRead === "root") throw new Error("Root unavailable");
    return { id: `${namespace}-root`, namespace, kind: "franchise", parent_id: null, is_published: true, updated_at: "2026-01-01" };
  },
  getGameWikiByPath: async (namespace: string) => {
    if (state.failedRead === "wiki") throw new Error("Wiki unavailable");
    return state.wikiPublished ? ({ id: `${namespace}-wiki`, game_id: state.wrongOwner ? "child" : `${namespace}-root`, namespace, canonical_path: `/${namespace}/wiki`, is_published: true, content_updated_at: "2026-03-01" }) : null;
  }
}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  const query = { select: () => query, eq: () => query, limit: () => query, maybeSingle: async () => ({ data: state.independent ? { id: "distinct" } : null, error: state.failedRead === table ? { message: "View unavailable" } : null }) };
  return query;
} }) }));
vi.mock("@/lib/game-content-index", () => ({ listSharedGameDiscoveryPages: async () => [
  { namespace: "future-game", canonical_path: "/future-game/wiki", updated_at: "2026-03-01" },
  { namespace: "future-game", canonical_path: "/future-game/wiki/child" },
  { namespace: "future-game", canonical_path: "/future-game/wiki/child/items" },
  { namespace: "future-game", canonical_path: "/future-game/catalog/items" },
  // The index can contain explicit namespaces for reference types too.
  { namespace: "gta", canonical_path: "/gta/catalog/items" }
].filter(page => state.wikiPublished || page.canonical_path !== "/future-game/wiki") }));
vi.mock("@/lib/gta", () => ({
  listPublishedGtaWikiPages: async () => [{ slug: "gta" }],
  listPublishedGtaWikiCollections: async () => [{ wiki_slug: "gta", collection_slug: "items" }],
  buildGtaWikiPath: (slug: string) => `/gta/wiki/${slug}`,
  buildGtaCollectionPath: (slug: string, collection: string) => `/gta/wiki/${slug}/${collection}`
}));
vi.mock("@/lib/gta-checklists", () => ({ listPublishedGtaChecklists: async () => ({ total: 1, checklists: [{ slug: "gta-5" }] }) }));
vi.mock("@/lib/game-extra-pages", () => ({ listGameMapPages: async () => [{ canonical_path: "/gta/maps/gta-3" }] }));
vi.mock("@/lib/red-dead", () => ({
  listPublishedRedDeadWikiPages: async () => [{ slug: "red-dead-redemption" }],
  listPublishedRedDeadWikiCollections: async () => [{ wiki_slug: "red-dead-redemption", collection_slug: "items" }],
  buildRedDeadWikiPath: (slug: string) => `/red-dead/wiki/${slug}`,
  buildRedDeadCollectionPath: (slug: string, collection: string) => `/red-dead/wiki/${slug}/${collection}`
}));
vi.mock("@/lib/minecraft", () => ({
  listPublishedMinecraftWikiPages: async () => [{ slug: "minecraft-java", updated_at: "2026-01-01" }, { slug: "minecraft-bedrock" }],
  listPublishedMinecraftCollections: async () => [{ wiki_slug: "minecraft-java", collection_slug: "items" }],
  listPublishedMinecraftTools: async () => [{ slug: "xp-calculator" }],
  buildMinecraftWikiPath: (slug: string) => `/minecraft/${slug.replace("minecraft-", "")}/wiki`,
  buildMinecraftCollectionPath: (slug: string, collection: string) => `/minecraft/${slug.replace("minecraft-", "")}/wiki/${collection}`
}));

import { GET as games } from "@/app/sitemaps/games.xml/route";
import { GET as gta } from "@/app/sitemaps/gta.xml/route";
import { GET as redDead } from "@/app/sitemaps/red-dead.xml/route";
import { GET as minecraft } from "@/app/sitemaps/minecraft.xml/route";

const handlers = [
  { name: "games", namespace: "future-game", get: games, retained: ["/future-game/wiki/child", "/future-game/wiki/child/items", "/future-game/catalog", "/future-game/catalog/items", "/gta/catalog/items"] },
  { name: "GTA", namespace: "gta", get: gta, retained: ["/gta/wiki/gta", "/gta/wiki/gta/items", "/gta/maps", "/gta/maps/gta-3", "/gta/checklists", "/gta/checklists/gta-5"] },
  { name: "Red Dead", namespace: "red-dead", get: redDead, retained: ["/red-dead/wiki/red-dead-redemption", "/red-dead/wiki/red-dead-redemption/items"] },
  { name: "Minecraft", namespace: "minecraft", get: minecraft, retained: ["/minecraft/java/wiki", "/minecraft/bedrock/wiki", "/minecraft/java/wiki/items", "/minecraft/tools", "/minecraft/tools/xp-calculator"] }
];

beforeEach(() => { state.wikiPublished = true; state.wrongOwner = false; state.independent = false; state.failedRead = ""; });

describe.each(handlers)("$name canonical sitemap", ({ namespace, get, retained }) => {
  it.each(["game_catalog_pages_view", "root", "wiki"])("preserves child and reference rows when optional %s lookup fails", async failedRead => {
    state.failedRead = failedRead;
    const response = await get();
    expect(response.status).toBe(200);
    const $ = load(await response.text(), { xmlMode: true });
    const urls = $("loc").map((_index, element) => $(element).text()).get();
    expect(urls).toContain(`https://bloxodes.com/${namespace}`);
    for (const path of retained) expect(urls).toContain(`https://bloxodes.com${path}`);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("omits the duplicate bare root and lists the owned wiki once", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const $ = load(await response.text(), { xmlMode: true });
    const urls = $("loc").map((_index, element) => $(element).text()).get();
    expect(urls).not.toContain(`https://bloxodes.com/${namespace}`);
    expect(urls.filter(url => url === `https://bloxodes.com/${namespace}/wiki`)).toHaveLength(1);
    expect(new Set(urls).size).toBe(urls.length);
    for (const path of retained) expect(urls).toContain(`https://bloxodes.com${path}`);
    const wikiEntry = $("url").filter((_index, element) => $(element).find("loc").text() === `https://bloxodes.com/${namespace}/wiki`);
    expect(wikiEntry.find("lastmod").text()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("keeps the fallback root and omits an absent or unpublished root wiki", async () => {
    state.wikiPublished = false;
    const $ = load(await (await get()).text(), { xmlMode: true });
    const urls = $("loc").map((_index, element) => $(element).text()).get();
    expect(urls).toContain(`https://bloxodes.com/${namespace}`);
    expect(urls).not.toContain(`https://bloxodes.com/${namespace}/wiki`);
    for (const path of retained) expect(urls).toContain(`https://bloxodes.com${path}`);
  });

  it.each(["wrong owner", "independent root"])("retains the bare root for %s", async reason => {
    state.wrongOwner = reason === "wrong owner";
    state.independent = reason === "independent root";
    const $ = load(await (await get()).text(), { xmlMode: true });
    const urls = $("loc").map((_index, element) => $(element).text()).get();
    expect(urls).toContain(`https://bloxodes.com/${namespace}`);
    expect(urls).toContain(`https://bloxodes.com/${namespace}/wiki`);
  });
});
