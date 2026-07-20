import type {
  ApiErrorResponse,
  ChecklistProgressResponse,
  ChecklistProgressSummary,
  CodeDetailResponse,
  CodeProgressResponse,
  CodesIndexResponse,
  MobileAuthExchangeResponse,
  MobileAuthSessionResponse,
  MobileContentDetailResponse,
  MobileContentIndexResponse,
  MobileContentKind,
  MobileHomeResponse,
  QuizPlayResponse,
  QuizProgressResponse,
  QuizProgressSummary,
  SearchResponse,
  StatsGameChartResponse,
  StatsGameDetailResponse,
  StatsGamesResponse
} from "./types";

const DEFAULT_API_BASE_URL = "https://bloxodes.com";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

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

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: buildHeaders(init?.headers as Record<string, string> | undefined)
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok || !isOkPayload(payload)) {
    const message = isErrorPayload(payload) ? payload.error : "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

async function requestPlainJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init?.headers as Record<string, string> | undefined)
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "Request failed";
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

// React Native's URLSearchParams polyfill is incomplete, so build query
// strings by hand.
function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.join("&");
}

// Codes

export function fetchCodesIndex(page = 1, pageSize = 20, query = ""): Promise<CodesIndexResponse> {
  const queryString = buildQuery({ page, pageSize, q: query.trim() });
  return requestJson<CodesIndexResponse>(`/api/mobile/codes?${queryString}`);
}

export function fetchCodeDetail(slug: string): Promise<CodeDetailResponse> {
  return requestJson<CodeDetailResponse>(`/api/mobile/codes/${encodeURIComponent(slug)}`);
}

// Content sections

export function fetchContentIndex(
  kind: MobileContentKind,
  page = 1,
  query?: string,
  pageSize = 24
): Promise<MobileContentIndexResponse> {
  const queryString = buildQuery({ page, pageSize, q: query?.trim() });
  return requestJson<MobileContentIndexResponse>(`/api/mobile/content/${kind}?${queryString}`);
}

export function fetchContentDetail(
  kind: MobileContentKind,
  slug: string,
  sectionPages?: Record<string, number>,
  query?: string
): Promise<MobileContentDetailResponse> {
  const pageParams: Record<string, number | string> = {};
  for (const [sectionId, page] of Object.entries(sectionPages ?? {})) {
    pageParams[`sectionPage.${sectionId}`] = page;
  }
  const trimmedQuery = query?.trim();
  if (trimmedQuery) {
    pageParams.q = trimmedQuery;
  }
  const queryString = buildQuery(pageParams);
  const suffix = queryString ? `?${queryString}` : "";
  return requestJson<MobileContentDetailResponse>(`/api/mobile/content/${kind}/${encodeURIComponent(slug)}${suffix}`);
}

export function fetchMobileHome(): Promise<MobileHomeResponse> {
  return requestJson<MobileHomeResponse>("/api/mobile/home");
}

// Search

export async function fetchSearchResults(query: string, scope = "global"): Promise<SearchResponse> {
  const queryString = buildQuery({ q: query, scope, limit: 20 });
  const response = await fetch(`${getApiBaseUrl()}/api/search/all?${queryString}`);
  if (!response.ok) {
    throw new Error("Failed to load search results");
  }
  return (await response.json()) as SearchResponse;
}

// Auth

export function fetchAuthSession(): Promise<MobileAuthSessionResponse> {
  return requestPlainJson<MobileAuthSessionResponse>("/api/mobile/auth/session");
}

export function exchangeAuthCode(code: string): Promise<MobileAuthExchangeResponse> {
  return requestPlainJson<MobileAuthExchangeResponse>("/api/mobile/auth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
}

export async function logoutSession(): Promise<void> {
  try {
    await requestPlainJson<{ ok: boolean }>("/api/mobile/auth/logout", { method: "POST" });
  } catch {
    // best effort; local sign-out still applies
  }
}

// Code progress

export async function fetchCodeProgress(slug: string): Promise<CodeProgressResponse> {
  try {
    return await requestPlainJson<CodeProgressResponse>(`/api/mobile/codes/progress?slug=${encodeURIComponent(slug)}`);
  } catch {
    return { usedCodes: [] };
  }
}

export async function saveCodeProgress(slug: string, usedCodes: string[]): Promise<boolean> {
  try {
    await requestPlainJson<CodeProgressResponse>("/api/mobile/codes/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, usedCodes })
    });
    return true;
  } catch {
    return false;
  }
}

// Checklist progress

export async function fetchChecklistProgress(slug: string): Promise<ChecklistProgressResponse> {
  try {
    return await requestPlainJson<ChecklistProgressResponse>(
      `/api/mobile/checklists/progress?slug=${encodeURIComponent(slug)}`
    );
  } catch {
    return { checkedIds: [] };
  }
}

export async function saveChecklistProgress(slug: string, checkedIds: string[]): Promise<boolean> {
  try {
    await requestPlainJson<ChecklistProgressResponse>("/api/mobile/checklists/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, checkedIds })
    });
    return true;
  } catch {
    return false;
  }
}

export async function fetchChecklistProgressSummary(): Promise<ChecklistProgressSummary[]> {
  try {
    const payload = await requestPlainJson<{ progress: ChecklistProgressSummary[] }>("/api/mobile/checklists/progress");
    return Array.isArray(payload.progress) ? payload.progress : [];
  } catch {
    return [];
  }
}

// Quiz play + progress

export function fetchQuizPlay(code: string): Promise<QuizPlayResponse> {
  return requestJson<QuizPlayResponse>(`/api/mobile/quizzes/${encodeURIComponent(code)}/play`);
}

export async function fetchQuizProgress(code: string): Promise<QuizProgressResponse | null> {
  try {
    return await requestPlainJson<QuizProgressResponse>(`/api/mobile/quizzes/progress?code=${encodeURIComponent(code)}`);
  } catch {
    return null;
  }
}

export async function saveQuizProgress(input: {
  code: string;
  questionIds: string[];
  score: number;
  total: number;
  breakdown: Record<string, { correct: number; total: number }>;
}): Promise<boolean> {
  try {
    await requestPlainJson<{ seenQuestionIds: string[] }>("/api/mobile/quizzes/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    return true;
  } catch {
    return false;
  }
}

export async function fetchQuizProgressSummary(): Promise<QuizProgressSummary[]> {
  try {
    const payload = await requestPlainJson<{ progress: QuizProgressSummary[] }>("/api/mobile/quizzes/progress");
    return Array.isArray(payload.progress) ? payload.progress : [];
  } catch {
    return [];
  }
}

// Stats

async function requestPublicJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`);
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return payload as T;
}

export function fetchStatsGames(input: { page?: number; q?: string; sort?: string } = {}): Promise<StatsGamesResponse> {
  const queryString = buildQuery({ page: input.page ?? 1, q: input.q?.trim(), sort: input.sort });
  return requestPublicJson<StatsGamesResponse>(`/api/mobile/stats/games?${queryString}`);
}

export function fetchStatsGameDetail(universeId: number): Promise<StatsGameDetailResponse> {
  return requestPublicJson<StatsGameDetailResponse>(`/api/mobile/stats/games/${universeId}`);
}

export function fetchStatsGameChart(universeId: number, range = "14d"): Promise<StatsGameChartResponse> {
  return requestPublicJson<StatsGameChartResponse>(`/api/mobile/stats/games/${universeId}/chart?range=${encodeURIComponent(range)}`);
}
