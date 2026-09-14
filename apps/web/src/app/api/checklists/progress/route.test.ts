import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: { id: "user-a" } as { id: string } | null, saved: null as unknown, filters: [] as unknown[], checked: ["leaf"] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session-user", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/gta-checklist-progress", () => ({ validateGtaChecklistProgress: async (_key: string, ids?: string[]) => ids?.includes("foreign") ? { status: 400, error: "Unknown task" } : null }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: () => {
 const chain = { select: () => chain, eq: (key: string, value: unknown) => { state.filters.push([key, value]); return chain; },
 maybeSingle: async () => ({ data: { checked_item_ids: state.checked }, error: null }),
 upsert: async (row: unknown) => { state.saved = row; return { error: null }; },
 delete: () => chain, then: (resolve: (value: unknown) => unknown) => resolve({ error: null }) };
 return chain;
} }) }));
import { GET, PUT } from "./route";
function write(ids: string[], origin = "https://bloxodes.com") {
 return new Request("https://bloxodes.com/api/checklists/progress", { method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ slug: "gta:gta-5", checkedIds: ids, user_id: "user-b" }) });
}
beforeEach(() => { state.user = { id: "user-a" }; state.saved = null; state.filters = []; });
describe("shared checklist progress API", () => {
 it("saves GTA progress for the session owner, ignoring a supplied user ID", async () => {
  expect((await PUT(write(["leaf"]))).status).toBe(200);
  expect(state.saved).toEqual({ user_id: "user-a", checklist_slug: "gta:gta-5", checked_item_ids: ["leaf"] });
 });
 it("loads only the current account's namespaced checklist", async () => {
  const res = await GET(new Request("https://bloxodes.com/api/checklists/progress?slug=gta:gta-5"));
  expect(await res.json()).toEqual({ checkedIds: ["leaf"] });
  expect(state.filters).toContainEqual(["user_id", "user-a"]);
  expect(state.filters).toContainEqual(["checklist_slug", "gta:gta-5"]);
  expect(res.headers.get("cache-control")).toContain("no-store");
 });
 it("clears only the session account's requested checklist", async () => {
  expect((await PUT(write([]))).status).toBe(200);
  expect(state.filters).toEqual([["user_id", "user-a"], ["checklist_slug", "gta:gta-5"]]);
 });
 it("rejects foreign tasks, untrusted origins and missing sessions before saving", async () => {
  expect((await PUT(write(["foreign"]))).status).toBe(400);
  expect((await PUT(write(["leaf"], "https://untrusted.example"))).status).toBe(403);
  state.user = null;
  expect((await PUT(write(["leaf"]))).status).toBe(401);
  expect(state.saved).toBeNull();
 });
});
