import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../stats/components/StatsViews", () => ({ StatsGamesView: () => null, StatsPageShell: () => null }));
vi.mock("@/lib/stats", async original => ({
  ...await original<typeof import("@/lib/stats")>(),
  getStatsGamesSeoTaxonomy: async () => ({ genres: ["Action"], subgenres: [] })
}));

import { generateMetadata } from "../stats/games/page";

describe("stats games metadata titles", () => {
  it.each<[Record<string, string>, string]>([
    [{}, "Most Popular Roblox Games Right Now (Live Player Counts)"],
    [{ genre: "Action" }, "Most Popular Action Roblox Games Right Now"],
    [{ sort: "visits" }, "Most Visited Roblox Games"],
    [{ genre: "Action", sort: "visits" }, "Most Visited Action Roblox Games"]
  ])("omits the site suffix for %j", async (params, title) => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve(params) });
    expect(metadata.title).toBe(title);
    expect(metadata.openGraph).toMatchObject({ title });
    expect(metadata.twitter).toMatchObject({ title });
  });
});
