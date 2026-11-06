import { load } from "cheerio";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GameDiscoverySidebar } from "../GameDiscoverySidebar";
import { GameCollectionOtherPages } from "../GameCollectionOtherPages";
import { GameCollectionSidebarLayout } from "../../games/GameCollectionSidebarLayout";

vi.mock("server-only", () => ({}));
vi.mock("@/components/EventsPageCard", () => ({ EventsPageCard: () => null }));
vi.mock("@/components/ToolCard", () => ({ ToolCard: () => null }));
vi.mock("@/components/CatalogCard", () => ({ CatalogCard: () => null }));
vi.mock("../QuizSidebarCard", () => ({ QuizSidebarCard: () => null }));
vi.mock("../ChecklistSidebarCard", () => ({ ChecklistSidebarCard: () => <div>Checklist</div> }));
vi.mock("../StatsSidebarCard", () => ({ StatsSidebarCard: () => null }));
vi.mock("../CatalogListSidebar", () => ({ CatalogListSidebar: () => null }));
vi.mock("@/components/SocialShare", () => ({ SocialShare: () => <div>Share this collection with your friends</div> }));
vi.mock("@/lib/game-sidebar", () => ({ getGameSidebarData: async () => ({
  tools: [], codes: { slug: "example", name: "Example", activeCount: 2, coverImage: null },
  wiki: { slug: "example", title: "Example Wiki", iconUrl: null },
  articles: [{ slug: "guide", title: "Example guide", coverImage: "https://example.com/cover.png" }],
  checklist: { slug: "example", title: "Example tasks", itemsCount: 12 }, quiz: null, fallback: null
}) }));

describe("collection discovery", () => {
  it("preserves the default codes, wiki, covered article and checklist order for other callers", async () => {
    const $ = load(renderToStaticMarkup((await GameDiscoverySidebar({ universeId: 1, universeName: "Example", currentType: "tool" }))!));
    expect($("a").map((_, a) => $(a).attr("href")).get()).toEqual(["/codes/example", "/wiki/example", "/articles/guide", "/articles/guide"]);
    expect($("img[src='https://example.com/cover.png']")).toHaveLength(1);
    expect($.text().indexOf("Example guide")).toBeLessThan($.text().indexOf("Checklist"));
  });

  it("omits the wiki and article cover only when collection options are passed", async () => {
    const $ = load(renderToStaticMarkup((await GameDiscoverySidebar({ universeId: 1, universeName: "Example", currentType: "collection", hideWiki: true, articlesWithoutCover: true }))!));
    expect($("a[href='/wiki/example']")).toHaveLength(0);
    expect($("img[src='https://example.com/cover.png']")).toHaveLength(0);
    expect($("a[href='/articles/guide']")).toHaveLength(1);
  });

  it("renders no other-pages block when the game has none or only wiki and collection pages", () => {
    expect(renderToStaticMarkup(<GameCollectionOtherPages gameName="Example" pages={[]} />)).toBe("");
    expect(renderToStaticMarkup(<GameCollectionOtherPages gameName="Example" pages={[{ kind: "game_wiki_pages_view", title: "Wiki", href: "/wiki/example", image: null }, { kind: "game_collection_pages_view", title: "Items", href: "/wiki/example/items", image: null }]} />)).toBe("");
  });

  it("shows at most one of each other page type and two articles, with stored links and no article covers", () => {
    const pages = ["code", "map", "tool", "article", "quiz", "checklist", "wiki", "collection"].flatMap(kind => Array.from({ length: 3 }, (_, i) => ({ kind: `game_${kind}_pages_view`, title: `${kind} ${i}`, href: `/${kind}/${i}`, image: "https://example.com/image.png" })));
    const $ = load(renderToStaticMarkup(<GameCollectionOtherPages gameName="Example" pages={pages} />));
    expect($("a").map((_, a) => $(a).attr("href")).get()).toEqual(["/code/0", "/map/0", "/tool/0", "/article/0", "/article/1", "/quiz/0", "/checklist/0"]);
    expect($("a[href='/article/0'] img")).toHaveLength(0);
  });

  it("puts one sidebar directly in the grid and duplicates only the collection navigation outside the article", () => {
    const $ = load(renderToStaticMarkup(<GameCollectionSidebarLayout canonicalPath="/wiki/example/a" title="A" code="a" gameName="Example" wikiPath="/wiki/example" wikiImage={null} collectionOptions={[{ value: "b", href: "/wiki/example/b", label: "B" }]}><article id="article-body"><p>Body</p></article><div data-comments>Comments</div></GameCollectionSidebarLayout>));
    expect($(".content-sidebar-grid > aside#sidebar.space-y-4")).toHaveLength(1);
    expect($("aside")).toHaveLength(1);
    expect($("#article-body a")).toHaveLength(0);
    expect($("a[href='/wiki/example/b']")).toHaveLength(2);
    expect($(".lg\\:hidden").prev().attr("data-comments")).toBeDefined();
  });
});
