export type SeoRouteFamily =
  | "main"
  | "codes"
  | "articles"
  | "authors"
  | "catalog"
  | "tools"
  | "wiki"
  | "events"
  | "checklists"
  | "quizzes"
  | "puzzles"
  | "stats";

export type SeoRouteContract = {
  family: SeoRouteFamily;
  sitemapPath: `/sitemaps/${string}.xml`;
  indexPaths: readonly string[];
  matches: (pathname: string) => boolean;
  sampleSize: number;
  requireJsonLd: boolean;
};

const prefix = (value: string) => (pathname: string) => pathname === value || pathname.startsWith(`${value}/`);

export const SEO_ROUTE_CONTRACTS: readonly SeoRouteContract[] = [
  {
    family: "main",
    sitemapPath: "/sitemaps/main.xml",
    indexPaths: ["/", "/about", "/contact", "/privacy-policy", "/terms-of-service"],
    matches: (pathname) =>
      pathname === "/" ||
      [
        "/about",
        "/contact",
        "/privacy-policy",
        "/terms-of-service",
        "/editorial-guidelines",
        "/disclaimer",
        "/how-we-gather-and-verify-codes"
      ].includes(pathname),
    sampleSize: 5,
    requireJsonLd: true
  },
  {
    family: "codes",
    sitemapPath: "/sitemaps/codes.xml",
    indexPaths: ["/codes"],
    matches: prefix("/codes"),
    sampleSize: 3,
    requireJsonLd: true
  },
  {
    family: "articles",
    sitemapPath: "/sitemaps/articles.xml",
    indexPaths: ["/articles"],
    matches: prefix("/articles"),
    sampleSize: 3,
    requireJsonLd: true
  },
  {
    family: "authors",
    sitemapPath: "/sitemaps/authors.xml",
    indexPaths: ["/authors"],
    matches: prefix("/authors"),
    sampleSize: 2,
    requireJsonLd: true
  },
  {
    family: "catalog",
    sitemapPath: "/sitemaps/catalog.xml",
    indexPaths: [
      "/catalog",
      "/catalog/roblox-music-ids",
      "/catalog/roblox-decal-ids",
      "/catalog/free-roblox-items",
      "/catalog/roblox-color-codes"
    ],
    matches: prefix("/catalog"),
    sampleSize: 5,
    requireJsonLd: true
  },
  {
    family: "tools",
    sitemapPath: "/sitemaps/tools.xml",
    indexPaths: ["/tools"],
    matches: prefix("/tools"),
    sampleSize: 3,
    requireJsonLd: true
  },
  {
    family: "wiki",
    sitemapPath: "/sitemaps/wiki.xml",
    indexPaths: ["/wiki"],
    matches: prefix("/wiki"),
    sampleSize: 3,
    requireJsonLd: true
  },
  {
    family: "events",
    sitemapPath: "/sitemaps/events.xml",
    indexPaths: ["/events"],
    matches: prefix("/events"),
    sampleSize: 2,
    requireJsonLd: true
  },
  {
    family: "checklists",
    sitemapPath: "/sitemaps/checklists.xml",
    indexPaths: ["/checklists"],
    matches: prefix("/checklists"),
    sampleSize: 2,
    requireJsonLd: true
  },
  {
    family: "quizzes",
    sitemapPath: "/sitemaps/quizzes.xml",
    indexPaths: ["/quizzes"],
    matches: prefix("/quizzes"),
    sampleSize: 2,
    requireJsonLd: true
  },
  {
    family: "puzzles",
    sitemapPath: "/sitemaps/puzzles.xml",
    indexPaths: ["/puzzles"],
    matches: prefix("/puzzles"),
    sampleSize: 2,
    requireJsonLd: true
  },
  {
    family: "stats",
    sitemapPath: "/sitemaps/stats.xml",
    indexPaths: ["/stats", "/stats/games", "/stats/creators", "/stats/items", "/stats/roblox-platform"],
    matches: prefix("/stats"),
    sampleSize: 4,
    requireJsonLd: true
  }
] as const;

export const CRITICAL_SEO_PATHS = Array.from(
  new Set(SEO_ROUTE_CONTRACTS.flatMap((contract) => contract.indexPaths))
);

export const PRIVATE_ROUTE_PREFIXES = ["/api", "/admin", "/auth", "/account", "/login"] as const;

export function findSeoRouteContract(pathname: string): SeoRouteContract | null {
  return SEO_ROUTE_CONTRACTS.find((contract) => contract.matches(pathname)) ?? null;
}

export function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_ROUTE_PREFIXES.some((routePrefix) =>
    pathname === routePrefix || pathname.startsWith(`${routePrefix}/`)
  );
}

export function expectedCanonicalPath(pathname: string): string {
  if (pathname.length <= 1) return "/";
  return pathname.replace(/\/+$/, "");
}
