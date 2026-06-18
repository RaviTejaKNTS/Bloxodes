import "server-only";
import type { GameTopNavContext, GameTopNavLink, GameTopNavToolLink } from "@/lib/game-top-nav-types";
import { statsUniverseSlug } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase";

type RouteTarget =
  | { type: Exclude<GameTopNavLink["type"], "stats">; table: string; slugField: "slug" | "code"; slug: string }
  | { type: "tools"; table: "tools_view"; slugField: "code"; slug: string }
  | { type: "stats"; statsSlug: string }
  | { type: "articles"; slug: string }
  | { type: "wikiCatalog"; wikiSlug: string };

type TargetResolution = {
  universeId: number;
  activeType: GameTopNavLink["type"] | "tools" | null;
  activeHref: string | null;
};

type UniverseRow = {
  universe_id: number;
  slug: string | null;
  display_name: string | null;
  name: string | null;
  icon_url: string | null;
};

function normalizePath(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^https?:\/\/[^/]+/i, "").replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
}

function parsePath(path: string | null | undefined): RouteTarget | null {
  const segments = normalizePath(path)
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).trim().toLowerCase());

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
  if (segments.length === 3 && segments[0] === "wiki" && segments[1] && segments[2]) {
    return { type: "wikiCatalog", wikiSlug: segments[1] };
  }
  if (segments.length === 2 && segments[0] === "articles" && segments[1]) {
    return { type: "articles", slug: segments[1] };
  }
  return null;
}

function parseStatsUniverseIdSlug(slug: string): number | null {
  const match = slug.trim().match(/(?:^|-)(\d+)$/);
  if (!match) return null;
  const universeId = Number(match[1]);
  return Number.isSafeInteger(universeId) && universeId > 0 ? universeId : null;
}

async function resolveRouteTarget(target: RouteTarget): Promise<TargetResolution | null> {
  const supabase = supabaseAdmin();

  if (target.type === "stats") {
    const parsedUniverseId = parseStatsUniverseIdSlug(target.statsSlug);
    const { data, error } = parsedUniverseId
      ? await supabase.from("roblox_universes").select("universe_id").eq("universe_id", parsedUniverseId).limit(1).maybeSingle()
      : await supabase.from("roblox_universes").select("universe_id").eq("slug", target.statsSlug).limit(1).maybeSingle();
    if (error || !data?.universe_id) return null;
    return { universeId: data.universe_id, activeType: "stats", activeHref: `/stats/games/${target.statsSlug}` };
  }

  if (target.type === "wikiCatalog") {
    const { data, error } = await supabase
      .from("wiki_pages_view")
      .select("universe_id, slug")
      .eq("slug", target.wikiSlug)
      .eq("is_published", true)
      .limit(1)
      .maybeSingle();
    if (error || !data?.universe_id) return null;
    return { universeId: data.universe_id, activeType: "wiki", activeHref: `/wiki/${data.slug}` };
  }

  if (target.type === "articles") {
    const { data, error } = await supabase
      .from("articles")
      .select("universe_id, slug")
      .eq("slug", target.slug)
      .eq("is_published", true)
      .limit(1)
      .maybeSingle();
    if (error || !data?.universe_id) return null;
    return { universeId: data.universe_id, activeType: null, activeHref: null };
  }

  const { data, error } = await supabase
    .from(target.table)
    .select("universe_id")
    .eq(target.slugField, target.slug)
    .limit(1)
    .maybeSingle();

  if (error || !data?.universe_id) return null;
  return {
    universeId: data.universe_id,
    activeType: target.type,
    activeHref: target.type === "tools" ? `/tools/${target.slug}` : null
  };
}

function uniqueByHref<T extends { href: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

export async function getGameTopNavContext(path: string | null | undefined): Promise<GameTopNavContext | null> {
  const target = parsePath(path);
  if (!target) return null;

  const resolved = await resolveRouteTarget(target);
  if (!resolved) return null;

  const supabase = supabaseAdmin();
  const [universeResult, codes, wiki, events, checklists, quizzes, tools] = await Promise.all([
    supabase
      .from("roblox_universes")
      .select("universe_id, slug, display_name, name, icon_url")
      .eq("universe_id", resolved.universeId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("code_pages_index_view")
      .select("slug, name")
      .eq("is_published", true)
      .eq("universe_id", resolved.universeId)
      .order("content_updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("wiki_pages_view")
      .select("slug, title")
      .eq("is_published", true)
      .eq("universe_id", resolved.universeId)
      .limit(1),
    supabase
      .from("events_pages")
      .select("slug, title")
      .eq("is_published", true)
      .eq("universe_id", resolved.universeId)
      .not("slug", "is", null)
      .limit(1),
    supabase
      .from("checklist_pages_view")
      .select("slug, title")
      .eq("is_public", true)
      .eq("universe_id", resolved.universeId)
      .limit(1),
    supabase
      .from("quiz_pages_view")
      .select("code, title")
      .eq("is_published", true)
      .eq("universe_id", resolved.universeId)
      .limit(1),
    supabase
      .from("tools_view")
      .select("code, title")
      .eq("is_published", true)
      .eq("universe_id", resolved.universeId)
      .order("content_updated_at", { ascending: false })
      .limit(8)
  ]);

  if (universeResult.error || !universeResult.data) return null;
  const universe = universeResult.data as UniverseRow;
  const gameName = universe.display_name ?? universe.name ?? `Universe ${universe.universe_id}`;
  const statsSlug = statsUniverseSlug(universe.slug || gameName, universe.universe_id);

  const links: GameTopNavLink[] = [];
  for (const row of (wiki.data ?? []) as Array<{ slug?: string | null }>) {
    if (row.slug) links.push({ label: "Wiki", href: `/wiki/${row.slug}`, type: "wiki" });
  }
  links.push({ label: "Stats", href: `/stats/games/${statsSlug}`, type: "stats" });
  for (const row of (codes.data ?? []) as Array<{ slug?: string | null }>) {
    if (row.slug) links.push({ label: "Codes", href: `/codes/${row.slug}`, type: "codes" });
  }
  for (const row of (events.data ?? []) as Array<{ slug?: string | null }>) {
    if (row.slug) links.push({ label: "Events", href: `/events/${row.slug}`, type: "events" });
  }
  for (const row of (checklists.data ?? []) as Array<{ slug?: string | null }>) {
    if (row.slug) links.push({ label: "Gameplay Checklist", href: `/checklists/${row.slug}`, type: "checklists" });
  }
  for (const row of (quizzes.data ?? []) as Array<{ code?: string | null }>) {
    if (row.code) links.push({ label: "Quiz", href: `/quizzes/${row.code}`, type: "quizzes" });
  }

  const activeLinks = uniqueByHref(links).map((link) => ({
    ...link,
    active: link.type === resolved.activeType || link.href === resolved.activeHref
  }));
  const toolLinks = uniqueByHref(
    ((tools.data ?? []) as Array<{ code?: string | null; title?: string | null }>).flatMap((row) =>
      row.code ? [{ label: row.title ?? "Tool", href: `/tools/${row.code}`, active: `/tools/${row.code}` === resolved.activeHref }] : []
    )
  );

  const hasPageBeyondStats = activeLinks.some((link) => link.type !== "stats") || toolLinks.length > 0;
  if (!hasPageBeyondStats) return null;
  return {
    gameName,
    thumbnailUrl: universe.icon_url,
    links: activeLinks,
    tools: toolLinks,
    toolsActive: resolved.activeType === "tools" || toolLinks.some((link) => link.active)
  };
}
