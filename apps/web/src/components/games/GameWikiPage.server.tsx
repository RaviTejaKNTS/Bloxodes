import "server-only";
import { getGameDirectoryPages } from "@/lib/game-registry";
import { GameRelatedLinks } from "./GameRelatedLinks";
import { renderGameWikiPage as renderWiki, type GameWikiPageProps } from "./GameWikiPage";

// Route adapter: load navigation here so the shared renderer only receives presentation data.
export async function renderGameWikiPage(props: Omit<GameWikiPageProps, "directoryPages" | "sidebarContent">) {
  const { page, namespace } = props;
  const gameId = page.game_kind === "franchise" ? undefined : page.game_id;
  const directoryPages = page.game_kind === "franchise" || page.canonical_path === `/${namespace}`
    ? await getGameDirectoryPages(namespace, gameId)
    : [];
  return renderWiki({
    ...props,
    directoryPages,
    sidebarContent: <GameRelatedLinks namespace={namespace} gameId={gameId} canonicalPath={page.canonical_path} />
  });
}
