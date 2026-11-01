import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "cheerio";

const state = vi.hoisted(() => ({ wikiPublished: true, wrongOwner: false, independent: false, failedRead: "", moved: "" }));
function stored(path: string) {
  if (!state.moved || !path.startsWith(`/${state.moved}/`)) return path;
  return path.replace(/^\/minecraft\/(java|bedrock)\/wiki/, (_, edition) => `/wiki/minecraft-${edition}`)
    .replace(/^\/minecraft\/tools\//, "/tools/minecraft-")
    .replace(/^\/(gta|red-dead)\/wiki\//, "/wiki/")
    .replace(/^\/gta\/(maps|checklists)\//, "/$1/");
}
vi.mock("server-only", () => ({}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), cache: (loader: unknown) => loader }));
vi.mock("@/lib/game-registry", () => ({
  getGameRoot: async (namespace: string) => {
    if (state.failedRead === "root") throw new Error("Root unavailable");
    return { id: `${namespace}-root`, namespace, url_style: state.moved === namespace ? "page_type" : "namespace", kind: "franchise", parent_id: null, is_published: true, updated_at: "2026-01-01" };
  },
  getGameWikiByPath: async (namespace: string) => {
    if (state.failedRead === "wiki") throw new Error("Wiki unavailable");
    return state.wikiPublished ? ({ id: `${namespace}-wiki`, game_id: state.wrongOwner ? "child" : `${namespace}-root`, namespace, canonical_path: state.moved === namespace ? `/games/${namespace}` : `/${namespace}/wiki`, is_published: true, content_updated_at: "2026-03-01" }) : null;
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
  { namespace: "gta", canonical_path: stored("/gta/catalog/items") }
].filter(page => state.wikiPublished || page.canonical_path !== "/future-game/wiki") }));
vi.mock("@/lib/gta", () => ({
  listPublishedGtaWikiPages: async () => [{ slug: "gta", canonical_path: stored("/gta/wiki/gta") }],
  listPublishedGtaWikiCollections: async () => [{ wiki_slug: "gta", collection_slug: "items", canonical_path: stored("/gta/wiki/gta/items") }],
  buildGtaWikiPath: (slug: string) => `/gta/wiki/${slug}`,
  buildGtaCollectionPath: (slug: string, collection: string) => `/gta/wiki/${slug}/${collection}`
}));
vi.mock("@/lib/gta-checklists", () => ({ listPublishedGtaChecklists: async () => ({ total: 1, checklists: [{ slug: "gta-5", canonical_path: stored("/gta/checklists/gta-5") }] }) }));
vi.mock("@/lib/game-extra-pages", () => ({ listGameMapPages: async () => [{ canonical_path: stored("/gta/maps/gta-3") }] }));
vi.mock("@/lib/red-dead", () => ({
  listPublishedRedDeadWikiPages: async () => [{ slug: "red-dead-redemption", canonical_path: stored("/red-dead/wiki/red-dead-redemption") }],
  listPublishedRedDeadWikiCollections: async () => [{ wiki_slug: "red-dead-redemption", collection_slug: "items", canonical_path: stored("/red-dead/wiki/red-dead-redemption/items") }],
  buildRedDeadWikiPath: (slug: string) => `/red-dead/wiki/${slug}`,
  buildRedDeadCollectionPath: (slug: string, collection: string) => `/red-dead/wiki/${slug}/${collection}`
}));
vi.mock("@/lib/minecraft", () => ({
  listPublishedMinecraftWikiPages: async () => [{ slug: "minecraft-java", canonical_path: stored("/minecraft/java/wiki"), updated_at: "2026-01-01" }, { slug: "minecraft-bedrock", canonical_path: stored("/minecraft/bedrock/wiki") }],
  listPublishedMinecraftCollections: async () => [{ wiki_slug: "minecraft-java", collection_slug: "items", canonical_path: stored("/minecraft/java/wiki/items") }],
  listPublishedMinecraftTools: async () => [{ slug: "xp-calculator", canonical_path: stored("/minecraft/tools/xp-calculator") }],
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

beforeEach(() => { state.wikiPublished = true; state.wrongOwner = false; state.independent = false; state.failedRead = ""; state.moved = ""; });

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

// Both sitemap handlers run against the same ownership state. The generic
// handler sees GTA catalog rows, but must not claim the specialist landing.
it.each(handlers.slice(1))("$name moved sitemap emits stored URLs only, with no cross-file landing duplicate", async ({ namespace, get, retained }) => {
  state.moved = namespace;
  const xml = await (await get()).text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  expect(urls).toContain(`https://bloxodes.com/games/${namespace}`);
  expect(urls.some(url => new URL(url).pathname.startsWith(`/${namespace}/`))).toBe(false);
  for (const path of retained.filter(path => !["/gta/maps", "/gta/checklists", "/minecraft/tools"].includes(path))) {
    expect(urls).toContain(`https://bloxodes.com${stored(path)}`);
  }
  const globalXml = await (await games()).text();
  expect(globalXml).not.toContain(`<loc>https://bloxodes.com/games/${namespace}</loc>`);
  const unmoved = handlers.find(handler => handler.namespace !== namespace && handler.namespace !== "future-game")!;
  const unmovedXml = await (await unmoved.get()).text();
  for (const path of unmoved.retained) expect(unmovedXml).toContain(`<loc>https://bloxodes.com${path}</loc>`);
});

// Complete ordered entries captured from HEAD's three specialist handlers.
// These literals also pin priorities, frequencies and lastmod, not just URLs.
it.each([
  [gta, [
    ["/games", "", "weekly", "0.8"],
    ["/gta/wiki", "2026-03-01T00:00:00.000Z", "weekly", "0.9"],
    ["/gta/maps", "", "monthly", "0.8"],
    ["/gta/maps/gta-3", "", "monthly", "0.9"],
    ["/gta/checklists", "", "weekly", "0.9"],
    ["/gta/checklists/gta-5", "", "weekly", "0.9"],
    ["/gta/wiki/gta", "", "weekly", "0.9"],
    ["/gta/wiki/gta/items", "", "weekly", "0.9"],
  ]],
  [redDead, [
    ["/games", "", "weekly", "0.8"],
    ["/red-dead/wiki", "2026-03-01T00:00:00.000Z", "weekly", "0.9"],
    ["/red-dead/wiki/red-dead-redemption", "", "weekly", "0.9"],
    ["/red-dead/wiki/red-dead-redemption/items", "", "weekly", "0.9"],
  ]],
  [minecraft, [
    ["/minecraft/wiki", "2026-03-01T00:00:00.000Z", "weekly", "0.9"],
    ["/minecraft/java/wiki", "2026-01-01T00:00:00.000Z", "weekly", "0.9"],
    ["/minecraft/bedrock/wiki", "", "weekly", "0.9"],
    ["/minecraft/tools", "", "weekly", "0.8"],
    ["/minecraft/java/wiki/items", "", "weekly", "0.8"],
    ["/minecraft/tools/xp-calculator", "", "weekly", "0.8"],
  ]],
] as const)("preserves every committed namespace sitemap entry (%#)", async (get, expected) => {
  const xml = await (await get()).text();
  const entries = expected.map(([path, lastmod, frequency, priority]) =>
    `<url><loc>https://bloxodes.com${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`
  );
  expect(xml).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`);
});

it("retains GTA's committed landing in games.xml before GTA moves", async () => {
  const xml = await (await games()).text();
  expect(xml).toContain("<loc>https://bloxodes.com/gta/wiki</loc>");
});
