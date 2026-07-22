import { describe, expect, it } from "vitest";
import {
  currentPlayingRankValue,
  currentPlayingValue,
  isPlayingRankSnapshotWithinFreshnessWindow,
  isPlayingTimestampFresh,
  STATS_PLAYING_FRESHNESS_MS
} from "../stats-freshness";

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

  it("expires current playing ranks with the player observation", () => {
    const fresh = new Date(now - 60_000).toISOString();
    const stale = new Date(now - STATS_PLAYING_FRESHNESS_MS - 1).toISOString();
    expect(currentPlayingRankValue(39, fresh, now)).toBe(39);
    expect(currentPlayingRankValue(39, stale, now)).toBeNull();
    expect(currentPlayingRankValue(0, fresh, now)).toBeNull();
  });

  it("keeps historical rank snapshots only through the 24-hour grace window", () => {
    const refreshedAt = new Date(now - 2 * STATS_PLAYING_FRESHNESS_MS).toISOString();
    expect(
      isPlayingRankSnapshotWithinFreshnessWindow(
        new Date(Date.parse(refreshedAt) + STATS_PLAYING_FRESHNESS_MS).toISOString(),
        refreshedAt,
        now
      )
    ).toBe(true);
    expect(
      isPlayingRankSnapshotWithinFreshnessWindow(
        new Date(Date.parse(refreshedAt) + STATS_PLAYING_FRESHNESS_MS + 1).toISOString(),
        refreshedAt,
        now
      )
    ).toBe(false);
  });
});
