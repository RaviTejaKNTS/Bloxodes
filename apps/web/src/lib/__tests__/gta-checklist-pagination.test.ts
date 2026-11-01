import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ total: 1, range: vi.fn(), eq: vi.fn(), rows: [{ slug: "gta-5" }] }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: () => {
 const chain = { select: () => chain, eq: (key: string,value: string) => { state.eq(key,value); return chain; }, order: () => chain,
   range: (start: number, end: number) => { state.range(start, end); return chain; },
   then: (resolve: (value: unknown) => unknown) => resolve({ data: state.rows, count: state.total, error: null }) };
 return chain;
} }) }));
import { listPublishedGameChecklists } from "@/lib/game-extra-pages";
describe("GTA checklist pagination", () => {
 it("avoids an invalid PostgREST range when the requested page is beyond the total", async () => {
  state.range.mockClear();
  expect(await listPublishedGameChecklists("gta", 2)).toEqual({ checklists: [], total: 1 });
  expect(state.range).not.toHaveBeenCalled();
 });
 it("loads a valid page with a bounded range", async () => {
  state.range.mockClear();
  expect(await listPublishedGameChecklists("gta", 1)).toEqual({ checklists: state.rows, total: 1 });
  expect(state.range).toHaveBeenCalledWith(0, 19);
  expect(state.eq).toHaveBeenCalledWith("namespace", "gta");
 });
});
