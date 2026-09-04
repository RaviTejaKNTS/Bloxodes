import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import legacySlugs from "@/data/slug_oldslugs.json";
import { CACHE_TAG_HEADER, cacheTagsForPath, serializeCacheTags } from "@/lib/public-cache-tags";
import { CONSENT_HEADER, resolveRequiresConsent, serializeConsentRequirement } from "@/lib/privacy/consent";
import { REQUEST_PATHNAME_HEADER } from "@/lib/request-headers";
import { SEARCH_INDEXING_ENABLED } from "@/lib/site-config";
import { buildSecurityHeaders } from "@/lib/security/csp";

const DEFAULT_CANONICAL_HOST = "bloxodes.com";

function resolveCanonicalHost() {
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) return DEFAULT_CANONICAL_HOST;

  try {
    return new URL(siteUrl).hostname.toLowerCase();
  } catch {
    return DEFAULT_CANONICAL_HOST;
  }
}

const CANONICAL_HOST = resolveCanonicalHost();

const ARTICLE_REDIRECT_SLUGS = new Set([
  "when-does-the-museum-open-in-jailbreak-roblox",
  "how-to-level-up-fast-in-jailbreak-criminal-vs-cop",
  "how-to-get-a-mansion-invite-in-jailbreak-roblox",
  "steal-a-brainrot-dealer-update-guide",
  "why-roblox-s-simple-graphics-still-beat-every-realistic-game",
  "where-to-find-criminal-base-on-roblox-jailbreak",
  "how-to-get-robux-free-and-paid",
  "best-simple-roblox-games-for-beginners",
  "how-to-get-spooky-chest-in-grow-a-garden",
  "roblox-halloween-spotlight-event-2025",
  "create-and-publish-roblox-game",
  "all-fisch-enchantments-guide"
]);

type LegacySlugEntry = {
  slug: string;
  old_slugs: string[];
};

const LEGACY_SLUG_MAP = new Map<string, string>(
  (legacySlugs as LegacySlugEntry[]).flatMap(({ slug, old_slugs }) => {
    const canonical = slug.trim().toLowerCase();
    return old_slugs
      .map((oldSlug) => oldSlug?.trim().toLowerCase())
      .filter((oldSlug): oldSlug is string => Boolean(oldSlug) && oldSlug !== canonical)
      .map((oldSlug) => [oldSlug, canonical]);
  })
);

function applySecurityHeaders(res: NextResponse, pathname: string, hostname: string) {
  for (const { key, value } of buildSecurityHeaders(pathname, undefined, {
    enableHsts: !isLocalHostname(hostname),
    useDevelopmentCsp: isLocalHostname(hostname)
  })) {
    res.headers.set(key, value);
  }

  const cacheTags = serializeCacheTags(cacheTagsForPath(pathname));
  if (cacheTags) {
    res.headers.set(CACHE_TAG_HEADER, cacheTags);
  }

  if (!SEARCH_INDEXING_ENABLED) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return res;
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]" || isDevelopmentTailscaleHostname(normalized);
}

function isDevelopmentTailscaleHostname(hostname: string) {
  if (process.env.NODE_ENV === "production") return false;
  if (hostname.endsWith(".ts.net")) return true;
  const octets = hostname.split(".").map(Number);
  return octets.length === 4 && octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);
}

function normalizeSlugSegment(value: string) {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  decoded = decoded.trim().toLowerCase();
  return decoded;
}

function resolveLegacyRedirectPath(pathname: string): string | null {
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  // Never canonicalize legacy slugs inside the `/codes/*` namespace.
  // We only support legacy root slugs here.
  if (/^\/codes(?:\/|$)/i.test(normalizedPath)) {
    return null;
  }

  const rootMatch = normalizedPath.match(/^\/([^/]+)$/);
  if (rootMatch) {
    const slug = normalizeSlugSegment(rootMatch[1]);
    if (ARTICLE_REDIRECT_SLUGS.has(slug)) {
      return `/articles/${slug}`;
    }
    const canonical = LEGACY_SLUG_MAP.get(slug);
    if (canonical) {
      return `/codes/${canonical}`;
    }
  }

  return null;
}

function getRequestHostname(req: NextRequest) {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.host;

  if (host.startsWith("[::1]")) return "[::1]";
  return host.split(":")[0].toLowerCase();
}

function redirectWithStatus(url: URL, status: 301 | 302 | 307 | 308 = 307) {
  return new NextResponse(null, {
    status,
    headers: {
      Location: url.toString()
    }
  });
}

function shouldRedirectToCanonicalHost(hostname: string) {
  if (hostname === CANONICAL_HOST) return false;
  if (isLocalHostname(hostname)) return false;
  if (hostname.endsWith(".localhost")) return false;
  return true;
}

export function proxy(req: NextRequest) {
  const requiresConsent = resolveRequiresConsent(req.headers, (req as any).geo?.country);
  const url = req.nextUrl;
  const hostname = getRequestHostname(req);
  const hostRedirectNeeded = shouldRedirectToCanonicalHost(hostname);
  const legacyPath = resolveLegacyRedirectPath(url.pathname);
  const pathRedirectNeeded = Boolean(legacyPath && legacyPath !== url.pathname);

  if (hostRedirectNeeded || pathRedirectNeeded) {
    const redirectUrl = url.clone();
    if (hostRedirectNeeded) {
      redirectUrl.hostname = CANONICAL_HOST;
      redirectUrl.port = "";
    }
    if (legacyPath) {
      redirectUrl.pathname = legacyPath;
    }
    return applySecurityHeaders(redirectWithStatus(redirectUrl, 301), redirectUrl.pathname, hostname);
  }

  // Pass a header downstream for routes that need request-time consent context.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CONSENT_HEADER, serializeConsentRequirement(requiresConsent));
  requestHeaders.set(REQUEST_PATHNAME_HEADER, url.pathname);

  return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), url.pathname, hostname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon-16x16\\.png|favicon-32x32\\.png|favicon-48x48\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png|apple-touch-icon\\.png|site\\.webmanifest|og-image\\.png|Bloxodes-dark\\.png|Bloxodes-light\\.png|Bloxodes\\.png).*)"
  ]
};
