import { rewriteLegacyWikiMediaUrls } from "./wiki-media";

// Responses that must not carry a body; rebuilding them with one would throw.
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : undefined);
  return (method ?? "GET").toUpperCase();
}

/**
 * True only for database reads whose rows can carry page copy: PostgREST table
 * and view GETs, and RPC calls (POST, or GET for `get: true`). Writes, HEAD
 * counts, Storage, Auth and Edge Functions pass through untouched.
 */
function isDatabaseRead(input: RequestInfo | URL, init?: RequestInit): boolean {
  let pathname: string;
  try {
    pathname = new URL(requestUrl(input)).pathname;
  } catch {
    return false;
  }
  if (!pathname.includes("/rest/v1/")) return false;
  const method = requestMethod(input, init);
  if (method === "GET") return true;
  return method === "POST" && pathname.includes("/rest/v1/rpc/");
}

/**
 * Fetch for the web app's database client. Successful JSON reads that contain the
 * retired `https://media.bloxodes.com/wiki/` prefix are returned with the R2 custom
 * domain instead, so rendered pages, metadata and JSON-LD never depend on the
 * redirect. Every other request and response passes through unchanged. Publishers
 * use `supabase-admin.ts` and read stored values unchanged.
 */
export async function rewriteLegacyWikiMediaFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (
    !response.ok ||
    !response.body ||
    NULL_BODY_STATUSES.has(response.status) ||
    !isDatabaseRead(input, init) ||
    !/\bjson\b/i.test(response.headers.get("content-type") ?? "")
  ) {
    return response;
  }
  // One read; rewriteLegacyWikiMediaUrls returns the same string when the prefix is absent.
  const body = rewriteLegacyWikiMediaUrls(await response.text());
  const headers = new Headers(response.headers);
  // The body was already decoded by fetch and is re-sent as plain UTF-8 text.
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
