import { expect, it, vi } from "vitest";
const pages = vi.hoisted(() => ["gta", "red-dead", "minecraft", "peak"].flatMap(namespace => ["wiki", "tools", "maps", "checklists"].map(section => ({ namespace, title: `${namespace} ${section}`, canonical_path: `/${section}/${namespace}-example`, meta_description: "Details", published_at: "2020-01-01", created_at: "2020-01-01", updated_at: "2020-01-02" }))));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/game-content-index", () => ({listSharedGameDiscoveryPages: async () => [...pages, pages[0]]}));
vi.mock("@/lib/supabase", () => ({supabaseAdmin: () => ({from: () => {
 const q = {select: () => q, eq: () => q, not: () => q, order: () => q, limit: () => q, then: (resolve: (r: unknown) => unknown) => resolve({data: [], error: null})}; return q;
}})}));
import { GET } from "@/app/feed.xml/route";
it("feeds every game's published canonical pages once", async () => {
 const response = await GET();
 expect(response.status).toBe(200);
 const xml = await response.text();
 for (const page of pages) expect(xml.split(`<link>https://bloxodes.com${page.canonical_path}</link>`)).toHaveLength(2);
});
