import { setTimeout as delay } from "node:timers/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { productionArticleDb, productionRows } from "./article-production";
import { fetchProductionEditorialInventory, inventoryPublicPath, type ProductionInventoryItem } from "./production-editorial-inventory";
import { scopeMatches, type ArticleScope } from "./article-topic-similarity";

export type RelatedArticlePage = { title: string; page_type: string; url: string; published_at?: string | null };
export class ArticleLinkAvailabilityError extends Error {
  constructor(url: string, detail: string) { super(`Couldn't verify ${url} (${detail}); try again. This is an availability error.`); }
}
export async function directProductionStatus(url: string, request: typeof fetch = fetch, options: { backoffMs?: number; attemptTimeoutMs?: number } = {}) {
  let detail = "transport error";
  const deadline = Date.now() + 25_000;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(Math.max(1, Math.min(options.attemptTimeoutMs ?? 8_000, deadline - Date.now()))), headers: { "User-Agent": "BloxodesArticleLinks/1.0" } });
      const result = { status: response.status, location: response.headers.get("location") };
      await response.body?.cancel();
      if (result.status !== 429 && result.status < 500) return result;
      detail = `HTTP ${result.status}`;
    } catch (error) { detail = error instanceof Error ? error.message : String(error); }
    if (attempt < 2 && Date.now() < deadline) await delay(Math.min((options.backoffMs ?? 250) * 2 ** attempt, Math.max(0, deadline - Date.now())));
    if (Date.now() >= deadline) break;
  }
  throw new ArticleLinkAvailabilityError(url, detail);
}
const priority: Record<string, number> = { wiki: 0, franchise: 0, codes: 1, collection: 2, article: 3 };
export function orderRelatedPages(pages: RelatedArticlePage[], excludeSlug?: string) {
  const unique = [...new Map(pages.filter(p => new URL(p.url).pathname !== `/articles/${excludeSlug}`).map(p => [p.url,p])).values()];
  unique.sort((a,b) => (priority[a.page_type] ?? 4)-(priority[b.page_type] ?? 4) ||
    (a.page_type === "article" && b.page_type === "article" ? (b.published_at ?? "").localeCompare(a.published_at ?? "") : a.title.localeCompare(b.title)));
  let articles = 0;
  return unique.filter(p => p.page_type !== "article" || ++articles <= 15);
}
export async function articleRelatedCandidates(scope: ArticleScope, db: SupabaseClient = productionArticleDb(), inventory?: ProductionInventoryItem[]): Promise<RelatedArticlePage[]> {
  if(!scope.namespace && scope.universeId == null)return [];
  const items = inventory ?? (await fetchProductionEditorialInventory({includeGames:Boolean(scope.namespace)})).items;
  const pages: RelatedArticlePage[] = items.filter(i => scopeMatches(scope,i)).flatMap(i => {
    const route = inventoryPublicPath(i,items); return route ? [{title:i.title,page_type:i.family,url:`https://bloxodes.com${route}`}] : [];
  });
  if (!scope.namespace) {
    const articles = await productionRows(db,"articles","id,title,slug,published_at",q => q.eq("is_published",true).eq("universe_id",scope.universeId!).lte("published_at",new Date().toISOString()));
    for (const row of articles) pages.push({title:row.title,page_type:"article",url:`https://bloxodes.com/articles/${row.slug}`,published_at:row.published_at});
    // Replace inventory article entries so ordering always has publication dates.
    return pages.filter(p => p.page_type !== "article" || p.published_at !== undefined);
  }
  const games = await productionRows(db,"games","id,namespace,slug,kind,parent_id",q => q.eq("is_published",true).eq("namespace",scope.namespace));
  const matches = games.filter(g => g.slug === scope.gameSlug && (!scope.kind || g.kind === scope.kind));
  if (matches.length !== 1) throw new Error("Game identity must resolve to one published game; supply --kind if needed.");
  const game = matches[0];
  const configs = [["wiki","game_wiki_pages_view"],["collection","game_collection_pages_view"],["codes","game_code_pages_view"],["tool","game_tool_pages_view"],["checklist","game_checklist_pages_view"],["quiz","game_quiz_pages_view"],["catalog","game_catalog_pages_view"],["map","game_map_pages_view"],["article","game_article_pages_view"]];
  for (const [family,table] of configs) {
    const rows = await productionRows(db,table,"*",q => q.eq("game_id",game.id));
    for (const row of rows) if (row.canonical_path) pages.push({title:row.title,page_type:family,url:`https://bloxodes.com${row.canonical_path}`,published_at:row.published_at});
  }
  if (game.parent_id) {
    const hubs = await productionRows(db,"game_wiki_pages_view","*",q => q.eq("game_id",game.parent_id));
    for (const hub of hubs) pages.push({title:hub.title,page_type:"franchise",url:`https://bloxodes.com${hub.canonical_path}`});
  }
  return pages;
}
export async function relatedArticlePages(scope: ArticleScope, excludeSlug?: string, dependencies: { candidates?: RelatedArticlePage[]; status?: typeof directProductionStatus } = {}): Promise<RelatedArticlePage[]> {
  const candidates = orderRelatedPages(dependencies.candidates ?? await articleRelatedCandidates(scope),excludeSlug);
  const live: RelatedArticlePage[] = [];
  // Bound concurrency and fail on transport errors rather than pretending no pages exist.
  for (let offset = 0; offset < candidates.length; offset += 6) {
    const batch = await Promise.all(candidates.slice(offset,offset+6).map(async page => ({page,...await (dependencies.status ?? directProductionStatus)(page.url)})));
    live.push(...batch.filter(r => r.status === 200).map(r => r.page));
  }
  return live;
}
