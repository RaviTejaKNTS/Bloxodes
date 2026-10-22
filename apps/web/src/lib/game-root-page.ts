import type { SharedGameGame, SharedGameWikiPage } from "./shared-game-reader";

export type GameWikiPresentationPage = SharedGameWikiPage & { seo_canonical_path?: string };

/** Only a published wiki owned by this published namespace root can replace its canonical. */
export function gameLandingPath(game: SharedGameGame, wiki?: SharedGameWikiPage | null, hasIndependentRoot = false): string {
  const rootPath = `/${game.namespace}`;
  return !hasIndependentRoot && game.is_published && game.parent_id === null
    && wiki?.is_published && wiki.game_id === game.id && wiki.namespace === game.namespace
    && wiki.canonical_path === `${rootPath}/wiki` ? wiki.canonical_path : rootPath;
}

export function gameWikiCanonicalPath(page: GameWikiPresentationPage): string {
  return page.seo_canonical_path ?? page.canonical_path;
}

/** Namespace landing pages use the same wiki presentation, with their own identity and art. */
export function gameRootWikiPage(game: SharedGameGame, wiki?: SharedGameWikiPage | null, hasIndependentRoot = false): GameWikiPresentationPage {
  return {
    ...game, game_id: game.id,
    seo_title: null, meta_description: null, controls_json: [], tips_md: null, content_updated_at: game.updated_at,
    game_title: game.title, game_short_title: game.short_title, game_installment: game.installment,
    game_content_kind: game.content_kind, game_parent_game_id: game.parent_game_id, game_kind: game.kind,
    game_developer: game.developer, game_publisher: game.publisher, game_description_md: game.description_md,
    game_cover_image: game.cover_image, game_hero_image: game.hero_image, game_official_url: game.official_url,
    game_release_dates_json: game.release_dates_json, game_platforms_json: game.platforms_json, game_status: game.status,
    ...(wiki?.game_id === game.id ? wiki : {}),
    canonical_path: `/${game.namespace}`,
    // Keep the route identity for directory cards and comments. Only SEO identity changes.
    seo_canonical_path: gameLandingPath(game, wiki, hasIndependentRoot)
  };
}

export type GameBreadcrumb = { label: string; href?: string | null };

/** Keep the current page last and remove ancestors that resolve to the same destination. */
export function gameBreadcrumbs(items: GameBreadcrumb[], currentPath: string): GameBreadcrumb[] {
  const seen = new Set([currentPath]);
  return items.filter((item, index) => {
    if (index === items.length - 1 || !item.href) return true;
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}
