// Pre-Phase-4 context and metadata from HEAD, retained as the parity oracle.
import { getGameExtendedPage, getGameChecklistByPath } from "@/lib/game-extra-pages";
import { gameContentMetadata } from "@/components/games/GameContentPage";
import { gameQuizMetadata } from "@/components/games/GameQuizPage";
import { checklistMetadata } from "@/components/ChecklistPageTemplate";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameRoot, getGameWikiByPath, getGameCollectionByPath, getGameCodeByPath, getGameToolByPath } from "@/lib/game-registry";
import { gameWikiMetadata } from "@/components/games/GameWikiPage";
import { gameRootWikiPage } from "@/lib/game-root-page";
import { gameCollectionMetadata } from "@/components/games/GameCollectionPage";
import { gameToolMetadata } from "@/components/games/GameToolPage";
import { buildAlternates, SITE_URL } from "@/lib/seo";

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
  const rootWiki = segments.length ? null : await getGameWikiByPath(slug, `/${slug}/wiki`);
  return { root, rootWiki, path, basePath, segments, currentPage, wiki, collection, codes, tool, map, quiz, catalog, checklist };
}
function checklistConfig(namespace: string) { return { basePath:`/${namespace}/checklists`,title:"Checklists",heading:"Checklists",intro:"",description:"Game completion checklists.",progressNamespace:namespace }; }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await context(params);
  if (ctx.wiki) return gameWikiMetadata(ctx.wiki);
  if (ctx.collection) return gameCollectionMetadata(ctx.collection, ctx.currentPage);
  if (ctx.tool) return gameToolMetadata(ctx.tool);
  if (ctx.quiz) return gameQuizMetadata(ctx.quiz);
  if (ctx.map || ctx.catalog) return gameContentMetadata((ctx.map || ctx.catalog)!);
  if (ctx.checklist) return checklistMetadata(ctx.checklist,checklistConfig(ctx.root.namespace));
  if (!ctx.segments.length && !ctx.codes) return gameWikiMetadata(gameRootWikiPage(ctx.root, ctx.rootWiki));
  const image = ctx.codes ? ctx.codes.image : ctx.root.cover_image;
  return { openGraph: { title: ctx.codes?.title || ctx.root.title, url: SITE_URL + ctx.path, images: image ? [image] : [] }, twitter: { card: "summary_large_image", images: image ? [image] : [] }, title: ctx.codes?.seo_title || ctx.codes?.title || ctx.root.title, description: ctx.codes?.meta_description ?? undefined, alternates: buildAlternates(`${SITE_URL}${ctx.path}`) };
}
