import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cacheTagsForEvent, cacheTagsForPath } from "@/lib/public-cache-tags";
import { resolveSearchScope, siteNavLinksForPath } from "@/lib/site-navigation";
import { getChecklistStorageKey, readLocalChecklistProgress, writeLocalChecklistProgress, loadAccountChecklistProgress, saveAccountChecklistProgress } from "@/lib/checklist-progress-client";

const db = vi.hoisted(() => ({ page: { id: "gta-page" } as { id: string } | null, items: [{ id: "leaf", section_code: "1.0.1" }, { id: "heading", section_code: "1" }] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  const chain = { select: () => chain, eq: () => chain,
    maybeSingle: async () => ({ data: db.page, error: null }),
    then: (resolve: (value: unknown) => unknown) => resolve({ data: table === "gta_checklist_items" ? db.items : [], error: null }) };
  return chain;
} }) }));
import { validateGtaChecklistProgress } from "@/lib/gta-checklist-progress";

beforeEach(() => { vi.unstubAllGlobals(); db.page = { id: "gta-page" }; });
describe("GTA checklist contracts", () => {
  it("only accepts real leaf IDs belonging to a published GTA checklist", async () => {
    expect(await validateGtaChecklistProgress("gta:gta-5", ["leaf"])).toBeNull();
    expect((await validateGtaChecklistProgress("gta:gta-5", ["heading"]))?.status).toBe(400);
    expect((await validateGtaChecklistProgress("gta:gta-5", ["foreign-leaf"]))?.status).toBe(400);
    expect((await validateGtaChecklistProgress("gta:../gta-5"))?.status).toBe(400);
    db.page = null;
    expect((await validateGtaChecklistProgress("gta:gta-5"))?.status).toBe(404);
    expect(await validateGtaChecklistProgress("jailbreak", ["old-id"])).toBeNull();
  });
  it("preserves Roblox browser keys and isolates GTA progress across reload reads", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) });
    expect(getChecklistStorageKey("jailbreak")).toBe("checklist:jailbreak");
    writeLocalChecklistProgress("gta-5", ["roblox-id"]);
    writeLocalChecklistProgress("gta:gta-5", ["gta-id", "gta-id"]);
    expect(readLocalChecklistProgress("gta:gta-5")).toEqual(["gta-id"]);
    expect(readLocalChecklistProgress("gta-5")).toEqual(["roblox-id"]);
    writeLocalChecklistProgress("gta:gta-5", []);
    expect(readLocalChecklistProgress("gta:gta-5")).toEqual([]);
  });
  it("uses the same authenticated progress protocol with a namespaced GTA key", async () => {
    const fetcher = vi.fn(async (..._args: Parameters<typeof fetch>) => new Response(JSON.stringify({ checkedIds: ["leaf"] })));
    vi.stubGlobal("fetch", fetcher);
    expect(await loadAccountChecklistProgress("gta:gta-5")).toEqual(["leaf"]);
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/checklists/progress?slug=gta%3Agta-5");
    expect(await saveAccountChecklistProgress("gta:gta-5", ["leaf"])).toBe(true);
  });
  it("has discoverable navigation and matching publish/purge tags", () => {
    expect(siteNavLinksForPath("/gta/checklists/gta-5").some(x => x.href === "/gta/checklists")).toBe(true);
    expect(resolveSearchScope("/gta/checklists/gta-5").scope).toBe("gta-checklists");
    const eventTags = cacheTagsForEvent("gta_checklist", "gta-5");
    for (const path of ["/gta/checklists", "/gta/checklists/page/2", "/gta/checklists/gta-5", "/gta/wiki/gta-5", "/sitemaps/gta.xml", "/feed.xml"]) {
      expect(cacheTagsForPath(path).some(tag => eventTags.includes(tag))).toBe(true);
    }
    expect(eventTags).not.toContain("checklists");
  });
  it("ships every completion task at the renderer's leaf depth with stable keys", () => {
    const sql = readFileSync(new URL("../../../../../supabase/migrations/20260920000026_seed_gta_5_checklist.sql", import.meta.url), "utf8");
    const data = JSON.parse(sql.split("$content$")[1]) as { slug: string; game_slug: string; items: Array<{ key: string; section_code: string; is_required: boolean; title: string }> };
    expect(data.slug).toBe("gta-5"); expect(data.game_slug).toBe(data.slug);
    expect(new Set(data.items.map(i => i.key)).size).toBe(data.items.length);
    const leaves = data.items.filter(i => i.section_code.split(".").length === 3);
    expect(leaves).toHaveLength(151);
    expect(data.items.every(i => i.is_required === (i.section_code.split(".").length === 3))).toBe(true);
    for (const i of leaves) expect(data.items.some(parent => parent.section_code === i.section_code.split(".")[0])).toBe(true);
    expect(leaves.some(i => /any story ending/i.test(i.title))).toBe(true);
    expect(leaves.some(i => /any 14 random events/i.test(i.title))).toBe(true);
  });
  it("ships the three current GTA checklist payloads with title links and fixed leaf contracts", () => {
    const sql = readFileSync(new URL("../../../../../supabase/migrations/20260920000030_seed_gta_checklists.sql", import.meta.url), "utf8");
    const payloads = JSON.parse(sql.split("$content$")[1]) as Array<{
      slug: string;
      game_slug: string;
      description_md: string;
      items: Array<{ key: string; section_code: string; is_required: boolean; title: string; description: string | null }>;
    }>;
    expect(payloads.map(payload => payload.slug)).toEqual(["gta-san-andreas", "gta-vice-city", "gta-online"]);
    for (const payload of payloads) {
      expect(payload.game_slug).toBe(payload.slug);
      expect(new Set(payload.items.map(item => item.key)).size).toBe(payload.items.length);
      expect(new Set(payload.items.map(item => item.section_code)).size).toBe(payload.items.length);
      expect(payload.items.every(item => item.is_required === (item.section_code.split(".").length === 3))).toBe(true);
      expect(payload.items.filter(item => item.is_required).every(item => item.section_code.split(".").length === 3)).toBe(true);
    }
    const sanAndreas = payloads.find(payload => payload.slug === "gta-san-andreas")!;
    const viceCity = payloads.find(payload => payload.slug === "gta-vice-city")!;
    const online = payloads.find(payload => payload.slug === "gta-online")!;
    expect(sanAndreas.items.filter(item => item.is_required)).toHaveLength(168);
    expect(viceCity.items.filter(item => item.is_required)).toHaveLength(153);
    expect(online.items.filter(item => item.is_required)).toHaveLength(27);
    expect(sanAndreas.description_md).toContain("GTA San Andreas wiki");
    expect(viceCity.description_md).toContain("GTA Vice City wiki");
    expect(online.description_md).toMatch(/not a single game-wide 100% counter/i);
    expect(online.items.some(item => /Kortz Center/i.test(item.title))).toBe(true);
    expect(online.items.some(item => item.description?.includes("/gta/wiki/gta-online/heists"))).toBe(true);
  });
});
