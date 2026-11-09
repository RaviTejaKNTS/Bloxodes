import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ route: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/site-route-page", () => ({ getLiveSiteRoute: mocks.route }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.admin }));
vi.mock("@/components/games/GameRoutePage", () => ({ default: vi.fn(), generateMetadata: vi.fn() }));
import { resolvePageTypeGameRoute } from "@/lib/page-type-game-route";

beforeEach(() => { vi.clearAllMocks(); });
it("propagates identity lookup failures", async () => {
  mocks.route.mockResolvedValue({ source: "game", game_id: "game" });
  const error = new Error("database unavailable");
  mocks.admin.mockImplementation(() => { throw error; });
  await expect(resolvePageTypeGameRoute("/wiki/vice-city")).rejects.toBe(error);
});
it("propagates exact-path fallback failures", async () => {
  mocks.route.mockResolvedValue(undefined);
  const error = new Error("database unavailable");
  mocks.admin.mockImplementation(() => { throw error; });
  await expect(resolvePageTypeGameRoute("/wiki/vice-city/rampages")).rejects.toBe(error);
});
it("preserves an absent live route", async () => {
  mocks.route.mockResolvedValue(null);
  await expect(resolvePageTypeGameRoute("/wiki/missing")).resolves.toBeNull();
  expect(mocks.admin).not.toHaveBeenCalled();
});
