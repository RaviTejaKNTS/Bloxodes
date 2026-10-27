import { Children, isValidElement, type ReactNode } from "react";
import type { Metadata } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogRows } from "../../../../../scripts/ci/catalog-query-fixture.mjs";
import { MusicChartPage } from "@/app/(site)/catalog/roblox-music-ids/chart-page";
import { MusicChartsPage } from "@/app/(site)/catalog/roblox-music-ids/charts-page";
import { resolveSeoTitle } from "../seo";
import * as musicArtistsArtistPaginated from "@/app/(site)/catalog/roblox-music-ids/artists/[artist]/page/[page]/page";
import * as musicArtistsArtist from "@/app/(site)/catalog/roblox-music-ids/artists/[artist]/page";
import * as musicArtistsPaginated from "@/app/(site)/catalog/roblox-music-ids/artists/page/[page]/page";
import * as musicArtists from "@/app/(site)/catalog/roblox-music-ids/artists/page";
import * as musicChartsPaginated from "@/app/(site)/catalog/roblox-music-ids/charts/page/[page]/page";
import * as musicCharts from "@/app/(site)/catalog/roblox-music-ids/charts/page";
import * as musicDailyTop500Paginated from "@/app/(site)/catalog/roblox-music-ids/daily-top-500/page/[page]/page";
import * as musicDailyTop500 from "@/app/(site)/catalog/roblox-music-ids/daily-top-500/page";
import * as musicGamesGamePaginated from "@/app/(site)/catalog/roblox-music-ids/games/[game]/page/[page]/page";
import * as musicGamesGame from "@/app/(site)/catalog/roblox-music-ids/games/[game]/page";
import * as musicGames from "@/app/(site)/catalog/roblox-music-ids/games/page";
import * as musicGenresGenrePaginated from "@/app/(site)/catalog/roblox-music-ids/genres/[genre]/page/[page]/page";
import * as musicGenresGenre from "@/app/(site)/catalog/roblox-music-ids/genres/[genre]/page";
import * as musicGenresPaginated from "@/app/(site)/catalog/roblox-music-ids/genres/page/[page]/page";
import * as musicGenres from "@/app/(site)/catalog/roblox-music-ids/genres/page";
import * as musicMonthlyPaginated from "@/app/(site)/catalog/roblox-music-ids/monthly/page/[page]/page";
import * as musicMonthly from "@/app/(site)/catalog/roblox-music-ids/monthly/page";
import * as musicPaginated from "@/app/(site)/catalog/roblox-music-ids/page/[page]/page";
import * as musicMain from "@/app/(site)/catalog/roblox-music-ids/page";
import * as musicTrendingPaginated from "@/app/(site)/catalog/roblox-music-ids/trending/page/[page]/page";
import * as musicTrending from "@/app/(site)/catalog/roblox-music-ids/trending/page";
import * as musicWeeklyPaginated from "@/app/(site)/catalog/roblox-music-ids/weekly/page/[page]/page";
import * as musicWeekly from "@/app/(site)/catalog/roblox-music-ids/weekly/page";
import * as musicYearlyPaginated from "@/app/(site)/catalog/roblox-music-ids/yearly/page/[page]/page";
import * as musicYearly from "@/app/(site)/catalog/roblox-music-ids/yearly/page";
import * as decalCategoriesCategoryPaginated from "@/app/(site)/catalog/roblox-decal-ids/categories/[category]/page/[page]/page";
import * as decalCategoriesCategory from "@/app/(site)/catalog/roblox-decal-ids/categories/[category]/page";
import * as decalCategories from "@/app/(site)/catalog/roblox-decal-ids/categories/page";
import * as decalCuratedPaginated from "@/app/(site)/catalog/roblox-decal-ids/curated/page/[page]/page";
import * as decalCurated from "@/app/(site)/catalog/roblox-decal-ids/curated/page";
import * as decalGamesGamePaginated from "@/app/(site)/catalog/roblox-decal-ids/games/[game]/page/[page]/page";
import * as decalGamesGame from "@/app/(site)/catalog/roblox-decal-ids/games/[game]/page";
import * as decalGames from "@/app/(site)/catalog/roblox-decal-ids/games/page";
import * as decalPaginated from "@/app/(site)/catalog/roblox-decal-ids/page/[page]/page";
import * as decalMain from "@/app/(site)/catalog/roblox-decal-ids/page";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ catalog: vi.fn(), admin: vi.fn(), total: 50 }));
vi.mock("@/lib/catalog", () => ({ getCatalogPageContentByCodes: mocks.catalog }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.admin }));
vi.mock("@/lib/catalog-game-source", () => ({ hasCatalogGameMappings: async () => true }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); }
}));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));
vi.mock("@/components/more-content", () => ({ MoreCatalogs: () => null }));
vi.mock("@/lib/page-content", () => ({
  buildPageContentHtml: async () => ({
    title: "Saved title (January 2024)", introHtml: "", howHtml: "", descriptionHtml: [], faqHtml: [],
    publishedAt: "2024-01-02T03:04:05Z", updatedAt: "2025-02-03T04:05:06Z"
  }),
  renderPageContentNodes: () => null
}));
vi.mock("@/app/(site)/catalog/roblox-music-ids/MusicIdsBrowser", () => ({ MusicIdsBrowser: () => null }));
vi.mock("@/app/(site)/catalog/roblox-decal-ids/DecalIdsBrowser", () => ({ DecalIdsBrowser: () => null }));

type RouteProps = {
  params: Promise<{ page: string; game: string; artist: string; genre: string; category: string }>;
  searchParams: Promise<{ range: string }>;
};
type RouteModule = {
  default: (props: RouteProps) => ReactNode | Promise<ReactNode>;
  generateMetadata: (props: RouteProps) => Metadata | Promise<Metadata>;
};
const routes: Array<{ path: string; module: RouteModule }> = [
  { path: "roblox-music-ids/artists/[artist]/page/[page]/page.tsx", module: musicArtistsArtistPaginated },
  { path: "roblox-music-ids/artists/[artist]/page.tsx", module: musicArtistsArtist },
  { path: "roblox-music-ids/artists/page/[page]/page.tsx", module: musicArtistsPaginated },
  { path: "roblox-music-ids/artists/page.tsx", module: musicArtists },
  { path: "roblox-music-ids/charts/page/[page]/page.tsx", module: musicChartsPaginated },
  { path: "roblox-music-ids/charts/page.tsx", module: musicCharts },
  { path: "roblox-music-ids/games/[game]/page/[page]/page.tsx", module: musicGamesGamePaginated },
  { path: "roblox-music-ids/games/[game]/page.tsx", module: musicGamesGame },
  { path: "roblox-music-ids/games/page.tsx", module: musicGames },
  { path: "roblox-music-ids/genres/[genre]/page/[page]/page.tsx", module: musicGenresGenrePaginated },
  { path: "roblox-music-ids/genres/[genre]/page.tsx", module: musicGenresGenre },
  { path: "roblox-music-ids/genres/page/[page]/page.tsx", module: musicGenresPaginated },
  { path: "roblox-music-ids/genres/page.tsx", module: musicGenres },
  { path: "roblox-music-ids/page/[page]/page.tsx", module: musicPaginated },
  { path: "roblox-music-ids/page.tsx", module: musicMain },
  { path: "roblox-music-ids/trending/page/[page]/page.tsx", module: musicTrendingPaginated },
  { path: "roblox-music-ids/trending/page.tsx", module: musicTrending },
  { path: "roblox-decal-ids/categories/[category]/page/[page]/page.tsx", module: decalCategoriesCategoryPaginated },
  { path: "roblox-decal-ids/categories/[category]/page.tsx", module: decalCategoriesCategory },
  { path: "roblox-decal-ids/categories/page.tsx", module: decalCategories },
  { path: "roblox-decal-ids/curated/page/[page]/page.tsx", module: decalCuratedPaginated },
  { path: "roblox-decal-ids/curated/page.tsx", module: decalCurated },
  { path: "roblox-decal-ids/games/[game]/page/[page]/page.tsx", module: decalGamesGamePaginated },
  { path: "roblox-decal-ids/games/[game]/page.tsx", module: decalGamesGame },
  { path: "roblox-decal-ids/games/page.tsx", module: decalGames },
  { path: "roblox-decal-ids/page/[page]/page.tsx", module: decalPaginated },
  { path: "roblox-decal-ids/page.tsx", module: decalMain },
];

function props(path: string, range = "weekly"): RouteProps {
  return {
    params: Promise.resolve({
      page: "2", game: path.startsWith("roblox-music") ? "jujutsu-shenanigans" : "bloxstrike",
      artist: "fixture-artist", genre: "fixture-genre", category: "anime"
    }),
    searchParams: Promise.resolve({ range })
  };
}

// Inspect server-produced elements without running client components or a browser.
function inspect(node: ReactNode) {
  const headings: string[] = [];
  const schemas: Array<Record<string, unknown>> = [];
  const labels: string[] = [];
  function walk(children: ReactNode) {
    Children.forEach(children, child => {
      if (!isValidElement<{ children?: ReactNode; dangerouslySetInnerHTML?: { __html: string }; items?: Array<{ label: string }> }>(child)) return;
      if (child.type === "h1") headings.push(String(child.props.children));
      if (child.type === "script" && child.props.dangerouslySetInnerHTML) {
        schemas.push(JSON.parse(child.props.dangerouslySetInnerHTML.__html));
      }
      for (const item of child.props.items ?? []) if (item.label) labels.push(item.label);
      walk(child.props.children);
    });
  }
  walk(node);
  return { headings, schemas, labels };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
  mocks.catalog.mockResolvedValue(null);
  mocks.total = 50;
  mocks.admin.mockReturnValue({ from(table: string) {
    const rows = table.includes("artists_view") || table.includes("genres_view")
      ? [{ slug: table.includes("artists_view") ? "fixture-artist" : "fixture-genre",
          label: table.includes("artists_view") ? "Fixture artist" : "Fixture genre", item_count: 50 }]
      : catalogRows(table.includes("music") ? "music" : "decal", 1);
    let single = false;
    const query: object = new Proxy({}, { get: (_, key) => {
      if (key === "then") return (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: single ? rows[0] : rows, count: mocks.total, error: null
      }).then(resolve);
      return () => { if (key === "maybeSingle") single = true; return query; };
    }});
    return query;
  }});
});
afterEach(() => vi.useRealTimers());

describe.each(routes)("$path calendar titles", ({ path, module }) => {
  it("dates fallback metadata at call time and preserves URL/robots settings", async () => {
    const october = await module.generateMetadata(props(path));
    expect(String(october.title)).toContain("(October 2026)");
    for (const social of [october.openGraph, october.twitter]) {
      if (social?.title) expect(String(social.title)).toContain("(October 2026)");
    }
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
    const january = await module.generateMetadata(props(path));
    expect(String(january.title)).toContain("(January 2027)");
    expect(String(january.title)).not.toContain("October");
    expect(january.alternates).toEqual(october.alternates);
    expect(january.robots).toEqual(october.robots);
  });

  it("dates the H1 and page/list schemas while keeping item names, labels and real dates", async () => {
    let node = await module.default(props(path));
    if (isValidElement<{ chart: "trending"; pageNumber?: number }>(node) && node.type === MusicChartPage) {
      node = await MusicChartPage(node.props);
    } else if (isValidElement<{ pageNumber?: number; searchParams?: Promise<{ range: string }> }>(node) && node.type === MusicChartsPage) {
      node = await MusicChartsPage(node.props);
    }
    const result = inspect(node);
    expect(result.headings).toHaveLength(1);
    expect(result.headings[0].match(/\(October 2026\)/g)).toHaveLength(1);
    expect(result.labels.every(label => !label.includes("October 2026"))).toBe(true);
    const pages = result.schemas.filter(schema => schema["@type"] === "WebPage");
    expect(pages).toHaveLength(1);
    for (const schema of result.schemas.filter(schema => ["WebPage", "ItemList"].includes(String(schema["@type"])))) {
      expect(String(schema.name).match(/\(October 2026\)/g)).toHaveLength(1);
      expect(String(schema.name)).not.toContain("January 2024");
      for (const item of (schema.itemListElement ?? []) as Array<{ item: { name: string } }>) {
        expect(item.item.name).not.toContain("October 2026");
      }
    }
    if (pages[0].datePublished) {
      expect(new Date(String(pages[0].datePublished)).toISOString()).toBe("2024-01-02T03:04:05.000Z");
    }
    if (pages[0].dateModified) {
      expect(["2025-02-03T04:05:06.000Z", "2026-01-01T00:00:00.000Z"])
        .toContain(new Date(String(pages[0].dateModified)).toISOString());
    }
  });
});

it.each(["weekly", "monthly", "yearly"])("dates the %s chart and keeps its period", async range => {
  const result = inspect(await MusicChartsPage({ pageNumber: 2, searchParams: { range } }));
  expect(result.headings).toEqual(["Roblox music ID charts (October 2026)"]);
  const page = result.schemas.find(schema => schema["@type"] === "WebPage");
  expect(page?.name).toBe(`${range[0].toUpperCase()}${range.slice(1)} Roblox music ID chart (October 2026) - Page 2`);
  expect(String(page?.url)).toContain(`?range=${range}`);
});

it("keeps generic SEO titles unchanged for unrelated pages", () => {
  expect(resolveSeoTitle("Another catalog")).toBe("Another catalog");
});

it("keeps the count in game music metadata and handles the zero-count title branch", async () => {
  const withCount = await musicGamesGame.generateMetadata(props("roblox-music-ids/games/[game]/page.tsx"));
  expect(String(withCount.title)).toMatch(/\[50 .+\] \(October 2026\)$/);
  mocks.total = 0;
  const withoutCount = await musicGamesGame.generateMetadata(props("roblox-music-ids/games/[game]/page.tsx"));
  expect(String(withoutCount.title)).toContain("(October 2026)");
  expect(String(withoutCount.title)).not.toContain("[50");
});

it("dates both unknown decal-category metadata fallbacks", async () => {
  const args = props("roblox-decal-ids/categories/[category]/page.tsx");
  args.params = Promise.resolve({ ...(await args.params), category: "missing-category" });
  expect((await decalCategoriesCategory.generateMetadata(args)).title).toBe("Roblox Decal IDs (October 2026) | Bloxodes");
  expect((await decalCategoriesCategoryPaginated.generateMetadata(args)).title).toBe("Roblox Decal IDs (October 2026) | Bloxodes");
});

it("normalizes saved placeholders in roblox-music-ids metadata and both social titles", async () => {
  mocks.catalog.mockResolvedValue({ seo_title: "Saved IDs (%month% %year%) | Bloxodes", title: "Saved IDs" });
  const metadata = await musicMain.generateMetadata();
  expect(metadata.title).toBe("Saved IDs (October 2026) | Bloxodes");
  expect(metadata.openGraph?.title).toBe(metadata.title);
  expect(metadata.twitter?.title).toBe(metadata.title);
});

it("normalizes saved placeholders in roblox-decal-ids metadata and both social titles", async () => {
  mocks.catalog.mockResolvedValue({ seo_title: "Saved IDs (%month% %year%) | Bloxodes", title: "Saved IDs" });
  const metadata = await decalMain.generateMetadata();
  expect(metadata.title).toBe("Saved IDs (October 2026) | Bloxodes");
  expect(metadata.openGraph?.title).toBe(metadata.title);
  expect(metadata.twitter?.title).toBe(metadata.title);
});

describe("legacy music redirects", () => {
  it("preserves roblox-music-ids/daily-top-500/page/[page]/page.tsx", async () => {
    await expect((async () => musicDailyTop500Paginated.default(props("roblox-music-ids/daily-top-500/page/[page]/page.tsx")))()).rejects.toThrow("REDIRECT /catalog/roblox-music-ids/trending/page/2");
  });
  it("preserves roblox-music-ids/daily-top-500/page.tsx", async () => {
    await expect((async () => musicDailyTop500.default())()).rejects.toThrow("REDIRECT /catalog/roblox-music-ids/trending");
  });
  it("preserves roblox-music-ids/monthly/page/[page]/page.tsx", async () => {
    await expect((async () => musicMonthlyPaginated.default(props("roblox-music-ids/monthly/page/[page]/page.tsx")))()).rejects.toThrow("REDIRECT /catalog/roblox-music-ids/charts/page/2?range=monthly");
  });
  it("preserves roblox-music-ids/monthly/page.tsx", async () => {
    await expect((async () => musicMonthly.default())()).rejects.toThrow("REDIRECT /catalog/roblox-music-ids/charts?range=monthly");
  });
  it("preserves roblox-music-ids/weekly/page/[page]/page.tsx", async () => {
    await expect((async () => musicWeeklyPaginated.default(props("roblox-music-ids/weekly/page/[page]/page.tsx")))()).rejects.toThrow("REDIRECT /catalog/roblox-music-ids/charts/page/2?range=weekly");
  });
  it("preserves roblox-music-ids/weekly/page.tsx", async () => {
    await expect((async () => musicWeekly.default())()).rejects.toThrow("REDIRECT /catalog/roblox-music-ids/charts?range=weekly");
  });
  it("preserves roblox-music-ids/yearly/page/[page]/page.tsx", async () => {
    await expect((async () => musicYearlyPaginated.default(props("roblox-music-ids/yearly/page/[page]/page.tsx")))()).rejects.toThrow("REDIRECT /catalog/roblox-music-ids/charts/page/2?range=yearly");
  });
  it("preserves roblox-music-ids/yearly/page.tsx", async () => {
    await expect((async () => musicYearly.default())()).rejects.toThrow("REDIRECT /catalog/roblox-music-ids/charts?range=yearly");
  });
});
