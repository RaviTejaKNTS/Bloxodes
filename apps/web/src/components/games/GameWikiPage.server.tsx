import { listGameMenus } from "@/lib/game-site-data";
import { gameRelatedPages } from "@/lib/game-site-navigation";
import "server-only";
import { getGameDirectoryPages } from "@/lib/game-registry";
import { getGameLandingForLinks } from "@/lib/game-landing";
import { createGameReader } from "@/lib/shared-game-reader";
import { GameRelatedLinks } from "./GameRelatedLinks";
import { renderGameWikiPage as renderWiki, type GameWikiPageProps } from "./GameWikiPage";

// Route adapter: load navigation here so the shared renderer only receives presentation data.
export async function renderGameWikiPage(props: Omit<GameWikiPageProps, "directoryPages" | "sidebarContent">) {
  const { page, namespace } = props;
  const landing = await getGameLandingForLinks(namespace);
  const gameId = page.game_kind === "franchise" ? undefined : page.game_id;
  const menu = (await listGameMenus(namespace, gameId).catch(() => [])).find(menu => menu.namespace === namespace);
  const extraLinks = props.extraLinks ?? (menu ? gameRelatedPages(menu, gameId).map(page => ({ href: page.href, title: page.title })) : []);
  const reader = createGameReader(namespace);
  const directoryPages = page.game_kind === "franchise"
    ? (await reader.listPublishedSharedGameWikiPages())
      .filter(child => child.id !== page.id && child.canonical_path !== `/${namespace}` && child.canonical_path !== `/${namespace}/wiki`)
      .map(child => ({ kind: "game_wiki_pages_view", href: child.canonical_path, title: child.title, image: reader.resolveSharedGameWikiCoverImage(child) || null }))
    : page.canonical_path === `/${namespace}`
      ? await getGameDirectoryPages(namespace, gameId)
      : [];
  return renderWiki({
    ...props,
    extraLinks,
    landingPath: landing.path,
    directoryPages,
    sidebarContent: <GameRelatedLinks namespace={namespace} gameId={gameId} canonicalPath={page.canonical_path} />
  });
}
