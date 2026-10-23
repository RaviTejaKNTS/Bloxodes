import { describe, expect, it } from "vitest";
import { isUsefulRelatedRobloxGame } from "../roblox-related-games";
import { currentPlayingValue } from "../stats-freshness";

describe("related Roblox games", () => {
  it("excludes the empty 54-visit place and other tiny inactive games", () => {
    expect(isUsefulRelatedRobloxGame(0, 54)).toBe(false);
    expect(isUsefulRelatedRobloxGame(null, 99_999)).toBe(false);
    expect(isUsefulRelatedRobloxGame(undefined, undefined)).toBe(false);
  });
  it("keeps games with a current player or 100,000 visits", () => {
    expect(isUsefulRelatedRobloxGame(1, 54)).toBe(true);
    expect(isUsefulRelatedRobloxGame(0, 100_000)).toBe(true);
  });
  it("does not qualify a tiny game using a stale player count", () => {
    expect(isUsefulRelatedRobloxGame(currentPlayingValue(100, "2020-01-01T00:00:00Z"), 54)).toBe(false);
  });
});
