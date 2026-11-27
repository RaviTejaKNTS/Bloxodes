import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Cloudflare rule "Bloxodes strip query strings from cacheable HTML" removes the
// query string from public HTML requests before the cache and the origin. A page
// that reads searchParams on the server must keep its query, so its path has to
// be listed in that rule's exceptions. Keep these lists equal to the live rule
// (see bloxodes-docs/infrastructure/cloudflare.md#query-strings).
const QUERY_KEPT_EXACT = ["/wiki", "/wiki/"];
const QUERY_KEPT_PREFIXES = [
  "/api",
  "/auth",
  "/account",
  "/login",
  "/admin",
  "/dashboard",
  "/_next/",
  "/cdn-cgi/",
  "/catalog/roblox-accessories",
  "/catalog/roblox-animations",
  "/catalog/roblox-avatar-items",
  "/catalog/roblox-body-parts",
  "/catalog/roblox-clothing",
  "/catalog/roblox-emotes",
  "/catalog/roblox-items-and-bundles",
  "/catalog/roblox-makeup",
  "/catalog/roblox-dictionary",
  "/catalog/roblox-music-ids/charts",
  "/stats/games",
  "/stats/items",
  "/stats/creators",
  "/wiki/page/"
];

const APP_DIR = fileURLToPath(new URL("../../app/", import.meta.url));

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : pageFiles(path);
    return name === "page.tsx" || name === "page.ts" ? [path] : [];
  });
}

type PageRoute = {
  /** The URL up to the first dynamic segment; ends in "/" when a dynamic segment follows. */
  route: string;
  dynamic: boolean;
  /** An optional catch-all as the first dynamic segment also serves the bare route. */
  optionalCatchAll: boolean;
};

/** The static part of a page's URL: route groups dropped, cut at the first dynamic segment. */
function pageRoute(file: string): PageRoute {
  const segments = relative(APP_DIR, file).split(sep).slice(0, -1).filter((segment) => !/^\(.*\)$/.test(segment));
  const first = segments.findIndex((segment) => segment.startsWith("["));
  if (first === -1) return { route: "/" + segments.join("/"), dynamic: false, optionalCatchAll: false };
  return {
    route: ("/" + segments.slice(0, first).join("/")).replace(/\/?$/, "/"),
    dynamic: true,
    optionalCatchAll: segments[first].startsWith("[[")
  };
}

function exactKeepsQuery(path: string): boolean {
  return QUERY_KEPT_EXACT.includes(path) || QUERY_KEPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** A dynamic route keeps its query only when a prefix covers every URL under it. */
function keepsQuery({ route, dynamic, optionalCatchAll }: PageRoute): boolean {
  if (!dynamic) return exactKeepsQuery(route);
  const descendants = QUERY_KEPT_PREFIXES.some((prefix) => route.startsWith(prefix));
  return optionalCatchAll ? descendants && exactKeepsQuery(route.replace(/\/$/, "") || "/") : descendants;
}

describe("Cloudflare query-string strip rule", () => {
  it("keeps the query for every page that reads searchParams on the server", () => {
    const readers = pageFiles(APP_DIR).filter((file) => readFileSync(file, "utf8").includes("searchParams"));
    expect(readers.length).toBeGreaterThan(0);
    const missing = readers
      .filter((file) => !keepsQuery(pageRoute(file)))
      .map((file) => relative(APP_DIR, file));
    expect(
      missing,
      "These pages read searchParams but Cloudflare strips their query string. Add them to the rule's exceptions and to this list."
    ).toEqual([]);
  });

  it("maps page files to their static route", () => {
    const route = (...parts: string[]) => pageRoute(join(APP_DIR, ...parts, "page.tsx"));
    expect(route("(site)", "wiki")).toEqual({ route: "/wiki", dynamic: false, optionalCatchAll: false });
    expect(route("(site)", "wiki", "page", "[page]")).toEqual({ route: "/wiki/page/", dynamic: true, optionalCatchAll: false });
    expect(route("(site)", "catalog", "roblox-clothing", "[[...segments]]")).toEqual({
      route: "/catalog/roblox-clothing/",
      dynamic: true,
      optionalCatchAll: true
    });
  });

  it("covers dynamic routes only through prefixes", () => {
    const route = (...parts: string[]) => pageRoute(join(APP_DIR, ...parts, "page.tsx"));
    expect(keepsQuery(route("(site)", "wiki"))).toBe(true);
    expect(keepsQuery(route("(site)", "wiki", "page", "[page]"))).toBe(true);
    expect(keepsQuery(route("(site)", "catalog", "roblox-clothing", "[[...segments]]"))).toBe(true);
    expect(keepsQuery(route("(site)", "wiki", "[slug]"))).toBe(false);
    expect(keepsQuery(route("(site)", "wiki", "[slug]", "[collection]"))).toBe(false);
    expect(keepsQuery(route("(site)", "catalog", "free-roblox-items", "[[...segments]]"))).toBe(false);
  });
});
