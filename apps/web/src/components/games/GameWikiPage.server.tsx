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
  let extraLinks = props.extraLinks ?? [];
  if (namespace === "gta" && page.game_kind !== "franchise" && props.extraLinks === undefined) {
    const { getGtaChecklistPageBySlug } = await import("@/lib/gta-checklists");
    const { getGtaMapRouteForWikiSlug } = await import("@/lib/gta-interactive-map-registry");
    const { listGameMapPages } = await import("@/lib/game-extra-pages");
    const moved = page.canonical_path.startsWith("/wiki/");
    const [checklist, maps] = await Promise.all([getGtaChecklistPageBySlug(page.slug), moved ? listGameMapPages("gta") : []]);
    const legacyMap = getGtaMapRouteForWikiSlug(page.slug);
    const map = maps.find(map => map.slug === legacyMap?.split("/").pop());
    const mapPath = moved ? map?.canonical_path : legacyMap;
    extraLinks = [
      ...(mapPath ? [{ href: mapPath, title: "Explore the interactive map" }] : []),
      ...(checklist ? [{ href: moved ? checklist.canonical_path : `/gta/checklists/${page.slug}`, title: `Track your 100% completion with the ${page.game_title} checklist` }] : [])
    ];
  }
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
