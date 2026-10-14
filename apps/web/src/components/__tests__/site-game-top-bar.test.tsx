import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameTopNavContext } from "@/lib/game-top-nav-types";

const navigation = vi.hoisted(() => ({ pathname: "/wiki/blox-fruits" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>
}));
import { SiteGameTopBarClient } from "@/components/SiteGameTopBarClient";
import { parseGameTopNavPath } from "@/lib/game-top-nav-path";

const gameNav: GameTopNavContext = {
  gameName: "Blox Fruits",
  thumbnailUrl: null,
  links: [
    { label: "Wiki", href: "/wiki/blox-fruits", type: "wiki" },
    { label: "Stats", href: "/stats/games/blox-fruits-994732206", type: "stats" },
    { label: "Codes", href: "/codes/blox-fruits", type: "codes" }
  ],
  tools: [{ label: "Calculator", href: "/tools/blox-fruits/calculator" }]
};

function barClasses(html: string) {
  return html.match(/<div data-game-bar="true" class="([^"]*)"/)?.[1].split(" ") ?? null;
}

beforeEach(() => {
  navigation.pathname = "/wiki/blox-fruits";
});

describe("game top bar", () => {
  it("renders a compact secondary bar that scrolls with the page", () => {
    const html = renderToStaticMarkup(
      <SiteGameTopBarClient initialPathname={navigation.pathname} initialGameNav={gameNav} />
    );
    const classes = barClasses(html)!;
    expect(classes).not.toContain("hidden");
    expect(classes.some((name) => name.includes("sticky"))).toBe(false);
    expect(html).toContain("min-h-11");
    expect(html).toContain('aria-label="Blox Fruits pages"');
    expect(html).toContain('href="/codes/blox-fruits"');
    expect(html).toContain("Tools");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("max-w-[8rem]");
    expect(html).not.toContain("Account");
  });

  it("renders nothing once a page resolves without a game", () => {
    const html = renderToStaticMarkup(
      <SiteGameTopBarClient initialPathname={navigation.pathname} initialGameNav={null} />
    );
    expect(html).toBe("");
  });

  it("reserves the full row on the first render before the nav fetch", () => {
    const html = renderToStaticMarkup(<SiteGameTopBarClient />);
    expect(barClasses(html)).not.toBeNull();
    expect(html).toContain("min-h-11");
    expect(html).not.toContain("Blox Fruits pages");
  });

  it.each(["/", "/articles", "/about"])("does not reserve an empty bar for %s", (pathname) => {
    navigation.pathname = pathname;
    const html = renderToStaticMarkup(<SiteGameTopBarClient />);
    expect(html).toBe("");
  });

  it("does not show initial nav from another pathname", () => {
    navigation.pathname = "/about";
    const html = renderToStaticMarkup(
      <SiteGameTopBarClient initialPathname="/wiki/blox-fruits" initialGameNav={gameNav} />
    );
    expect(html).toBe("");
  });

  it("shows an initial catalog nav", () => {
    const html = renderToStaticMarkup(
      <SiteGameTopBarClient
        initialPathname={navigation.pathname}
        initialCatalogNav={{ title: "Catalog", links: [{ label: "Items", href: "/catalog" }] }}
      />
    );
    expect(barClasses(html)).not.toBeNull();
    expect(html).toContain('aria-label="Catalog catalog"');
  });
});

describe("shared game top nav pathname parser", () => {
  it.each([
    ["/wiki/blox-fruits", "wiki"],
    ["/wiki/blox-fruits/swords", "wikiCatalog"],
    ["/codes/blox-fruits", "codes"],
    ["/events/blox-fruits", "events"],
    ["/checklists/blox-fruits", "checklists"],
    ["/quizzes/blox-fruits", "quizzes"],
    ["/stats/games/blox-fruits-994732206", "stats"],
    ["/stats/games/blox-fruits", "stats"],
    ["/tools/blox-fruits-calculator", "tools"],
    ["/tools/blox-fruits/calculator", "tools"],
    ["/articles/blox-fruits-guide", "articleDetail"],
    ["/articles/games/blox-fruits", "articleGame"],
    ["/articles/games/blox-fruits/page/2", "articleGame"]
  ])("reserves %s using the server resolver's target type", (pathname, type) => {
    expect(parseGameTopNavPath(pathname)?.type).toBe(type);
  });

  it.each([
    "/", "/articles", "/about", "/wiki", "/codes", "/events", "/checklists", "/quizzes", "/tools", "/stats/games",
    "/wiki/blox-fruits/swords/extra", "/codes/blox-fruits/extra", "/articles/page/2", "/gta/wiki/gta-5"
  ])("does not reserve %s", (pathname) => {
    expect(parseGameTopNavPath(pathname)).toBeNull();
  });

  it("preserves URL normalization and decoded slugs", () => {
    expect(parseGameTopNavPath("https://bloxodes.com/WIKI/Blox%2DFruits/?page=2#items")).toEqual({
      type: "wiki", table: "wiki_pages_view", slugField: "slug", slug: "blox-fruits"
    });
  });

  it("rejects malformed URL encoding without throwing during render", () => {
    expect(parseGameTopNavPath("/wiki/%E0%A4%A")).toBeNull();
  });
});
