interface WikiMediaObjectBody {
  body: ReadableStream | null;
  etag: string;
  size: number;
  uploaded?: Date;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  customMetadata?: Record<string, string>;
}

interface WikiMediaBucket {
  get(key: string): Promise<WikiMediaObjectBody | null>;
  head(key: string): Promise<WikiMediaObjectBody | null>;
}

interface WikiMediaEnv {
  WIKI_MEDIA: WikiMediaBucket;
}

interface WikiMediaExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const ROUTE_PREFIX = "/wiki/";
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

export function parseWikiMediaKey(pathname: string): string | null {
  if (!pathname.startsWith(ROUTE_PREFIX)) return null;
  const encodedKey = pathname.slice(ROUTE_PREFIX.length);
  if (!encodedKey || encodedKey.includes("\\") || encodedKey.includes("\0")) return null;

  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    return null;
  }

  const segments = key.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return key;
}

function objectHeaders(object: WikiMediaObjectBody) {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": object.httpMetadata?.cacheControl || IMMUTABLE_CACHE,
    "Content-Length": String(object.size),
    "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
    ETag: object.etag,
    "X-Content-Type-Options": "nosniff"
  });
  if (object.uploaded) headers.set("Last-Modified", object.uploaded.toUTCString());
  return headers;
}

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

export async function handleWikiMediaRequest(
  request: Request,
  env: WikiMediaEnv,
  context: WikiMediaExecutionContext
) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "If-None-Match, Range",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD, OPTIONS" } });
  }

  const url = new URL(request.url);
  const key = parseWikiMediaKey(url.pathname);
  if (!key) return notFound();

  const cache = caches.default;
  url.search = "";
  url.hash = "";
  const cacheKey = new Request(url.toString(), { method: "GET" });
  if (request.method === "GET") {
    const cached = await cache.match(cacheKey);
    if (cached) {
      if (request.headers.get("If-None-Match") === cached.headers.get("ETag")) {
        return new Response(null, { status: 304, headers: cached.headers });
      }
      return cached;
    }
  }

  const object = request.method === "HEAD" ? await env.WIKI_MEDIA.head(key) : await env.WIKI_MEDIA.get(key);
  if (!object) return notFound();

  if (request.headers.get("If-None-Match") === object.etag) {
    return new Response(null, { status: 304, headers: objectHeaders(object) });
  }

  const response = new Response(request.method === "HEAD" ? null : object.body, {
    status: 200,
    headers: objectHeaders(object)
  });
  if (request.method === "GET") context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

const wikiMediaWorker = {
  fetch: handleWikiMediaRequest
};

export default wikiMediaWorker;
