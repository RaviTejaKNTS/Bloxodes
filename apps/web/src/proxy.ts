import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { registryRequestRedirect } from "@/lib/site-route-resolver";
import { readRedirectSnapshot, readGameIndexPaths } from "@/lib/site-route-snapshot";
import type { NextFetchEvent } from "next/server";
import { CACHE_TAG_HEADER, cacheTagsForPath, serializeCacheTags } from "@/lib/public-cache-tags";
import { CONSENT_HEADER, resolveRequiresConsent, serializeConsentRequirement } from "@/lib/privacy/consent";
import { REQUEST_PATHNAME_HEADER } from "@/lib/request-headers";
import { SEARCH_INDEXING_ENABLED } from "@/lib/site-config";
import { buildSecurityHeaders } from "@/lib/security/csp";
import { minecraftLegacyRedirect } from "@/lib/minecraft-paths";
import { googleIndexHeader, isGooglePolicyHtmlPath } from "@/lib/seo/google-index-policy";

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
  if(process.env.GITHUB_ACTIONS==='true' && process.env.BLOXODES_MANAGED_QA==='true' && normalized==='bloxodes.test') return true;
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]" || isDevelopmentTailscaleHostname(normalized);
}

function isDevelopmentTailscaleHostname(hostname: string) {
  if (process.env.NODE_ENV === "production") return false;
  if (hostname.endsWith(".ts.net")) return true;
  const octets = hostname.split(".").map(Number);
  return octets.length === 4 && octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);
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

function registryRedirectResponse(registry: NonNullable<ReturnType<typeof registryRequestRedirect>>, url: NextRequest['nextUrl'], hostname: string) {
  const target = new URL(registry.target, url);
  if (registry.query) {
    if (registry.origin === 'next.config') {
      // Next config redirects group duplicate keys and serialize with Node's
      // querystring encoding (spaces are %20, not URLSearchParams' +).
      const incoming = new URLSearchParams(registry.query);
      const encode = (value: string) => encodeURIComponent(value);
      const pairs: string[] = [];
      for (const key of new Set(incoming.keys())) {
        if (!target.searchParams.has(key)) for (const value of incoming.getAll(key)) pairs.push(`${encode(key)}=${encode(value)}`);
      }
      target.search = [target.search.slice(1), ...pairs].filter(Boolean).join('&');
    } else if (!target.search) target.search = registry.query;
  }
  // Next 16's middleware adapter requires an absolute Location.
  const response = redirectWithStatus(target, registry.code);
  return applySecurityHeaders(response, target.pathname, hostname);
}

export async function proxy(req: NextRequest, event?: NextFetchEvent) {
  const requiresConsent = resolveRequiresConsent(req.headers, (req as any).geo?.country);
  const url = req.nextUrl;
  const hostname = getRequestHostname(req);
  const hostRedirectNeeded = shouldRedirectToCanonicalHost(hostname);
  const snapshot = await readRedirectSnapshot(event ? work => event.waitUntil(work) : undefined);
  // Only root aliases participate in the old combined host/path correction.
  let registry = (/^\/[^/]+$/.test(url.pathname.replace(/\/+$/, '')) || url.pathname.toLowerCase().startsWith('/catalog/'))
    ? registryRequestRedirect(snapshot, url.pathname, url.search) : null;
  // These rules previously ran in Next's config redirect stage, before host correction.
  if (registry?.origin === 'next.config') return registryRedirectResponse(registry, url, hostname);
  // Root aliases previously combined the path and host correction in one 301.
  const legacyPath = registry?.rootAlias ? registry.target : null;
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
    return applySecurityHeaders(redirectWithStatus(redirectUrl, hostRedirectNeeded ? 301 : registry!.code), redirectUrl.pathname, hostname);
  }

  const editionPath = minecraftLegacyRedirect(url.pathname, url.search);
  if (editionPath) {
    return applySecurityHeaders(redirectWithStatus(new URL(editionPath, url), 308), url.pathname, hostname);
  }

  registry ??= registryRequestRedirect(snapshot, url.pathname, url.search);
  if (registry) {
    return registryRedirectResponse(registry, url, hostname);
  }

  // Cold HTML game pages briefly wait for publication evidence. Redirects never do.
  const waitForPolicy = isGooglePolicyHtmlPath(url.pathname)
    && /^\/(?:games|wiki|maps|checklists|quizzes|tools|codes|catalog)\//.test(url.pathname);
  const gameIndexPaths = await readGameIndexPaths(event ? work => event.waitUntil(work) : undefined, waitForPolicy);

  // Pass a header downstream for routes that need request-time consent context.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CONSENT_HEADER, serializeConsentRequirement(requiresConsent));
  requestHeaders.set(REQUEST_PATHNAME_HEADER, url.pathname);

  const response = applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), url.pathname, hostname);
  // An existing all-engine robots header (private routes, indexing disabled) already covers Google.
  const googleRobots = googleIndexHeader(`${url.pathname}${url.search}`, gameIndexPaths);
  if (googleRobots && !response.headers.has("X-Robots-Tag")) {
    response.headers.set("X-Robots-Tag", googleRobots);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon-16x16\\.png|favicon-32x32\\.png|favicon-48x48\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png|apple-touch-icon\\.png|site\\.webmanifest|og-image\\.png|Bloxodes-dark\\.png|Bloxodes-light\\.png|Bloxodes\\.png).*)"
  ]
};
