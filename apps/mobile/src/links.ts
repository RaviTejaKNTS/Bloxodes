import type { MobileContentKind } from "./types";

export const SECTION_KINDS: MobileContentKind[] = ["catalog", "wiki", "quizzes", "checklists", "events"];

export const SECTION_LABELS: Record<MobileContentKind, string> = {
  articles: "Articles",
  catalog: "Catalog",
  checklists: "Checklists",
  events: "Events",
  quizzes: "Quizzes",
  tools: "Tools",
  wiki: "Wiki"
};

export const SECTION_DESCRIPTIONS: Partial<Record<MobileContentKind, string>> = {
  catalog: "Item IDs, decals, music codes, and databases",
  wiki: "Game guides, stats, and collections",
  quizzes: "Test your Roblox game knowledge",
  checklists: "Progression task lists",
  events: "In-game event coverage"
};

export function isSectionKind(value: string | undefined | null): value is MobileContentKind {
  return !!value && (SECTION_KINDS as string[]).includes(value);
}

/**
 * Map a bloxodes.com URL to an in-app route. Returns null when the page has
 * no native screen and should open in the browser instead.
 */
export function routeForWebUrl(url: string): string | null {
  // React Native's URL polyfill is incomplete, so strip origin/query by hand.
  const pathname = url
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "");
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return null;
  const [head, ...rest] = segments;

  if (head === "codes" && rest.length === 1) {
    return `/codes/${encodeURIComponent(rest[0])}`;
  }
  if (head === "quizzes" && rest.length === 1) {
    return `/quiz/${encodeURIComponent(rest[0])}`;
  }
  if (head === "checklists" && rest.length === 1) {
    return `/checklist/${encodeURIComponent(rest[0])}`;
  }
  if (head === "catalog" && rest.length >= 1) {
    return `/section/catalog/${encodeURIComponent(rest.join("/"))}`;
  }
  if (head === "wiki" && rest.length === 1) {
    return `/section/wiki/${encodeURIComponent(rest[0])}`;
  }
  if (head === "wiki" && rest.length === 2) {
    return `/collections/${encodeURIComponent(`${rest[0]}-${rest[1]}`)}`;
  }
  if (head === "events" && rest.length === 1) {
    return `/section/events/${encodeURIComponent(rest[0])}`;
  }
  return null;
}
