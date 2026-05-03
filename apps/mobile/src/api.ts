import type { ApiErrorResponse, CodeDetailResponse, CodesIndexResponse } from "./types";

const DEFAULT_API_BASE_URL = "https://bloxodes.com";

function getApiBaseUrl(): string {
  const value = process.env.EXPO_PUBLIC_BLOXODES_API_URL?.trim();
  return (value || DEFAULT_API_BASE_URL).replace(/\/$/, "");
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
