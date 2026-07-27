import { describe, expect, it } from "vitest";
import type { StatsChartPoint } from "../stats";
import {
  compactExtensionStatsPoints,
  hasMeaningfulExtensionHistory
} from "../extension-stats-utils";

function point(overrides: Partial<StatsChartPoint> = {}): StatsChartPoint {
  return {
    label: "Jul 27",
    sampledAt: "2026-07-27T10:00:00.000Z",
    players: 1234,
    peakPlayers: null,
    avgPlayers: null,
    visits: null,
    favorites: null,
    rating: null,
    samples: 1,
    ...overrides
  };
}

describe("extension player-history payloads", () => {
  it("keeps only timestamped chart points with a usable player value", () => {
    expect(
      compactExtensionStatsPoints([
        point(),
        point({
          sampledAt: "2026-07-27T11:00:00.000Z",
          players: null,
          avgPlayers: 987.6
        }),
        point({
          sampledAt: "2026-07-27T12:00:00.000Z",
          players: null,
          avgPlayers: null,
          peakPlayers: 1500
        }),
        point({ sampledAt: "not-a-date" }),
        point({
          sampledAt: "2026-07-27T13:00:00.000Z",
          players: null,
          avgPlayers: null,
          peakPlayers: null
        })
      ])
    ).toEqual([
      { sampledAt: "2026-07-27T10:00:00.000Z", players: 1234 },
      { sampledAt: "2026-07-27T11:00:00.000Z", players: 988 },
      { sampledAt: "2026-07-27T12:00:00.000Z", players: 1500 }
    ]);
  });

  it("requires at least two distinct samples before rendering a graph", () => {
    expect(
      hasMeaningfulExtensionHistory([
        { sampledAt: "2026-07-27T10:00:00.000Z", players: 100 }
      ])
    ).toBe(false);
    expect(
      hasMeaningfulExtensionHistory([
        { sampledAt: "2026-07-27T10:00:00.000Z", players: 100 },
        { sampledAt: "2026-07-27T11:00:00.000Z", players: 120 }
      ])
    ).toBe(true);
  });
});
