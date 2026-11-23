import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "@/styles/gta5-map.css";
import "@/styles/gta-interactive-map.css";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { ContentHtmlBlocks, gameContentFaqs, gameContentJsonLd, gameNamespaceTitle } from "@/components/games/GameContentPage";
import { ImagePinsMap } from "@/components/maps/ImagePinsMap";
import { MapGuideLayout } from "@/components/maps/MapGuideLayout";
import { MapViewport } from "@/components/maps/MapViewport";
import { listGameMapPages } from "@/lib/game-extra-pages";
import { getGameLandingForLinks } from "@/lib/game-landing";
import { parseGameMapData, safeGameContentUrl, type GameExtendedPage } from "@/lib/game-page-data";
import { listGameMenus } from "@/lib/game-site-data";
import { gameSidebarLinks, type GameMenu } from "@/lib/game-site-navigation";
import { imagePinsMapPageData } from "@/lib/image-pins-map";
import { renderMarkdown } from "@/lib/markdown";

/** Every `image-pins` map, for any game: the full-screen viewer with the page copy as its guide. */
export async function GameImageMapPage({ page }: { page: GameExtendedPage }) {
  const data = parseGameMapData(page.map_data);
  const [intro, description, faqs, landing, maps, menus] = await Promise.all([
    renderMarkdown(page.intro_md ?? ""),
    renderMarkdown(page.description_md ?? ""),
    gameContentFaqs(page),
    getGameLandingForLinks(page.namespace),
    // Rail and back-link lookups are optional; the map and its copy still render without them.
    listGameMapPages(page.namespace).catch((): GameExtendedPage[] => []),
    listGameMenus(page.namespace, page.game_id, false).catch((): GameMenu[] => [])
  ]);
  const namespaceTitle = landing.root?.title ?? gameNamespaceTitle(page.namespace);
  const menu = menus.find(entry => entry.namespace === page.namespace);
  const wiki = menu?.pages.find(entry => entry.kind === "wiki" && entry.gameId === page.game_id);
  const map = imagePinsMapPageData(page, data, wiki ? { title: wiki.title, path: wiki.href } : { title: namespaceTitle, path: landing.path });
  // Keep the rail short so the sticky ad begins beside the map, as on the GTA maps.
  const otherMaps = maps.filter(entry => entry.canonical_path !== page.canonical_path).slice(0, 3).map(entry => ({ href: entry.canonical_path, title: entry.title }));
  const rail = otherMaps.length
    ? { heading: `More ${namespaceTitle} maps`, links: otherMaps, footer: { href: landing.path, label: `All ${namespaceTitle} maps` } }
    : { heading: menu ? `More for ${menu.title}` : "Related pages", links: menu ? gameSidebarLinks(menu, page.game_id) : [] };
  const sources = (page.sources_json ?? []).filter(source => source?.title?.trim() && safeGameContentUrl(source.url));

  return (
    <div className="gta-map-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: gameContentJsonLd(page, landing.path) }} />
      {MapGuideLayout({
        canonicalPath: page.canonical_path,
        title: page.title,
        heading: `About the ${page.game_title} map`,
        map: <MapViewport><ImagePinsMap map={map} attribution={data.attribution} /></MapViewport>,
        analytics: { contentType: "game_map", itemId: page.canonical_path },
        rail,
        after: <div className="mt-10"><CommentsSection entityType="game_map" entityId={page.id} /></div>,
        children: (
          <>
            <ContentHtmlBlocks html={intro} group="intro" />
            <ContentHtmlBlocks html={description} group="description" />
            <h2>Map credits</h2>
            <p>{data.attribution}</p>
            {sources.length ? (
              <ul>{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
            ) : null}
            {/* The FAQ keeps its own type scale, as on every other shared reference page. */}
            <ContentFaq items={faqs} className="not-prose mt-10 border-t border-border/60 pt-6" />
          </>
        )
      })}
    </div>
  );
}
