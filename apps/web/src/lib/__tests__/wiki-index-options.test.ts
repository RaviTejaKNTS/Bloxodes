import { describe, expect, it } from "vitest";
import { selectWikiIndexPages, wikiIndexOptions, wikiIndexQuery } from "../wiki-index-options";
import type { WikiListEntry } from "../wiki";

const now = Date.parse("2026-09-05T12:00:00Z");
const page = (id: string, title: string, fields: Partial<WikiListEntry> = {}) => ({ id, title, slug: id, ...fields } as WikiListEntry);
const pages = [
  page("fisch", "Fisch Wiki", { universe_genre_l1: "Simulation", playing: 200, last_playing_refreshed_at: "2026-09-05T11:00:00Z", content_updated_at: "2026-09-02" }),
  page("forge", "The Forge Wiki", { universe_genre_l1: "RPG", playing: 500, last_playing_refreshed_at: "2026-09-01T11:00:00Z", content_updated_at: "2026-09-04" }),
  page("fish-game", "Fish Game Wiki", { universe_genre_l1: "RPG", playing: 0, last_playing_refreshed_at: "2026-09-05T11:00:00Z", content_updated_at: "2026-09-03" })
];

describe("wiki directory options", () => {
  it("normalizes bounded scalar filters and ignores unsupported sorting", () => {
    expect(wikiIndexOptions({ q: ["Fisch", "Forge"], genre: "  RPG  ", sort: "invalid" })).toEqual({ q: "", genre: "RPG", sort: "updated" });
    expect(wikiIndexOptions({ q: "a".repeat(200) }).q).toHaveLength(100);
  });
  it("encodes filters and omits defaults for canonical pagination links", () => {
    expect(wikiIndexQuery(wikiIndexOptions())).toBe("");
    expect(wikiIndexQuery(wikiIndexOptions({q:"A & B",genre:"Action RPG",sort:"name"}))).toBe("q=A+%26+B&genre=Action+RPG&sort=name");
  });
  it("combines case-insensitive name search with the genre filter", () => {
    expect(selectWikiIndexPages(pages, wikiIndexOptions({q:"FISH",genre:"RPG"}),now).map(x=>x.id)).toEqual(["fish-game"]);
    expect(selectWikiIndexPages(pages, wikiIndexOptions({q:"wiki"}),now)).toEqual([]);
  });
  it("sorts recent content without mutating the source array", () => {
    expect(selectWikiIndexPages(pages,wikiIndexOptions(),now).map(x=>x.id)).toEqual(["forge","fish-game","fisch"]);
    expect(pages.map(x=>x.id)).toEqual(["fisch","forge","fish-game"]);
  });
  it("puts stale player counts after valid observations, including zero", () => {
    expect(selectWikiIndexPages(pages,wikiIndexOptions({sort:"players"}),now).map(x=>x.id)).toEqual(["fisch","fish-game","forge"]);
  });
  it("uses stable ID ordering when dates tie", () => {
    expect(selectWikiIndexPages([page("b","Test Wiki"),page("a","Test Wiki")],wikiIndexOptions(),now).map(x=>x.id)).toEqual(["a","b"]);
  });
});
