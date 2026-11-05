import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GameCollectionsRail, orderOtherCollections } from "../GameCollectionsRail";

const collections = Array.from({ length: 8 }, (_, index) => ({ value: String(index), label: `Collection ${index}`, href: `/wiki/example/${index}` }));

describe("collection navigation", () => {
  it("starts after the current collection, wraps, and keeps every other collection", () => {
    const ordered = orderOtherCollections(collections, "6");
    expect(ordered.map(entry => entry.value)).toEqual(["7", "0", "1", "2", "3", "4", "5"]);
    const $ = load(renderToStaticMarkup(<GameCollectionsRail gameName="Example" collections={ordered} />));
    expect($("section").eq(0).find("a").map((_, a) => $(a).text().trim()).get()).toEqual(["Collection 7", "Collection 0", "Collection 1"]);
    expect($("section").eq(1).find("a").map((_, a) => $(a).text()).get()).toEqual(["Collection 2", "Collection 3", "Collection 4", "Collection 5"]);
    expect($("a[href='/wiki/example/6']")).toHaveLength(0);
    expect($("section").eq(1).find("ul > li")).toHaveLength(4);
    expect($("section").eq(1).find("li").last().text()).not.toContain("·");
  });

  it.each([1, 2, 3])("shows cards only for %i other collections", count => {
    const html = renderToStaticMarkup(<GameCollectionsRail gameName="Example" collections={collections.slice(0, count)} />);
    expect(load(html)("section")).toHaveLength(1);
    expect(html).not.toContain("All other");
  });

  it("omits the entire rail when there are no other collections", () => {
    expect(renderToStaticMarkup(<GameCollectionsRail gameName="Example" collections={orderOtherCollections(collections.slice(0, 1), "0")} />)).toBe("");
  });

  it("formats known counts and uses an icon for missing images without a site-logo fallback", () => {
    const html = renderToStaticMarkup(<GameCollectionsRail gameName="Example" collections={[{ ...collections[0], count: 1234, image: "https://example.com/item.png" }, { ...collections[1], count: null }, collections[2]]} />);
    const $ = load(html);
    expect($("li").eq(0).text()).toContain("1,234 entries");
    expect($("li").eq(1).text()).not.toContain("entries");
    expect($("li").eq(2).text()).not.toContain("entries");
    expect($("img")).toHaveLength(1);
    expect($("img").attr("class")).toContain("object-contain");
    expect($("li").eq(1).find("svg")).toHaveLength(1);
    expect(html).not.toContain("/Bloxodes.png");
  });

  it("preserves all options if the current code is absent", () => {
    expect(orderOtherCollections(collections, "missing")).toEqual(collections);
  });
});

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
describe("collection layout contracts", () => {
  it("keeps the phone navigation outside the article and has one direct grid sidebar in each layout", () => {
    for (const path of ["../../games/GameCollectionSidebarLayout.tsx", "../../../app/(site)/wiki/[slug]/[collection]/layout.tsx"]) {
      const source = read(path);
      expect(source).toContain('className="min-w-0">{children}<div className="mt-10 lg:hidden">{rail}</div></div>');
      expect(source.match(/<PageSidebar /g)).toHaveLength(1);
      expect(source).toContain('<PageSidebar className="hidden lg:block">');
      expect(source).not.toContain('id="article-body"');
      expect(source).not.toContain("aside.space-y-4");
      expect(source).toContain("GameCollectionsRail");
    }
  });

  it("removes the old bottom section and its option from every renderer", () => {
    for (const path of ["../../more-content.tsx", ...["generic", "grow-a-garden", "the-forge"].map(name => `../../../app/(site)/wiki/collections/games/${name}.tsx`)]) {
      expect(read(path)).not.toMatch(/MoreWikiCollections|showMoreCollections/);
    }
  });

  it("opts only collection layouts into coverless articles and a separately placed wiki", () => {
    const layout = read("../../../app/(site)/wiki/[slug]/[collection]/layout.tsx");
    expect(layout).toContain("<GameDiscoverySidebar hideWiki articlesWithoutCover");
    const discovery = read("../GameDiscoverySidebar.tsx");
    expect(discovery).toContain("hideWiki = false, articlesWithoutCover = false");
    expect(discovery).toContain("withoutCover = false");
    expect(read("../../games/GameCollectionPage.tsx")).toContain("getGameDirectoryPages(page.namespace, page.game_id, false)");
  });
});
