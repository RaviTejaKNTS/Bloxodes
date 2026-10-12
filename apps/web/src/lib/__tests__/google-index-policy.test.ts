import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
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
    "/codes/unlisted-game", "/codes/doors/page/2", "/articles/page/2",
    "/wiki/blox-fruits/unlisted-collection", "/future-route", "/unknown.html",
    "/account", "/login", "/privacy-policy"
  ])("defaults to Google noindex for %s", (path) => {
    expect(isGoogleIndexable(path)).toBe(false);
    expect(googleIndexHeader(path)).toBe(GOOGLE_NOINDEX_HEADER);
  });

  it("normalizes trailing slashes without allowing query variants", () => {
    expect(isGoogleIndexable("")).toBe(false);
    expect(isGoogleIndexable("catalog")).toBe(false);
    expect(isGoogleIndexable("/catalog/roblox-music-ids///")).toBe(true);
    expect(isGoogleIndexable("/catalog/roblox-music-ids#songs")).toBe(true);
    expect(isGoogleIndexable("/catalog/roblox-music-ids/?page=2")).toBe(false);
    expect(isGoogleIndexable("/stats/games?genre=RPG&subgenre=Action")).toBe(false);
    expect(googleIndexHeader("/?utm_source=google")).toBe(GOOGLE_NOINDEX_HEADER);
  });

  it("allows author profiles through the only prefix exception", () => {
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
    expect(proxy(new NextRequest("https://bloxodes.com/codes/doors")).headers.get("x-robots-tag")).toBeNull();
    expect(proxy(new NextRequest("https://bloxodes.com/codes/doors?page=2")).headers.get("x-robots-tag")).toBe(GOOGLE_NOINDEX_HEADER);
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
