import type {
  ApiErrorResponse,
  CodeDetailResponse,
  CodesIndexResponse,
  MobileContentDetailResponse,
  MobileContentIndexResponse,
  MobileContentKind,
  SearchResponse
} from "./types";

const DEFAULT_API_BASE_URL = "https://bloxodes.com";

export function getApiBaseUrl(): string {
  const value = process.env.EXPO_PUBLIC_BLOXODES_API_URL?.trim();
  if (value) return value.replace(/\/$/, "");

  const location = (globalThis as { location?: { hostname?: string } }).location;
  if (location?.hostname === "localhost") {
    return "http://localhost:3001";
  }

  return DEFAULT_API_BASE_URL;
}

export function buildWebUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`);
  const payload = (await response.json()) as unknown;

  if (!response.ok || !isOkPayload(payload)) {
    const message = isErrorPayload(payload) ? payload.error : "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

function isOkPayload(value: unknown): value is { ok: true } {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === true;
}

function isErrorPayload(value: unknown): value is ApiErrorResponse {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false && "error" in value;
}

export function fetchCodesIndex(page = 1): Promise<CodesIndexResponse> {
  return requestJson<CodesIndexResponse>(`/api/mobile/codes?page=${page}&pageSize=20`);
}

export function fetchCodeDetail(slug: string): Promise<CodeDetailResponse> {
  return requestJson<CodeDetailResponse>(`/api/mobile/codes/${encodeURIComponent(slug)}`);
}

export function fetchContentIndex(kind: MobileContentKind, page = 1): Promise<MobileContentIndexResponse> {
  return requestJson<MobileContentIndexResponse>(`/api/mobile/content/${kind}?page=${page}`);
}

export function fetchContentDetail(kind: MobileContentKind, slug: string): Promise<MobileContentDetailResponse> {
  return requestJson<MobileContentDetailResponse>(`/api/mobile/content/${kind}/${encodeURIComponent(slug)}`);
}

export function fetchSearchResults(query: string, scope = "global"): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    scope,
    limit: "20"
  });
  return fetch(`${getApiBaseUrl()}/api/search/all?${params.toString()}`).then(async (response) => {
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error("Failed to load search results");
    }
    return payload as SearchResponse;
  });
}
