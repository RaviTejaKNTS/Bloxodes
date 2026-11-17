import cspDirectives from "@/config/csp-directives.json";

export type CspMode = "off" | "report-only" | "enforce";

type SecurityHeader = {
  key: string;
  value: string;
};

type SecurityHeaderOptions = {
  enableHsts?: boolean;
  useDevelopmentCsp?: boolean;
};

const isProduction = process.env.NODE_ENV === "production";
const securePathPrefixes = ["/api", "/auth", "/login", "/account", "/admin"] as const;
const noIndexPathPrefixes = ["/auth", "/login", "/account", "/admin"] as const;
const hstsHeader = "max-age=31536000; includeSubDomains";
const permissionsPolicyHeader = [
  "camera=()",
  "geolocation=()",
  "microphone=()",
  "payment=()",
  "usb=()"
].join(", ");

export function resolveCspMode(value: string | undefined, productionMode = isProduction): CspMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "off" || normalized === "report-only" || normalized === "enforce") {
    return normalized;
  }

  return productionMode ? "enforce" : "off";
}

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export const cspMode = resolveCspMode(process.env.CSP_MODE, isProduction);
export const cspHeaderKey =
  cspMode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

// The read fixture is HTTP on runner loopback. Production builds do not set
// this explicit CI flag and retain their existing HTTPS-only policy.
const isolatedCiData = process.env.GITHUB_ACTIONS === "true" && process.env.BLOXODES_CI_DATA === "1";

export const publicCsp = (
  isProduction ? cspDirectives.publicProductionDirectives : cspDirectives.developmentDirectives
).map(directive => isolatedCiData && directive.startsWith("connect-src ")
  ? `${directive} http://127.0.0.1:54321` : directive).join("; ");

export const secureCsp = (
  isProduction ? cspDirectives.secureProductionDirectives : cspDirectives.developmentDirectives
).join("; ");

export const developmentCsp = cspDirectives.developmentDirectives.join("; ");

export function isSecurePath(pathname: string) {
  return securePathPrefixes.some((prefix) => matchesPathPrefix(pathname, prefix));
}

export function shouldNoIndexPath(pathname: string) {
  return noIndexPathPrefixes.some((prefix) => matchesPathPrefix(pathname, prefix));
}

export function getCspForPath(pathname: string, options: Pick<SecurityHeaderOptions, "useDevelopmentCsp"> = {}) {
  if (options.useDevelopmentCsp) return developmentCsp;
  return isSecurePath(pathname) ? secureCsp : publicCsp;
}

export function buildSecurityHeaders(
  pathname: string,
  mode: CspMode = cspMode,
  options: SecurityHeaderOptions = {}
): SecurityHeader[] {
  const securePath = isSecurePath(pathname);
  const shouldSendHsts = options.enableHsts ?? isProduction;
  const headers: SecurityHeader[] = [
    { key: "Permissions-Policy", value: permissionsPolicyHeader },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: securePath ? "DENY" : "SAMEORIGIN" }
  ];

  if (shouldSendHsts) {
    headers.unshift({ key: "Strict-Transport-Security", value: hstsHeader });
  }

  if (shouldNoIndexPath(pathname)) {
    headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  }

  if (mode !== "off") {
    headers.unshift({
      key: mode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
      value: getCspForPath(pathname, options)
    });
  }

  return headers;
}
