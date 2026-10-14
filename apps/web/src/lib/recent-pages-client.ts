"use client";

/** Content pages a visitor opened, newest first. Kept only in this browser, for the homepage "pick up" row. */
export type RecentPageKind = "codes" | "checklist" | "quiz" | "tool" | "wiki" | "guide" | "event" | "catalog" | "stats" | "puzzle" | "map";

export type RecentPage = { href: string; kind: RecentPageKind; title: string; image: string | null; at: number };

const STORAGE_KEY = "bloxodes:recent-pages";
const MAX_PAGES = 12;

/** First match wins. Index pages are left out; only pages about one thing count. */
const KINDS: Array<[RegExp, RecentPageKind]> = [
  [/^\/codes\/[^/]+$/, "codes"],
  [/^\/checklists\/[^/]+$/, "checklist"],
  [/^\/quizzes\/[^/]+$/, "quiz"],
  [/^\/tools\/[^/]+$/, "tool"],
  [/^\/articles\/[^/]+$/, "guide"],
  [/^\/events\/[^/]+$/, "event"],
  [/^\/catalog\/.+/, "catalog"],
  [/^\/stats\/games\/[^/]+$/, "stats"],
  [/^\/puzzles\/[^/]+$/, "puzzle"],
  [/^\/gta\/checklists\/[^/]+$/, "checklist"],
  [/^\/gta\/maps\/.+/, "map"],
  [/^\/minecraft\/tools\/[^/]+$/, "tool"],
  [/^\/(wiki|gta|red-dead|minecraft)\/.+/, "wiki"]
];

export function recentPageKind(pathname: string): RecentPageKind | null {
  return KINDS.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
}

export function readRecentPages(): RecentPage[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentPage =>
        entry && typeof entry.href === "string" && typeof entry.title === "string" && typeof entry.kind === "string" && typeof entry.at === "number"
    );
  } catch {
    return [];
  }
}

export function recordRecentPage(page: RecentPage) {
  try {
    const next = [page, ...readRecentPages().filter((entry) => entry.href !== page.href)].slice(0, MAX_PAGES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function clearRecentPages() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
