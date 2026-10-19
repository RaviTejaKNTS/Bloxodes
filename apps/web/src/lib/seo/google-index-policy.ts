type PublicPath = `/${string}`;

type GoogleIndexableGame = {
  game: string;
  wikiSlug: string;
  codesSlugs: readonly string[];
  quizSlugs: readonly string[];
  checklistSlugs: readonly string[];
};

// Keep each game's page-type slugs together, including published slug variants.
export const GOOGLE_INDEXABLE_GAMES = [
  {
    game: "restaurant-tycoon-3",
    wikiSlug: "restaurant-tycoon-3",
    codesSlugs: ["restaurant-tycoon-3"],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "blox-fruits",
    wikiSlug: "blox-fruits",
    codesSlugs: ["blox-fruits"],
    quizSlugs: [],
    checklistSlugs: ["blox-fruits"]
  },
  {
    game: "driving-empire",
    wikiSlug: "driving-empire",
    codesSlugs: ["driving-empire"],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "rivals",
    wikiSlug: "rivals",
    codesSlugs: ["rivals"],
    quizSlugs: ["rivals"],
    checklistSlugs: ["rivals"]
  },
  {
    game: "murder-mystery-2",
    wikiSlug: "murder-mystery-2",
    codesSlugs: ["murder-mystery-2"],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "fisch",
    wikiSlug: "fisch",
    codesSlugs: ["fisch"],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "lineage-piece",
    wikiSlug: "lineage-piece",
    codesSlugs: [],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "1-speed-keyboard-escape",
    wikiSlug: "1-speed-keyboard-escape",
    codesSlugs: ["1-speed-keyboard-escape"],
    quizSlugs: ["1-speed-keyboard-escape"],
    checklistSlugs: ["1-speed-keyboard-escape"]
  },
  {
    game: "tower-of-hell",
    wikiSlug: "tower-of-hell",
    codesSlugs: [],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "gakuran",
    wikiSlug: "gakuran",
    codesSlugs: ["gakuran"],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "animal-hospital",
    wikiSlug: "animal-hospital",
    codesSlugs: [],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "adopt-me",
    wikiSlug: "adopt-me",
    codesSlugs: ["adopt-me"],
    quizSlugs: [],
    checklistSlugs: ["adopt-me"]
  },
  {
    game: "jujutsu-shenanigans",
    wikiSlug: "jujutsu-shenanigans",
    codesSlugs: ["jujutsu-shenanigans"],
    quizSlugs: ["jujutsu-shenanigans"],
    checklistSlugs: ["jujutsu-shenanigans"]
  },
  {
    game: "gym-star-simulator",
    wikiSlug: "gym-star-simulator",
    codesSlugs: ["gym-star-simulator"],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "ride-a-pet",
    wikiSlug: "ride-a-pet",
    codesSlugs: ["ride-a-pet"],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "steal-an-egg",
    wikiSlug: "steal-an-egg",
    codesSlugs: [],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "forsaken",
    wikiSlug: "forsaken",
    codesSlugs: ["forsaken"],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "creatures-of-sonaria",
    wikiSlug: "creatures-of-sonaria",
    codesSlugs: ["creatures-of-sonaria"],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "brookhaven",
    wikiSlug: "brookhaven-rp",
    codesSlugs: ["brookhaven", "brookhaven-rp"],
    quizSlugs: ["brookhaven-rp"],
    checklistSlugs: []
  },
  {
    game: "evade",
    wikiSlug: "evade",
    codesSlugs: ["evade"],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "demonology",
    wikiSlug: "demonology",
    codesSlugs: [],
    quizSlugs: [],
    checklistSlugs: []
  },
  {
    game: "cat-battles",
    wikiSlug: "cat-battles",
    codesSlugs: [],
    quizSlugs: [],
    checklistSlugs: []
  },
] as const satisfies readonly GoogleIndexableGame[];

const gamePaths: readonly PublicPath[] = GOOGLE_INDEXABLE_GAMES.flatMap((game): PublicPath[] => [
  `/wiki/${game.wikiSlug}`,
  ...game.codesSlugs.map((slug): PublicPath => `/codes/${slug}`),
  ...game.quizSlugs.map((slug): PublicPath => `/quizzes/${slug}`),
  ...game.checklistSlugs.map((slug): PublicPath => `/checklists/${slug}`)
]);

export const GOOGLE_INDEXABLE_PATHS = [
  "/",
  "/about",
  "/contact",
  "/editorial-guidelines",
  "/how-we-gather-and-verify-codes",
  "/authors",
  "/catalog",
  "/stats",
  "/stats/games",
  "/stats/items",
  "/stats/roblox-platform",
  "/stats/reports/roblox-september-2026",
  "/stats/reports/roblox-august-2026",
  "/tools",
  "/tools/roblox-profile-checker",
  "/tools/roblox-account-value-calculator",
  "/tools/robux-to-usd-calculator",
  "/tools/roblox-id-extractor",
  "/tools/roblox-username-generator",
  "/tools/roblox-devex-calculator",
  "/wiki",
  "/articles",
  "/codes",
  "/codes/it-girl",
  "/codes/luck-incremental",
  "/codes/southwest-florida",
  "/codes/multiverse-tower-defense",
  "/codes/doors",
  ...gamePaths
] as const satisfies readonly PublicPath[];

const indexablePaths: ReadonlySet<string> = new Set(GOOGLE_INDEXABLE_PATHS);
const indexablePathPrefixes: readonly PublicPath[] = [
  "/catalog",
  "/articles",
  ...GOOGLE_INDEXABLE_GAMES.map((game): PublicPath => `/wiki/${game.wikiSlug}`)
];
export const GOOGLE_AUTHOR_PROFILE_PREFIX = "/authors/";
export const GOOGLE_NOINDEX_HEADER = "googlebot: noindex, follow";

function normalizePath(pathname: string): string {
  return pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
}

export function isGoogleIndexable(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;
  // Query variants are separate URLs, not allowlist entries.
  if (pathname.includes("?")) return false;
  const path = normalizePath(pathname);
  if (indexablePaths.has(path)) return true;
  if (indexablePathPrefixes.some((prefix) => path.startsWith(`${prefix}/`))) return true;
  // Author profiles allow one slug, without nested routes.
  return path.startsWith(GOOGLE_AUTHOR_PROFILE_PREFIX)
    && Boolean(path.slice(GOOGLE_AUTHOR_PROFILE_PREFIX.length))
    && !path.slice(GOOGLE_AUTHOR_PROFILE_PREFIX.length).includes("/");
}

export function isGooglePolicyHtmlPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (/^\/(?:api|_next|sitemaps|images|media|\.well-known)(?:\/|$)/.test(path)) return false;
  // Exclude known asset and machine-readable formats. Unknown paths, including .html, stay covered.
  return !/\.(?:xml|rss|atom|txt|json|webmanifest|js|mjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|pdf|mp4|webm|mp3|wav|zip)$/i.test(path);
}

export function googleIndexHeader(pathname: string): string | null {
  return isGooglePolicyHtmlPath(pathname) && !isGoogleIndexable(pathname)
    ? GOOGLE_NOINDEX_HEADER
    : null;
}
