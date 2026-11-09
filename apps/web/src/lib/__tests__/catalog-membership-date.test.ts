import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown } }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => mocks.result }) }) }) })
}));

import { getCatalogMembershipDate } from "@/lib/catalog";

beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });

it("falls back to the editorial date when the membership read fails", async () => {
  mocks.result = { data: null, error: { code: "08006", message: "connection lost" } };
  await expect(getCatalogMembershipDate("roblox-decal-ids/curated", "2026-11-01T00:00:00Z")).resolves.toBe("2026-11-01T00:00:00Z");
  await expect(getCatalogMembershipDate("roblox-decal-ids/curated")).resolves.toBeNull();
});

it("uses the newer of the membership and editorial dates", async () => {
  mocks.result = { data: { updated_at: "2026-11-09T10:00:00Z" }, error: null };
  await expect(getCatalogMembershipDate("roblox-music-ids/trending", "2026-11-01T00:00:00Z")).resolves.toBe("2026-11-09T10:00:00Z");
});
