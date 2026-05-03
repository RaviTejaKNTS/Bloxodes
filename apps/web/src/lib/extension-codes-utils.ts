import { slugify } from "@/lib/slug";

const MAX_LIMIT = 3;
const DEFAULT_LIMIT = 3;

export function normalizeExtensionLimit(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(parsed));
}

export function normalizeRobloxPlaceId(value: string | number | null | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  const floored = Math.floor(parsed);
  return Number.isSafeInteger(floored) ? floored : null;
}

export function normalizeRobloxGameName(value: string | null | undefined): string | null {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
  return normalized.slice(0, 120);
}

export function normalizeRobloxGameUrl(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 500) return null;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (hostname !== "www.roblox.com" && hostname !== "web.roblox.com") return null;
    if (!url.pathname.startsWith("/games/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function extractPlaceIdFromRobloxUrl(value: string | null | undefined): number | null {
  const normalized = normalizeRobloxGameUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const match = url.pathname.match(/^\/games\/(\d+)/);
  return normalizeRobloxPlaceId(match?.[1]);
}

export function normalizeGameNameSlug(value: string | null | undefined): string {
  return slugify(normalizeRobloxGameName(value) ?? "none");
}
