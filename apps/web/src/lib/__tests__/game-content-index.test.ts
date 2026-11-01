import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ tables: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
 state.tables.push(table);
 const q = {
  select: () => q, order: () => q, eq: () => q,
  range: async (offset: number) => ({data: offset ? [] : ["gta", "red-dead", "minecraft", "peak"].map(namespace => ({namespace, canonical_path: `/wiki/${namespace}`, title: namespace})), error: null})
 };
 return q;
} }) }));
import { listSharedGameDiscoveryPages } from "../game-content-index";
it("reads all eight published game views without namespace exclusions", async () => {
 const rows = await listSharedGameDiscoveryPages();
 expect(state.tables).toHaveLength(8);
 for (const namespace of ["gta", "red-dead", "minecraft", "peak"]) expect(rows.filter(row => row.namespace === namespace)).toHaveLength(8);
});
