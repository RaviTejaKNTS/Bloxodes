import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { gameCodeDescription } from "../game-code-seo";
import type { GameCodePage } from "../game-registry";

describe("non-Roblox codes metadata", () => {
  it("uses the owning game's name and code checks instead of page edits", () => {
    const page = { title: "A custom codes title", updated_at: "2026-11-12T00:00:00Z" } as GameCodePage;
    expect(gameCodeDescription(page, { name: "Example Game", codes: [{ code: "GIFT", status: "active", first_seen_at: "2026-11-01", last_seen_at: "2026-11-16", verified_at: "2026-11-15" }] }))
      .toBe("1 active Example Game code, last checked November 16, 2026. Newest code: GIFT.");
  });
  it("uses a newer verification and includes help only with both sections", () => {
    const page = { updated_at: "2026-11-30", redeem_md: "Open rewards.", troubleshoot_md: "Check spelling." } as GameCodePage;
    const data = { name: "Example", codes: [{ code: "GIFT", status: "active", verified_at: "2026-11-16" }] };
    expect(gameCodeDescription(page, data)).toBe("1 active Example code, last checked November 16, 2026. Newest code: GIFT. See how to redeem them and why a code might not work.");
    expect(gameCodeDescription({ ...page, troubleshoot_md: null }, data)).not.toContain("See how");
  });
  it("omits missing dates instead of claiming a check happened today", () => {
    expect(gameCodeDescription({ updated_at: null } as GameCodePage, { name: "Example Game", codes: [] }))
      .toBe("No active Example Game codes right now.");
  });
});
