import { specializedMinecraftToolRoute, specializedGtaMapRoute } from "@/lib/specialized-game-route";
import { gameChecklistConfig } from "@/lib/engagement/config";
import { getLiveSiteRoute } from "@/lib/site-route-page";
import { getGameExtendedPage, getGameChecklistByPath, getGameExtendedPageById, getGameChecklistById } from "@/lib/game-extra-pages";
import { gameContentMetadata, GameContentPage } from "@/components/games/GameContentPage";
import { GameMap } from "@/components/games/GameMap";
import { GameCatalog } from "@/components/games/GameCatalog";
import { GameQuizPage, gameQuizMetadata } from "@/components/games/GameQuizPage";
import { ChecklistPageTemplate, checklistMetadata } from "@/components/ChecklistPageTemplate";
import { parseGameMapData, parseGameCatalogData } from "@/lib/game-page-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameRoot, getGameWikiByPath, getGameWikiById, getGameCollectionByPath, getGameCodeByPath, getGameToolByPath, getGameCollectionById, getGameCodeById, getGameToolById } from "@/lib/game-registry";
import { gameWikiMetadata } from "@/components/games/GameWikiPage";
import { renderGameWikiPage } from "@/components/games/GameWikiPage.server";
import { gameRootWikiPage } from "@/lib/game-root-page";
import { GameRelatedLinks } from "@/components/games/GameRelatedLinks";
import { gameCollectionMetadata, renderSharedGameCollection } from "@/components/games/GameCollectionPage";
import { GameCodePage } from "@/components/games/GameCodePage";
import { GameToolPage, gameToolMetadata } from "@/components/games/GameToolPage";
import { buildAlternates, SITE_URL } from "@/lib/seo";

type Props = { params: Promise<{ slug: string; sitePath: string }> };
async function context(params: Props["params"]) {
  const { slug, sitePath } = await params;
  const root = await getGameRoot(slug);
  if (!root) notFound();
  const path = sitePath;
  const match = /\/page\/([1-9]\d*)$/.exec(path);
  const currentPage = match ? Number(match[1]) : 1;
  const basePath = match ? path.slice(0, match.index) : path;
  if (!Number.isSafeInteger(currentPage) || (/\/page\//.test(path) && !match)) notFound();
  const route = await getLiveSiteRoute(basePath);
  let wiki = null, collection = null, codes = null, tool = null;
  let map = null, quiz = null, catalog = null, checklist = null;
  if (route === undefined) {
    [wiki, collection, codes, tool, map, quiz, catalog, checklist] = await Promise.all([
      getGameWikiByPath(slug, basePath), getGameCollectionByPath(slug, basePath),
      getGameCodeByPath(slug, basePath), getGameToolByPath(slug, basePath),
      getGameExtendedPage(slug, basePath, "map"), getGameExtendedPage(slug, basePath, "quiz"),
      getGameExtendedPage(slug, basePath, "catalog"), getGameChecklistByPath(slug, basePath),
    ]);
  } else if (route) {
    if (route.source !== "game") notFound();
    switch (route.page_type) {
      case "wiki": wiki = await getGameWikiById(slug, route.page_id); break;
      case "collection": collection = await getGameCollectionById(slug, route.page_id); break;
      case "code": codes = await getGameCodeById(slug, route.page_id); break;
      case "tool": tool = await getGameToolById(slug, route.page_id); break;
      case "map": map = await getGameExtendedPageById(slug, route.page_id, "map"); break;
      case "quiz": quiz = await getGameExtendedPageById(slug, route.page_id, "quiz"); break;
      case "catalog": catalog = await getGameExtendedPageById(slug, route.page_id, "catalog"); break;
      case "checklist": checklist = await getGameChecklistById(slug, route.page_id); break;
      default: notFound();
    }
    // By-path readers only matched a page at its own canonical path; keep that guarantee for ID reads.
    const loaded: { canonical_path?: string | null } | null = wiki ?? collection ?? codes ?? tool ?? map ?? quiz ?? catalog ?? checklist;
    if (loaded?.canonical_path && loaded.canonical_path !== basePath) wiki = collection = codes = tool = map = quiz = catalog = checklist = null;
  }
  if (match && !collection) notFound();
  if (!wiki && !collection && !codes && !tool && !map && !quiz && !catalog && !checklist) notFound();
  return { root, path, basePath, currentPage, wiki, collection, codes, tool, map, quiz, catalog, checklist };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await context(params);
  if (ctx.wiki) return gameWikiMetadata(ctx.wiki.game_id === ctx.root.id ? gameRootWikiPage(ctx.root, ctx.wiki) : ctx.wiki);
  if (ctx.collection) {
    return gameCollectionMetadata(ctx.collection, ctx.currentPage);
  }
  if (ctx.tool) {
    const specialized = await specializedMinecraftToolRoute(ctx.root.namespace, ctx.tool.slug);
    return specialized ? specialized.metadata() : gameToolMetadata(ctx.tool);
  }
  if (ctx.quiz) return gameQuizMetadata(ctx.quiz);
  if (ctx.map) {
    const specialized = await specializedGtaMapRoute(ctx.root.namespace, ctx.map.slug);
    return specialized ? specialized.metadata() : gameContentMetadata(ctx.map);
  }
  if (ctx.catalog) return gameContentMetadata(ctx.catalog);
  if (ctx.checklist) return checklistMetadata(ctx.checklist,gameChecklistConfig(ctx.root.namespace, ctx.checklist.canonical_path));
  const image = ctx.codes ? ctx.codes.image : ctx.root.cover_image;
  return { openGraph: { title: ctx.codes?.title || ctx.root.title, url: SITE_URL + ctx.path, images: image ? [image] : [] }, twitter: { card: "summary_large_image", images: image ? [image] : [] }, title: ctx.codes?.seo_title || ctx.codes?.title || ctx.root.title, description: ctx.codes?.meta_description ?? undefined, alternates: buildAlternates(`${SITE_URL}${ctx.path}`) };
}
export default async function SharedGamePage({ params }: Props) {
  const ctx = await context(params);
  if (ctx.wiki) return renderGameWikiPage({ page: ctx.wiki.game_id === ctx.root.id ? gameRootWikiPage(ctx.root, ctx.wiki) : ctx.wiki, namespace: ctx.root.namespace, namespaceTitle: ctx.root.title });
  if (ctx.collection) {
    return renderSharedGameCollection({ page: ctx.collection, namespaceTitle: ctx.root.title, currentPage: ctx.currentPage });
  }
  if (ctx.codes) return <GameCodePage page={ctx.codes} namespaceTitle={ctx.root.title} />;
  if (ctx.tool) {
    const specialized = await specializedMinecraftToolRoute(ctx.root.namespace, ctx.tool.slug);
    if (specialized) return specialized.render();
  }
  if (ctx.tool) return <GameToolPage tool={ctx.tool} namespaceTitle={ctx.root.title} />;
  if (ctx.map) {
    const specialized = await specializedGtaMapRoute(ctx.root.namespace, ctx.map.slug);
    if (specialized) return specialized.render();
  }
  if (ctx.map) { if (ctx.map.renderer_key !== "image-pins") notFound(); return <GameContentPage page={ctx.map}><GameMap data={parseGameMapData(ctx.map.map_data)} /></GameContentPage>; }
  if (ctx.catalog) return <GameContentPage page={ctx.catalog}><GameCatalog data={parseGameCatalogData(ctx.catalog.catalog_data)} /></GameContentPage>;
  if (ctx.quiz) return <GameQuizPage page={ctx.quiz} />;
  if (ctx.checklist) return <ChecklistPageTemplate data={ctx.checklist} config={gameChecklistConfig(ctx.root.namespace, ctx.checklist.canonical_path)} sidebar={<GameRelatedLinks namespace={ctx.root.namespace} gameId={ctx.checklist.game_id} canonicalPath={ctx.checklist.canonical_path} />} />;
  notFound();
}
