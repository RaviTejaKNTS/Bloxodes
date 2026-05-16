import type {
  ApiErrorResponse,
  CodeDetailResponse,
  CodeProgressResponse,
  CodeSessionResponse,
  CodesIndexResponse,
  MobileContentDetailResponse,
  MobileHomeResponse,
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

export function fetchCodesIndex(page = 1, pageSize = 20, query = ""): Promise<CodesIndexResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  if (query.trim()) {
    params.set("q", query.trim());
  }
  return requestJson<CodesIndexResponse>(`/api/mobile/codes?${params.toString()}`);
}

export function fetchCodeDetail(slug: string): Promise<CodeDetailResponse> {
  return requestJson<CodeDetailResponse>(`/api/mobile/codes/${encodeURIComponent(slug)}`);
}

export function fetchContentIndex(
  kind: MobileContentKind,
  page = 1,
  query?: string,
  pageSize = 24
): Promise<MobileContentIndexResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  if (query?.trim()) {
    params.set("q", query.trim());
  }
  return requestJson<MobileContentIndexResponse>(`/api/mobile/content/${kind}?${params.toString()}`);
}

export function fetchContentDetail(kind: MobileContentKind, slug: string): Promise<MobileContentDetailResponse> {
  return requestJson<MobileContentDetailResponse>(`/api/mobile/content/${kind}/${encodeURIComponent(slug)}`);
}

export function fetchContentDetailPage(
  kind: MobileContentKind,
  slug: string,
  sectionId: string,
  page: number,
  query?: string
): Promise<MobileContentDetailResponse> {
  const params = new URLSearchParams({
    [`sectionPage.${sectionId}`]: String(page)
  });
  if (query?.trim()) {
    params.set("q", query.trim());
  }
  return requestJson<MobileContentDetailResponse>(`/api/mobile/content/${kind}/${encodeURIComponent(slug)}?${params.toString()}`);
}

export function fetchMobileHome(): Promise<MobileHomeResponse> {
  return requestJson<MobileHomeResponse>("/api/mobile/home");
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

export async function fetchCodeSession(): Promise<CodeSessionResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/codes/session`, {
    credentials: "include"
  });
  const payload = (await response.json().catch(() => ({ userId: null }))) as unknown;
  if (!response.ok || typeof payload !== "object" || payload === null) {
    return { userId: null };
  }
  return { userId: typeof (payload as { userId?: unknown }).userId === "string" ? (payload as { userId: string }).userId : null };
}

export async function fetchCodeProgress(slug: string): Promise<CodeProgressResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/codes/progress?slug=${encodeURIComponent(slug)}`, {
    credentials: "include"
  });
  if (!response.ok) {
    return { usedCodes: [] };
  }
  const payload = (await response.json().catch(() => ({ usedCodes: [] }))) as unknown;
  const usedCodes = Array.isArray((payload as { usedCodes?: unknown }).usedCodes)
    ? (payload as { usedCodes: unknown[] }).usedCodes.filter((value): value is string => typeof value === "string")
    : [];
  return { usedCodes };
}

export async function saveCodeProgress(slug: string, usedCodes: string[]): Promise<boolean> {
  const response = await fetch(`${getApiBaseUrl()}/api/mobile/codes/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ slug, usedCodes })
  });
  return response.ok;
}
