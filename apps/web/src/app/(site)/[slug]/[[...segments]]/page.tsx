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
  const [wiki, collection, codes, tool] = await Promise.all([getGameWikiByPath(slug, basePath), getGameCollectionByPath(slug, basePath), getGameCodeByPath(slug, basePath), getGameToolByPath(slug, basePath)]);
  if (match && !collection) notFound();
  return { root, path, basePath, segments, currentPage, wiki, collection, codes, tool };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await context(params);
  if (ctx.wiki) return gameWikiMetadata(ctx.wiki);
  if (ctx.collection) return gameCollectionMetadata(ctx.collection, ctx.currentPage);
  if (ctx.tool) return gameToolMetadata(ctx.tool);
  return { title: ctx.codes?.seo_title || ctx.codes?.title || ctx.root.title, description: ctx.codes?.meta_description ?? undefined, alternates: buildAlternates(`${SITE_URL}${ctx.path}`) };
}
export default async function SharedGamePage({ params }: Props) {
  const ctx = await context(params);
  if (ctx.wiki) return ctx.wiki.game_kind === "franchise" ? <GameWikiHub page={ctx.wiki} namespaceTitle={ctx.root.title} /> : renderGameWikiPage({ page: ctx.wiki, namespace: ctx.root.namespace, namespaceTitle: ctx.root.title });
  if (ctx.collection) return renderSharedGameCollection({ page: ctx.collection, namespaceTitle: ctx.root.title, currentPage: ctx.currentPage });
  if (ctx.codes) return <GameCodePage page={ctx.codes} namespaceTitle={ctx.root.title} />;
  if (ctx.tool) return <GameToolPage tool={ctx.tool} namespaceTitle={ctx.root.title} />;
  // Directory pages reuse the current plain shell. Homepage and sidebar templates remain deferred.
  if (!ctx.segments.length || (ctx.segments.length === 1 && ["codes", "tools"].includes(ctx.segments[0]))) {
    const tables = ctx.segments.length ? [ctx.segments[0] === "codes" ? "game_code_pages_view" : "game_tool_pages_view"] : ["game_wiki_pages_view", "game_code_pages_view", "game_tool_pages_view"];
    const results = await Promise.all(tables.map(table => supabaseAdmin().from(table).select("id,title,canonical_path").eq("namespace", ctx.root.namespace).eq("is_published", true).order("title")));
    for (const result of results) if (result.error) throw new Error(`Game directory read failed: ${result.error.message}`);
    const pages = results.flatMap(result => result.data ?? []);
    if (ctx.segments.length && !pages.length) notFound();
    const html = ctx.segments.length ? "" : await renderMarkdown(ctx.root.description_md ?? "");
    return <div className="space-y-8"><PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: ctx.root.title, href: ctx.segments.length ? `/${ctx.root.namespace}` : null }, ...(ctx.segments.length ? [{ label: ctx.segments[0], href: null }] : [])]} /><h1 className="text-4xl font-semibold">{ctx.root.title}{ctx.segments.length ? ` ${ctx.segments[0]}` : ""}</h1><article id="article-body" className="journey-content-stream journey-content-stream--index space-y-6"><div className="article-content md-copy-scope">{renderPageContentNodes(html, `${ctx.root.namespace}-intro`)}</div>{pages.map(page => <p key={page.id} data-journey-item><Link className="text-accent underline underline-offset-4" href={page.canonical_path}>{page.title}</Link></p>)}</article></div>;
  }
  notFound();
}
