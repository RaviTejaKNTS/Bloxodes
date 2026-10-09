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
vi.mock("@/components/AccountSheetButton", () => ({
  AccountSheetButton: ({ className }: { className: string }) => <button className={className}>Account</button>
}));

import { SiteGameTopBarClient } from "@/components/SiteGameTopBarClient";
import { parseGameTopNavPath } from "@/lib/game-top-nav-path";

const account = { avatarUrl: null, href: "/login", label: "Sign in", signedIn: false };
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

function headerClasses(html: string) {
  return html.match(/<header class="([^"]*)"/)![1].split(" ");
}

beforeEach(() => {
  navigation.pathname = "/wiki/blox-fruits";
});

describe("game top bar", () => {
  it("shows game links below xl and keeps desktop sticky behavior and the account button", () => {
    const html = renderToStaticMarkup(
      <SiteGameTopBarClient account={account} initialPathname={navigation.pathname} initialGameNav={gameNav} />
    );
    const classes = headerClasses(html);
    expect(classes).not.toContain("hidden");
    expect(classes).not.toContain("sticky");
    expect(classes).toContain("xl:sticky");
    expect(classes).toContain("top-0");
    expect(html).toContain('aria-label="Blox Fruits pages"');
    expect(html).toContain('href="/codes/blox-fruits"');
    expect(html).toContain("Tools");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("max-w-[8rem]");
    expect(html).toContain("hidden shrink-0 xl:inline-flex");
  });

  it("keeps a resolved empty bar hidden below xl", () => {
    const html = renderToStaticMarkup(
      <SiteGameTopBarClient account={account} initialPathname={navigation.pathname} initialGameNav={null} />
    );
    expect(headerClasses(html)).toContain("hidden");
    expect(headerClasses(html)).toContain("xl:block");
  });

  it("reserves the full row on the first render before the nav fetch", () => {
    const html = renderToStaticMarkup(<SiteGameTopBarClient account={account} />);
    expect(headerClasses(html)).not.toContain("hidden");
    expect(html).toContain("min-h-14");
    expect(html).not.toContain("Blox Fruits pages");
  });

  it.each(["/", "/articles", "/about"])("does not reserve an empty bar for %s", (pathname) => {
    navigation.pathname = pathname;
    const html = renderToStaticMarkup(<SiteGameTopBarClient account={account} />);
    expect(headerClasses(html)).toContain("hidden");
    expect(headerClasses(html)).toContain("xl:block");
  });

  it("does not show initial nav from another pathname", () => {
    navigation.pathname = "/about";
    const html = renderToStaticMarkup(
      <SiteGameTopBarClient account={account} initialPathname="/wiki/blox-fruits" initialGameNav={gameNav} />
    );
    expect(headerClasses(html)).toContain("hidden");
    expect(html).not.toContain("Blox Fruits pages");
  });

  it("shows an initial catalog nav below xl", () => {
    const html = renderToStaticMarkup(
      <SiteGameTopBarClient
        account={account}
        initialPathname={navigation.pathname}
        initialCatalogNav={{ title: "Catalog", links: [{ label: "Items", href: "/catalog" }] }}
      />
    );
    expect(headerClasses(html)).not.toContain("hidden");
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
