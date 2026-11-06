import type { GameTopNavLink } from "@/lib/game-top-nav-types";

type RouteTarget =
  | { type: "shared" }
  | { type: Exclude<GameTopNavLink["type"], "stats" | "articles" | "map">; table: string; slugField: "slug" | "code"; slug: string }
  | { type: "tools"; table: "tools_view"; slugField: "code"; slug: string }
  | { type: "stats"; statsSlug: string }
  | { type: "articleDetail"; slug: string }
  | { type: "articleGame"; slug: string }
  | { type: "wikiCatalog"; wikiSlug: string };

function normalizePath(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^https?:\/\/[^/]+/i, "").replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
}

function pathSegments(path: string | null | undefined): string[] | null {
  try {
    return normalizePath(path)
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment).trim().toLowerCase());
  } catch {
    return null;
  }
}

/** The page's own path: decoded, lowercase, and without a page number, as stored in the route registry. */
export function gameTopNavBasePath(path: string | null | undefined): string | null {
  const segments = pathSegments(path);
  if (!segments) return null;
  const end = segments.length >= 2 && segments[segments.length - 2] === "page" && /^[1-9]\d*$/.test(segments[segments.length - 1])
    ? segments.length - 2
    : segments.length;
  return `/${segments.slice(0, end).join("/")}`;
}

export function parseGameTopNavPath(path: string | null | undefined): RouteTarget | null {
  const segments = pathSegments(path);
  if (!segments) return null;

  if (segments.length === 2 && segments[0] === "codes" && segments[1]) {
    return { type: "codes", table: "code_pages_index_view", slugField: "slug", slug: segments[1] };
  }
  if (segments.length === 2 && segments[0] === "events" && segments[1]) {
    return { type: "events", table: "events_pages", slugField: "slug", slug: segments[1] };
  }
  if (segments.length === 2 && segments[0] === "checklists" && segments[1]) {
    return { type: "checklists", table: "checklist_pages_view", slugField: "slug", slug: segments[1] };
  }
  if (segments.length === 2 && segments[0] === "quizzes" && segments[1]) {
    return { type: "quizzes", table: "quiz_pages_view", slugField: "code", slug: segments[1] };
  }
  if (segments.length >= 2 && segments[0] === "tools") {
    const slug = segments.slice(1).join("/");
    return slug ? { type: "tools", table: "tools_view", slugField: "code", slug } : null;
  }
  if (segments.length === 3 && segments[0] === "stats" && segments[1] === "games" && segments[2]) {
    return { type: "stats", statsSlug: segments[2] };
  }
  if (segments.length === 2 && segments[0] === "wiki" && segments[1]) {
    return { type: "wiki", table: "wiki_pages_view", slugField: "slug", slug: segments[1] };
  }
  if (segments[0] === "wiki" && segments[1] && segments[2] &&
      (segments.length === 3 || (segments.length === 5 && segments[3] === "page" && /^[1-9]\d*$/.test(segments[4])))) {
    return { type: "wikiCatalog", wikiSlug: segments[1] };
  }
  if (segments.length === 3 && segments[0] === "articles" && segments[1] === "games" && segments[2]) {
    return { type: "articleGame", slug: segments[2] };
  }
  if (segments.length === 5 && segments[0] === "articles" && segments[1] === "games" && segments[2] && segments[3] === "page") {
    return { type: "articleGame", slug: segments[2] };
  }
  if (segments.length === 4 && segments[0] === "articles" && segments[2] === "page" && /^[1-9]\d*$/.test(segments[3])) return {type:"articleDetail",slug:segments[1]};
  if (segments.length === 2 && segments[0] === "articles" && segments[1]) {
    return { type: "articleDetail", slug: segments[1] };
  }
  // Shared routes can have stored paths outside the Roblox families. Reserve a row
  // for their common page kinds; the client removes it once a null result arrives.
  if (segments.length >= 2 && ["maps", "games"].includes(segments[0])) {
    return { type: "shared" };
  }
  return null;
}
