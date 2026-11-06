import "server-only";
import { cache } from "react";
import { getArticleGameSummaryBySlug, type ArticleGameSummary } from "./db";
import { gameImageUrl } from "./game-images";
import { gameTopNavBasePath } from "./game-top-nav-path";
import { getLiveSiteRoute } from "./site-route-page";
import { listGameMenus } from "./game-site-data";
import { supabaseAdmin } from "./supabase";
import type { GameTopNavContext, GameTopNavLink } from "./game-top-nav-types";

const pageTypes: Array<{ kind: string; type: GameTopNavLink["type"]; label: string }> = [
  { kind: "wiki", type: "wiki", label: "Wiki" },
  { kind: "article", type: "articles", label: "Articles" },
  { kind: "code", type: "codes", label: "Codes" },
  { kind: "checklist", type: "checklists", label: "Gameplay Checklist" },
  { kind: "quiz", type: "quizzes", label: "Quiz" },
  { kind: "map", type: "map", label: "Map" }
];

// Request memoization only; publication purges the API's Cloudflare top-nav tag.
const readGameNav = cache(async (gameId: string) => {
  const { data: game, error } = await supabaseAdmin().from("games").select("id,namespace,kind,title,short_title,cover_image,hero_image")
    .eq("id", gameId).eq("is_published", true).maybeSingle();
  if (error) throw error;
  if (!game || game.namespace === "roblox" || game.kind === "franchise") return null;
  const [menus, archive] = await Promise.all([
    listGameMenus(game.namespace, game.id, false),
    supabaseAdmin().from("game_article_game_summary").select("game_slug,article_count")
      .eq("game_id", game.id).eq("namespace", game.namespace).maybeSingle()
  ]);
  if (archive.error) throw archive.error;
  // Defense in depth: listGameMenus groups by namespace, but this bar is game-specific.
  const pages = menus.flatMap(menu => menu.pages).filter(page => page.gameId === game.id);
  // A Roblox archive keeps its URL if slugs ever clash, so link only an archive this game owns.
  const owner = archive.data && Number(archive.data.article_count) > 0 ? await getArticleGameSummaryBySlug(archive.data.game_slug) : null;
  return { game, pages, archive: owner?.gameId === game.id ? archive.data : null };
});

export async function getSharedGameTopNavContext(
  path: string | null | undefined,
  articleGame?: ArticleGameSummary | null
): Promise<GameTopNavContext | null> {
  if (!path?.trim()) return null;
  // Numbered collections and articles have one canonical registry row.
  const basePath = gameTopNavBasePath(path);
  if (!basePath) return null;
  const route = articleGame?.namespace && articleGame.gameId ? null : await getLiveSiteRoute(basePath);
  const gameId = articleGame?.namespace ? articleGame.gameId : route?.source === "game" ? route.game_id : null;
  if (!gameId) return null;
  const data = await readGameNav(gameId);
  if (!data) return null;
  const { game, pages, archive } = data;
  const activeKind = articleGame?.namespace ? "article" : route?.page_type === "collection" || route?.page_type === "hub" ? "wiki" : route?.page_type;
  const links: GameTopNavLink[] = [];
  for (const { kind, type, label } of pageTypes) {
    // Canonical-path order in listGameMenus makes the first of each type stable.
    const first = pages.find(page => page.kind === kind);
    const href = kind === "article"
      ? archive ? `/articles/games/${archive.game_slug}` : null
      : first?.href;
    if (href) links.push({ label, href, type, active: kind === activeKind });
  }
  const tools = pages.filter(page => page.kind === "tool").map(page => ({ label: page.title, href: page.href, active: page.href === basePath }));
  return {
    gameName: game.short_title || game.title,
    thumbnailUrl: gameImageUrl(game.hero_image) || gameImageUrl(game.cover_image),
    links,
    tools,
    toolsActive: activeKind === "tool"
  };
}
