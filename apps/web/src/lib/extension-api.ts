const EXTENSION_HEADER_PATTERN = /^Bloxodes\/\d+\.\d+\.\d+$/;
const EXTENSION_ORIGIN_PATTERN = /^chrome-extension:\/\/[a-p]{32}$/;

export function isBloxodesExtensionRequest(request: Request): boolean {
  const client = request.headers.get("x-bloxodes-extension")?.trim() ?? "";
  if (!EXTENSION_HEADER_PATTERN.test(client)) {
    return false;
  }

  const origin = request.headers.get("origin")?.trim();
  return !origin || EXTENSION_ORIGIN_PATTERN.test(origin);
}

export function extensionPrivateHeaders(request: Request, methods: string) {
  const origin = request.headers.get("origin")?.trim();
  return {
    "Access-Control-Allow-Origin": origin && EXTENSION_ORIGIN_PATTERN.test(origin) ? origin : "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Bloxodes-Extension",
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Origin"
  };
}

export function extensionPrivateFallbackHeaders(methods: string) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Bloxodes-Extension",
    "Cache-Control": "private, no-store, max-age=0"
  };
}
