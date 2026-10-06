import { getGameExtendedPage, getGameChecklistByPath } from "@/lib/game-extra-pages";
import { gameContentMetadata, GameContentPage } from "@/components/games/GameContentPage";
import { GameMap } from "@/components/games/GameMap";
import { GameCatalog } from "@/components/games/GameCatalog";
import { GameQuizPage } from "@/components/games/GameQuizPage";
import { ChecklistPageTemplate, checklistMetadata } from "@/components/ChecklistPageTemplate";
import { parseGameMapData, parseGameCatalogData } from "@/lib/game-page-data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameRoot, getGameWikiByPath, getGameCollectionByPath, getGameCodeByPath, getGameToolByPath } from "@/lib/game-registry";
import { gameWikiMetadata, renderGameWikiPage } from "@/components/games/GameWikiPage";
import { GameWikiHub } from "@/components/games/GameWikiHub";
import { gameCollectionMetadata, renderSharedGameCollection } from "@/components/games/GameCollectionPage";
import { GameCodePage } from "@/components/games/GameCodePage";
import { GameToolPage, gameToolMetadata } from "@/components/games/GameToolPage";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { supabaseAdmin } from "@/lib/supabase";
import { buildAlternates, SITE_URL } from "@/lib/seo";
import { renderMarkdown } from "@/lib/markdown";
import { renderPageContentNodes } from "@/lib/page-content";

export const revalidate = 3600;
type Props = { params: Promise<{ slug: string; segments?: string[] }> };
async function context(params: Props["params"]) {
  const { slug, segments = [] } = await params;
  const root = await getGameRoot(slug);
  if (!root) notFound();
  const path = `/${[slug, ...segments].join("/")}`;
  const match = /\/page\/([1-9]\d*)$/.exec(path);
  const currentPage = match ? Number(match[1]) : 1;
  const basePath = match ? path.slice(0, match.index) : path;
  if (!Number.isSafeInteger(currentPage)) notFound();
  const [wiki, collection, codes, tool, map, quiz, catalog, checklist] = await Promise.all([getGameWikiByPath(slug, basePath), getGameCollectionByPath(slug, basePath), getGameCodeByPath(slug, basePath), getGameToolByPath(slug, basePath), getGameExtendedPage(slug,basePath,"map"),getGameExtendedPage(slug,basePath,"quiz"),getGameExtendedPage(slug,basePath,"catalog"),getGameChecklistByPath(slug,basePath)]);
  if (match && !collection) notFound();
  return { root, path, basePath, segments, currentPage, wiki, collection, codes, tool, map, quiz, catalog, checklist };
}
function checklistConfig(namespace: string) { return { basePath:`/${namespace}/checklists`,title:"Checklists",heading:"Checklists",intro:"",description:"Game completion checklists.",progressNamespace:namespace }; }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await context(params);
  if (ctx.wiki) return gameWikiMetadata(ctx.wiki);
  if (ctx.collection) return gameCollectionMetadata(ctx.collection, ctx.currentPage);
  if (ctx.tool) return gameToolMetadata(ctx.tool);
  if (ctx.map || ctx.quiz || ctx.catalog) return gameContentMetadata((ctx.map || ctx.quiz || ctx.catalog)!);
  if (ctx.checklist) return checklistMetadata(ctx.checklist,checklistConfig(ctx.root.namespace));
  return { title: ctx.codes?.seo_title || ctx.codes?.title || ctx.root.title, description: ctx.codes?.meta_description ?? undefined, alternates: buildAlternates(`${SITE_URL}${ctx.path}`) };
}
export default async function SharedGamePage({ params }: Props) {
  const ctx = await context(params);
  if (ctx.wiki) return ctx.wiki.game_kind === "franchise" ? <GameWikiHub page={ctx.wiki} namespaceTitle={ctx.root.title} /> : renderGameWikiPage({ page: ctx.wiki, namespace: ctx.root.namespace, namespaceTitle: ctx.root.title });
  if (ctx.collection) return renderSharedGameCollection({ page: ctx.collection, namespaceTitle: ctx.root.title, currentPage: ctx.currentPage });
  if (ctx.codes) return <GameCodePage page={ctx.codes} namespaceTitle={ctx.root.title} />;
  if (ctx.tool) return <GameToolPage tool={ctx.tool} namespaceTitle={ctx.root.title} />;
  if (ctx.map) { if (ctx.map.renderer_key !== "image-pins") notFound(); return <GameContentPage page={ctx.map}><GameMap data={parseGameMapData(ctx.map.map_data)} /></GameContentPage>; }
  if (ctx.catalog) return <GameContentPage page={ctx.catalog}><GameCatalog data={parseGameCatalogData(ctx.catalog.catalog_data)} /></GameContentPage>;
  if (ctx.quiz) return <GameQuizPage page={ctx.quiz} />;
  if (ctx.checklist) return <ChecklistPageTemplate data={ctx.checklist} config={checklistConfig(ctx.root.namespace)} />;
  // Directory pages reuse the current plain shell. Homepage and sidebar templates remain deferred.
  if (!ctx.segments.length || (ctx.segments.length === 1 && ["codes", "tools", "maps", "quizzes", "checklists", "catalog"].includes(ctx.segments[0]))) {
    const sectionTables: Record<string,string> = {codes:"game_code_pages_view",tools:"game_tool_pages_view",maps:"game_map_pages_view",quizzes:"game_quiz_pages_view",catalog:"game_catalog_pages_view",checklists:"game_checklist_pages_view"};
    const tables = ctx.segments.length ? [sectionTables[ctx.segments[0]]] : ["game_wiki_pages_view",...Object.values(sectionTables)];
    const results = await Promise.all(tables.map(table => {
      let query = supabaseAdmin().from(table).select("id,title,canonical_path").eq("namespace",ctx.root.namespace).order("title");
      return table === "game_checklist_pages_view" ? query : query.eq("is_published",true);
    }));
    for (const result of results) if (result.error) throw new Error(`Game directory read failed: ${result.error.message}`);
    const pages = results.flatMap(result => result.data ?? []);
    if (ctx.segments.length && !pages.length) notFound();
    const html = ctx.segments.length ? "" : await renderMarkdown(ctx.root.description_md ?? "");
    return <div className="space-y-8"><PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: ctx.root.title, href: ctx.segments.length ? `/${ctx.root.namespace}` : null }, ...(ctx.segments.length ? [{ label: ctx.segments[0], href: null }] : [])]} /><h1 className="text-4xl font-semibold">{ctx.root.title}{ctx.segments.length ? ` ${ctx.segments[0]}` : ""}</h1><article id="article-body" className="journey-content-stream journey-content-stream--index space-y-6"><div className="article-content md-copy-scope">{renderPageContentNodes(html, `${ctx.root.namespace}-intro`)}</div>{pages.map(page => <p key={page.id} data-journey-item><Link className="text-accent underline underline-offset-4" href={page.canonical_path}>{page.title}</Link></p>)}</article></div>;
  }
  notFound();
}
