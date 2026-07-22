import { describe, expect, it } from "vitest";
import { currentPlayingValue, isPlayingTimestampFresh, STATS_PLAYING_FRESHNESS_MS } from "../stats-freshness";

describe("stats player freshness", () => {
  const now = Date.parse("2026-07-22T12:00:00.000Z");

  it("keeps observations through the 24-hour boundary", () => {
    expect(isPlayingTimestampFresh(new Date(now - STATS_PLAYING_FRESHNESS_MS).toISOString(), now)).toBe(true);
    expect(currentPlayingValue(30_726, new Date(now - STATS_PLAYING_FRESHNESS_MS + 1).toISOString(), now)).toBe(30_726);
  });

  it("expires observations older than 24 hours", () => {
    const stale = new Date(now - STATS_PLAYING_FRESHNESS_MS - 1).toISOString();
    expect(isPlayingTimestampFresh(stale, now)).toBe(false);
    expect(currentPlayingValue(30_726, stale, now)).toBeNull();
  });

  it("preserves a fresh real zero but rejects missing and invalid observations", () => {
    const fresh = new Date(now - 60_000).toISOString();
    expect(currentPlayingValue(0, fresh, now)).toBe(0);
    expect(currentPlayingValue(null, fresh, now)).toBeNull();
    expect(currentPlayingValue(10, null, now)).toBeNull();
    expect(currentPlayingValue(-1, fresh, now)).toBeNull();
  });
});
