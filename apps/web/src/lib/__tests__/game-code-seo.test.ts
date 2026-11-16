import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { gameCodeDescription } from "../game-code-seo";
import type { GameCodePage } from "../game-registry";

describe("non-Roblox codes metadata", () => {
  it("uses the owning game's name and the timestamp shown on the page", () => {
    const page = { title: "A custom codes title", updated_at: "2026-11-12T00:00:00Z" } as GameCodePage;
    expect(gameCodeDescription(page, { name: "Example Game", codes: [{ code: "GIFT", status: "active", first_seen_at: "2026-11-01", last_seen_at: "2026-11-16" }] }))
      .toBe("1 active Example Game code, last checked November 12, 2026. Newest code: GIFT.");
  });
  it("omits missing dates instead of claiming a check happened today", () => {
    expect(gameCodeDescription({ updated_at: null } as GameCodePage, { name: "Example Game", codes: [] }))
      .toBe("No active Example Game codes right now.");
  });
});
