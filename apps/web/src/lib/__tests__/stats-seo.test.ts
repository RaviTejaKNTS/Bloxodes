import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getStatsGamesSeoState,
  listStatsGamesIndexPaths,
  parseStatsSearchParams,
  statsGameSeoDescription,
  statsGameSeoTitle,
  type StatsGamesSeoTaxonomy
} from "@/lib/stats";

const taxonomy: StatsGamesSeoTaxonomy = {
  genres: ["Action", "Simulation"],
  subgenres: [
    { genre: "Action", subgenre: "Battlegrounds & Fighting" },
    { genre: "Simulation", subgenre: "Tycoon" }
  ]
};

function seo(searchParams?: Record<string, string | string[] | undefined>) {
  return getStatsGamesSeoState(parseStatsSearchParams(searchParams), taxonomy);
}

describe("stats games SEO policy", () => {
  it("indexes the approved unfiltered sorts", () => {
    expect(seo().indexable).toBe(true);
    expect(seo({ sort: "visits" }).indexable).toBe(true);
    expect(seo({ sort: "growth_24h" }).indexable).toBe(true);
    expect(seo({ sort: "growth_7d" }).indexable).toBe(true);
  });

  it("indexes only CCU and visits for valid genre and subgenre scopes", () => {
    expect(seo({ genre: "Action" }).indexable).toBe(true);
    expect(seo({ genre: "Action", sort: "visits" }).indexable).toBe(true);
    expect(seo({ genre: "Action", subgenre: "Battlegrounds & Fighting" }).indexable).toBe(true);
    expect(seo({ genre: "Action", subgenre: "Battlegrounds & Fighting", sort: "visits" }).indexable).toBe(true);

    const filteredGrowth = seo({ genre: "Action", sort: "growth_24h" });
    expect(filteredGrowth.indexable).toBe(false);
    expect(filteredGrowth.canonicalPath).toBe("/stats/games?genre=Action");
  });

  it("rejects invented genres and invalid genre-subgenre combinations", () => {
    const inventedGenre = seo({ genre: "Something" });
    expect(inventedGenre.indexable).toBe(false);
    expect(inventedGenre.canonicalPath).toBe("/stats/games");

    const invalidSubgenre = seo({ genre: "Action", subgenre: "Tycoon", sort: "visits" });
    expect(invalidSubgenre.indexable).toBe(false);
    expect(invalidSubgenre.canonicalPath).toBe("/stats/games?genre=Action&sort=visits");
  });

  it("rejects duplicate and utility URL variants", () => {
    expect(seo({ sort: "playing" }).indexable).toBe(false);
    expect(seo({ page: "1" }).indexable).toBe(false);
    expect(seo({ genre: "" }).indexable).toBe(false);
    expect(seo({ genre: "Action", column: "rank" }).indexable).toBe(false);
    expect(seo({ utm_source: "test" }).indexable).toBe(false);
    expect(seo({ genre: ["Action", "Action"] }).indexable).toBe(false);
  });

  it("builds only the approved sitemap matrix", () => {
    const paths = listStatsGamesIndexPaths(taxonomy.genres, taxonomy.subgenres);
    expect(paths).toHaveLength(12);
    expect(paths).toContain("/stats/games");
    expect(paths).toContain("/stats/games?sort=growth_24h");
    expect(paths).toContain("/stats/games?genre=Action");
    expect(paths).toContain("/stats/games?genre=Action&sort=visits");
    expect(paths).toContain("/stats/games?genre=Action&subgenre=Battlegrounds+%26+Fighting");
    expect(paths).not.toContain("/stats/games?genre=Action&sort=growth_24h");
    expect(paths.some((path) => path.includes("sort=favorites"))).toBe(false);
  });
});

describe("individual stats game metadata", () => {
  it("adds Roblox to titles without duplicating the word", () => {
    expect(statsGameSeoTitle("Brookhaven RP")).toBe("Brookhaven RP Roblox Stats & Player Count");
    expect(statsGameSeoTitle("Roblox Studio")).toBe("Roblox Studio Stats & Player Count");
  });

  it("uses rank and current players when available", () => {
    expect(statsGameSeoDescription({ displayName: "Brookhaven RP", rank: 1, playing: 511_500 })).toBe(
      "Brookhaven RP ranks #1 among tracked Roblox games with 511.5K players now. See visits, favorites, rating, growth, and historical charts."
    );
  });
});
