import { describe, expect, it } from "vitest";
import { cacheTagsForEvent, cacheTagsForPath, serializeCacheTags } from "@/lib/public-cache-tags";

describe("public cache tags", () => {
  it("refreshes the wiki overview when its activity and events change", () => {
    const tags = cacheTagsForPath("/wiki");
    expect(tags).toEqual(expect.arrayContaining(["wiki-index", "stats", "events"]));
    expect(cacheTagsForEvent("stats", "platform").some((tag) => tags.includes(tag))).toBe(true);
    expect(cacheTagsForEvent("event", "fisch").some((tag) => tags.includes(tag))).toBe(true);
    expect(cacheTagsForPath("/wiki/page/2")).toContain("stats");
  });
  it("tags the codes index separately from code detail pages", () => {
    expect(cacheTagsForPath("/codes")).toContain("codes-index");
    expect(cacheTagsForPath("/codes/page/2")).toContain("codes-index");
    expect(cacheTagsForPath("/codes/car-wash-tycoon")).toEqual(
      expect.arrayContaining(["site", "codes", "code:car-wash-tycoon"])
    );
  });

  it.each(["gta5", "red-dead-2", "minecraft-java", "peak"])("tags %s pages by their stored public path", slug => {
    expect(cacheTagsForPath(`/maps/${slug}`)).toContain(`page:/maps/${slug}`);
    expect(cacheTagsForPath(`/wiki/${slug}/items/page/99`)).toContain(`page:/wiki/${slug}/items`);
  });

  it("purges code detail, indexes, home, feed, and sitemap tags for code events", () => {
    const tags = cacheTagsForEvent("code", "Car-Wash-Tycoon");
    expect(tags).toEqual(
      expect.arrayContaining(["code:car-wash-tycoon", "codes", "codes-index", "home", "feed", "sitemap", "sitemap:codes"])
    );
    expect(tags).not.toContain("site");
  });

  it("tags article game hubs separately from article detail pages", () => {
    expect(cacheTagsForPath("/articles/games/fisch")).toEqual(
      expect.arrayContaining(["site", "articles-index", "articles-games", "article-game:fisch"])
    );
    expect(cacheTagsForPath("/articles/games/fisch/page/2")).toEqual(
      expect.arrayContaining(["site", "articles-index", "articles-games", "article-game:fisch"])
    );
    expect(cacheTagsForEvent("article", "fisch-guide")).toEqual(
      expect.arrayContaining(["article:fisch-guide", "articles", "articles-index", "articles-games", "sitemap:articles"])
    );
  });

  it("purges family detail tags for cross-detail recommendation rows", () => {
    expect(cacheTagsForEvent("event", "grow-a-garden")).toEqual(expect.arrayContaining(["events", "events-index"]));
    expect(cacheTagsForEvent("tool", "robux-to-usd-calculator")).toEqual(expect.arrayContaining(["tools", "tools-index"]));
    expect(cacheTagsForEvent("quiz", "fisch-quiz")).toEqual(expect.arrayContaining(["quizzes", "quizzes-index"]));
    expect(cacheTagsForEvent("puzzle", "connections/2026-06-24")).toEqual(expect.arrayContaining(["puzzles", "puzzles-index"]));
  });

  it("tags wiki collection pages with both wiki and collection tags", () => {
    expect(cacheTagsForPath("/wiki/slime-rng/slimes")).toEqual(
      expect.arrayContaining(["wiki:slime-rng", "wiki-collection:slime-rng/slimes", "wiki-collection-index"])
    );
  });

  it("keeps the sitemap index tag separate from family sitemap tags", () => {
    expect(cacheTagsForPath("/sitemap.xml")).toEqual(expect.arrayContaining(["site", "sitemap"]));
    expect(cacheTagsForPath("/sitemaps/codes.xml")).toEqual(expect.arrayContaining(["site", "sitemap:codes"]));
    expect(cacheTagsForPath("/sitemaps/codes.xml")).not.toContain("sitemap");
  });

  it("tags public informational pages without tagging unknown routes", () => {
    expect(cacheTagsForPath("/about")).toEqual(["site", "main"]);
    expect(cacheTagsForPath("/privacy-policy")).toEqual(["site", "main"]);
    expect(cacheTagsForPath("/api/private")).toEqual([]);
  });

  it("tags stats creators separately from games", () => {
    expect(cacheTagsForPath("/stats/creators")).toEqual(expect.arrayContaining(["site", "stats", "stats-creators"]));
    expect(cacheTagsForEvent("stats", "creators")).toEqual(expect.arrayContaining(["stats", "stats-creators", "sitemap:stats"]));
    expect(cacheTagsForPath("/stats/items")).toEqual(expect.arrayContaining(["site", "stats", "stats-items"]));
    expect(cacheTagsForEvent("stats", "items")).toEqual(expect.arrayContaining(["stats", "stats-items", "sitemap:stats"]));
  });

  it("serializes unique Cloudflare cache tags", () => {
    expect(serializeCacheTags(["home", "home", "codes-index"])).toBe("home,codes-index");
  });
});


describe("shared game cache invalidation", () => {
 it("purges the cached games directory when shared game content changes", () => {
  expect(cacheTagsForEvent("game_content", "sandustry/wiki")).toContain("games-index");
  expect(cacheTagsForPath("/games")).toContain("games-index");
 });
});


it("shared game events avoid broad Roblox family tags and pagination shares its page dependency", () => {
  const tags = cacheTagsForEvent("game_content", "wiki/peak/items");
  for (const broad of ["game-content", "wiki", "codes", "tools", "site"]) expect(tags).not.toContain(broad);
  expect(cacheTagsForPath("/wiki/peak/items/page/99")).toContain("page:/wiki/peak/items");
  expect(cacheTagsForPath("/wiki/blox-fruits")).not.toContain("game-content");
});
