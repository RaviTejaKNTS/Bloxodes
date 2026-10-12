type PublicPath = `/${string}`;

export const GOOGLE_INDEXABLE_PATHS = [
  "/",
  "/about",
  "/contact",
  "/editorial-guidelines",
  "/how-we-gather-and-verify-codes",
  "/authors",
  "/catalog",
  "/catalog/roblox-music-ids",
  "/catalog/roblox-music-ids/trending",
  "/catalog/roblox-music-ids/charts",
  "/catalog/roblox-music-ids/games",
  "/catalog/roblox-decal-ids",
  "/catalog/roblox-decal-ids/categories",
  "/catalog/roblox-decal-ids/curated",
  "/catalog/roblox-decal-ids/games",
  "/catalog/roblox-mesh-ids",
  "/catalog/roblox-items-and-bundles",
  "/catalog/roblox-items-and-bundles/roblox-clothing",
  "/catalog/roblox-items-and-bundles/roblox-clothing/classic-shirts",
  "/catalog/roblox-items-and-bundles/roblox-accessories",
  "/catalog/roblox-items-and-bundles/roblox-emotes",
  "/catalog/free-roblox-items",
  "/catalog/roblox-color-codes",
  "/catalog/roblox-font-ids",
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
  "/wiki/blox-fruits",
  "/wiki/blox-fruits/fruits",
  "/wiki/blox-fruits/swords",
  "/wiki/murder-mystery-2/knives",
  "/wiki/murder-mystery-2/guns",
  "/wiki/rivals/skins",
  "/wiki/rivals/weapons",
  "/wiki/ride-a-pet/eggs",
  "/wiki/steal-an-egg/pets",
  "/wiki/demonology/ghosts",
  "/wiki/jujutsu-shenanigans/emotes",
  "/wiki/fisch/enchantments",
  "/wiki/1-speed-keyboard-escape",
  "/articles",
  "/articles/roblox-account-status",
  "/articles/how-to-fix-the-roblox-captcha-loop",
  "/articles/how-to-fix-roblox-age-verification-not-working",
  "/articles/create-and-publish-roblox-game",
  "/articles/roblox-classic-theme-guide",
  "/articles/legacy-piece-tier-list",
  "/articles/tower-defense-simulator-best-towers-tier-list",
  "/codes",
  "/codes/restaurant-tycoon-3",
  "/codes/driving-empire",
  "/codes/gym-star-simulator",
  "/codes/brookhaven",
  "/codes/it-girl",
  "/codes/luck-incremental",
  "/codes/southwest-florida",
  "/codes/multiverse-tower-defense",
  "/codes/blox-fruits",
  "/codes/doors"
] as const satisfies readonly PublicPath[];

const indexablePaths: ReadonlySet<string> = new Set(GOOGLE_INDEXABLE_PATHS);
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
  // Only profile pages use the prefix exception. Nested routes still default to noindex.
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
