import { normalizeOrigin } from "@/lib/site-config";

function firstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function normalizeHost(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.includes("://")) {
      return new URL(trimmed).host;
    }
  } catch {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

function isLocalLikeHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".localhost")
  );
}

function extractHostname(host: string | null): string | null {
  if (!host) return null;

  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isPublicHost(host: string | null): boolean {
  const hostname = extractHostname(host);
  if (!hostname) return false;
  return !isLocalLikeHostname(hostname);
}

function resolveConfiguredSiteOrigin(): string | null {
  return normalizeOrigin(process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL);
}

export function resolvePublicOrigin(headers: Headers, fallbackOrigin: string): string {
  const configuredSiteOrigin = resolveConfiguredSiteOrigin();
  const forwardedHost = normalizeHost(firstForwardedValue(headers.get("x-forwarded-host")));
  const host = normalizeHost(headers.get("host"));
  const candidateHost = forwardedHost ?? host;

  let fallbackUrl: URL | null = null;
  try {
    fallbackUrl = new URL(fallbackOrigin);
  } catch {
    fallbackUrl = null;
  }

  const forwardedProtoRaw = firstForwardedValue(headers.get("x-forwarded-proto"));
  const forwardedProto = forwardedProtoRaw
    ? `${forwardedProtoRaw.replace(/:$/, "").toLowerCase()}:`
    : null;
  const protocol = forwardedProto ?? fallbackUrl?.protocol ?? "https:";

  if (candidateHost && isPublicHost(candidateHost)) {
    return `${protocol}//${candidateHost}`;
  }

  if (configuredSiteOrigin) {
    return configuredSiteOrigin;
  }

  if (fallbackUrl && isPublicHost(fallbackUrl.host)) {
    return fallbackUrl.origin;
  }

  if (candidateHost) {
    return `${protocol}//${candidateHost}`;
  }

  return fallbackOrigin;
}
