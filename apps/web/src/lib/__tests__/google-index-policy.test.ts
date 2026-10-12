import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  GOOGLE_INDEXABLE_GAMES,
  GOOGLE_INDEXABLE_PATHS,
  GOOGLE_NOINDEX_HEADER,
  googleIndexHeader,
  isGoogleIndexable,
  isGooglePolicyHtmlPath
} from "@/lib/seo/google-index-policy";
import { proxy } from "@/proxy";

vi.mock("@/lib/site-config", () => ({ SEARCH_INDEXING_ENABLED: true }));

describe("Google index policy", () => {
  it.each(GOOGLE_INDEXABLE_PATHS)("allows the exact path %s", (path) => {
    expect(isGoogleIndexable(path)).toBe(true);
    expect(googleIndexHeader(path)).toBeNull();
  });

  it.each([
    "/codes/unlisted-game", "/codes/doors/page/2", "/codes/rivals/page/2",
    "/wiki/grow-a-garden", "/wiki/grow-a-garden/pets", "/codes/grow-a-garden",
    "/quizzes/grow-a-garden", "/checklists/grow-a-garden", "/future-route", "/unknown.html",
    "/account", "/login", "/privacy-policy"
  ])("defaults to Google noindex for %s", (path) => {
    expect(isGoogleIndexable(path)).toBe(false);
    expect(googleIndexHeader(path)).toBe(GOOGLE_NOINDEX_HEADER);
  });

  it.each([
    "/catalog", "/catalog/new-catalog", "/catalog/roblox-decal-ids/page/2",
    "/catalog/new-catalog/category/item", "/articles", "/articles/new-article",
    "/articles/page/2", "/articles/new-article/deep/path"
  ])("allows catalog and article prefixes for %s", (path) => {
    expect(isGoogleIndexable(path)).toBe(true);
    expect(googleIndexHeader(path)).toBeNull();
  });

  it.each(GOOGLE_INDEXABLE_GAMES)("allows the whole wiki and listed pages for $game", (game) => {
    const paths = [
      `/wiki/${game.wikiSlug}`,
      `/wiki/${game.wikiSlug}/future-collection`,
      `/wiki/${game.wikiSlug}/future-collection/page/2`,
      ...game.codesSlugs.map((slug) => `/codes/${slug}`),
      ...game.quizSlugs.map((slug) => `/quizzes/${slug}`),
      ...game.checklistSlugs.map((slug) => `/checklists/${slug}`)
    ];
    for (const path of paths) {
      expect(isGoogleIndexable(path)).toBe(true);
      expect(googleIndexHeader(path)).toBeNull();
      expect(isGoogleIndexable(`${path}?page=2`)).toBe(false);
    }
    expect(isGoogleIndexable(`/wiki/${game.wikiSlug}-2`)).toBe(false);
    expect(isGoogleIndexable(`/wiki/${game.wikiSlug}-2/collection`)).toBe(false);
    expect(isGoogleIndexable(`/stats/games/${game.game}`)).toBe(false);
  });

  it.each(["/codes/rivals", "/quizzes/rivals", "/checklists/rivals"])("allows the game page %s", (path) => {
    expect(isGoogleIndexable(path)).toBe(true);
    expect(googleIndexHeader(path)).toBeNull();
  });

  it("uses Brookhaven's published slugs for each page type", () => {
    for (const path of [
      "/wiki/brookhaven-rp", "/wiki/brookhaven-rp/houses",
      "/codes/brookhaven", "/codes/brookhaven-rp", "/quizzes/brookhaven-rp"
    ]) {
      expect(isGoogleIndexable(path)).toBe(true);
    }
    expect(isGoogleIndexable("/wiki/brookhaven")).toBe(false);
    expect(isGoogleIndexable("/quizzes/brookhaven")).toBe(false);
    expect(isGoogleIndexable("/checklists/brookhaven-rp")).toBe(false);
  });

  it.each([
    "/catalogue", "/catalogue/item", "/catalog-other/item", "/articles-other/post",
    "/wiki/rivals-2", "/wiki/rivals-2/weapons", "/wiki/rival/skins"
  ])("keeps prefix matching segment-safe for %s", (path) => {
    expect(isGoogleIndexable(path)).toBe(false);
    expect(googleIndexHeader(path)).toBe(GOOGLE_NOINDEX_HEADER);
  });

  it.each(["/stats/games/blox-fruits", "/stats/games/blox-fruits-994732206", "/stats/games/unlisted-game"])("denies per-game stats at %s", (path) => {
    expect(isGoogleIndexable(path)).toBe(false);
    expect(googleIndexHeader(path)).toBe(GOOGLE_NOINDEX_HEADER);
    expect(GOOGLE_INDEXABLE_PATHS.some((entry) => entry.startsWith("/stats/games/"))).toBe(false);
  });

  it("normalizes trailing slashes without allowing query variants", () => {
    expect(isGoogleIndexable("")).toBe(false);
    expect(isGoogleIndexable("catalog")).toBe(false);
    expect(isGoogleIndexable("/catalog/roblox-music-ids///")).toBe(true);
    expect(isGoogleIndexable("/catalog/roblox-music-ids#songs")).toBe(true);
    expect(isGoogleIndexable("/catalog/roblox-music-ids/?page=2")).toBe(false);
    expect(isGoogleIndexable("/catalog/new-catalog?sort=name")).toBe(false);
    expect(isGoogleIndexable("/articles/new-article?ref=home")).toBe(false);
    expect(isGoogleIndexable("/stats/games?genre=RPG&subgenre=Action")).toBe(false);
    expect(googleIndexHeader("/?utm_source=google")).toBe(GOOGLE_NOINDEX_HEADER);
  });

  it("allows author profiles without nested routes or queries", () => {
    expect(isGoogleIndexable("/authors/ravi")).toBe(true);
    expect(isGoogleIndexable("/authors/ravi/")).toBe(true);
    expect(isGoogleIndexable("/authors-other/ravi")).toBe(false);
    expect(isGoogleIndexable("/authors/ravi/page/2")).toBe(false);
    expect(isGoogleIndexable("/authors/ravi?view=bio")).toBe(false);
  });

  it.each([
    "/api", "/api/health", "/_next/static/app.js", "/_next/image?url=cover",
    "/sitemap.xml", "/sitemaps/stats.xml", "/feed.xml", "/feed.rss",
    "/robots.txt", "/ads.txt", "/images/cover", "/media/cover",
    "/articles/unlisted/cover.webp", "/favicon.ico", "/site.webmanifest", "/fonts/site.woff2"
  ])("leaves the non-HTML route %s alone", (path) => {
    expect(isGooglePolicyHtmlPath(path)).toBe(false);
    expect(googleIndexHeader(path)).toBeNull();
    expect(proxy(new NextRequest(`https://bloxodes.com${path}`)).headers.get("x-robots-tag")).toBeNull();
  });

  it("returns the same scoped header for Google, Bing and visitors", () => {
    for (const userAgent of ["Googlebot", "bingbot", "Mozilla/5.0"]) {
      const response = proxy(new NextRequest("https://bloxodes.com/future-route", {
        headers: { "user-agent": userAgent }
      }));
      expect(response.headers.get("x-robots-tag")).toBe("googlebot: noindex, follow");
    }
    for (const path of [
      "/codes/doors", "/articles/page/2", "/catalog/roblox-decal-ids/page/2",
      "/wiki/rivals/weapons/page/2", "/quizzes/rivals", "/checklists/rivals"
    ]) {
      expect(proxy(new NextRequest(`https://bloxodes.com${path}`)).headers.get("x-robots-tag")).toBeNull();
      expect(proxy(new NextRequest(`https://bloxodes.com${path}?page=2`)).headers.get("x-robots-tag")).toBe(GOOGLE_NOINDEX_HEADER);
    }
  });

  it("leaves existing all-engine noindex metadata in place even for allowlisted pages", () => {
    const august = readFileSync(new URL("../../app/(site)/stats/reports/roblox-august-2026/page.tsx", import.meta.url), "utf8");
    expect(isGoogleIndexable("/stats/reports/roblox-august-2026")).toBe(true);
    expect(august).toMatch(/robots:\s*\{\s*index: false,\s*follow: false,/);
    expect(august).toMatch(/googleBot:\s*\{\s*index: false,\s*follow: false/);

    for (const path of ["catalog/roblox-decal-ids/categories", "catalog/roblox-decal-ids/games", "catalog/roblox-music-ids/games"]) {
      const source = readFileSync(new URL(`../../app/(site)/${path}/page.tsx`, import.meta.url), "utf8");
      expect(isGoogleIndexable(`/${path}`)).toBe(true);
      expect(source).toContain("robots: { index: false, follow: true }");
    }
    const root = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
    expect(root).toMatch(/robots:\s*\{\s*index: SEARCH_INDEXING_ENABLED,\s*follow: SEARCH_INDEXING_ENABLED,/);
    expect(root).not.toMatch(/googleBot:\s*\{\s*index:/);
    const september = readFileSync(new URL("../../app/(site)/stats/reports/roblox-september-2026/page.tsx", import.meta.url), "utf8");
    expect(september).not.toContain("googleBot:");
    for (const page of ["(secure)/account", "(secure)/login", "(site)/catalog/roblox-decal-ids/page/[page]", "(site)/catalog/free-roblox-items/[category]"]) {
      const source = readFileSync(new URL(`../../app/${page}/page.tsx`, import.meta.url), "utf8");
      expect(source).toMatch(/robots:\s*\{\s*index: false,/);
      expect(source).toMatch(/googleBot:\s*\{\s*index: false,/);
    }
  });
});
