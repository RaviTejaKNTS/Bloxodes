import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bundleSchema } from "../../contracts/game-article/v1/schema";
import type { ContentOptions } from "./wiki-content-options";
import { bundlePath } from "../shared/roblox-wiki-bundle";
import { readPublishQuery, retryPublishNetwork } from "../shared/publish-network.mjs";

type Bundle = { slug: string; namespace: string; game: { slug: string; kind: string } };
type Row = Record<string, any>;

// Everything except these must be identical before and after the write.
const CHANGED_FIELDS = new Set(["is_published", "updated_at"]);

export type UnpublishDeps = {
  db: SupabaseClient;
  target: ContentOptions["target"];
  apply: boolean;
  log?: (line: string) => void;
  // Production only: guards, lock, cache revalidation and the live 404 check.
  assertPublication?: () => Promise<void>;
  lock?: () => Promise<(() => Promise<void>) | null>;
  revalidate?: (slug: string) => Promise<void>;
  verifyGone?: (url: string) => Promise<void>;
};

async function read(query: () => PromiseLike<any>) {
  const result = await readPublishQuery(query);
  return result.data;
}

// Read the owning game, the article row and its route, and refuse anything
// that is not an article of this bundle's game. An already-unpublished row the
// bundle owns is allowed so a rerun can repeat the checks after a failed step.
export async function unpublishPreflight(db: SupabaseClient, bundle: Bundle) {
  const game = await read(() => db.from("games").select("id,namespace,slug,kind").eq("namespace", bundle.namespace).eq("slug", bundle.game.slug).eq("kind", bundle.game.kind).maybeSingle());
  if (!game) throw new Error(`Owning game ${bundle.namespace}/${bundle.game.slug} (${bundle.game.kind}) does not exist.`);
  const current: Row | null = await read(() => db.from("game_article_pages").select("*").eq("slug", bundle.slug).maybeSingle());
  if (!current) throw new Error(`Game article ${bundle.slug} does not exist; nothing to unpublish.`);
  if (current.namespace !== bundle.namespace || current.game_id !== game.id) throw new Error("Article slug belongs to another game; refusing to unpublish.");
  if (current.is_published !== true && current.is_published !== false) throw new Error(`Game article ${bundle.slug} has no published state; refusing to unpublish.`);
  const route = await read(() => db.from("site_routes").select("source,page_type,page_id,game_id,status").eq("path", `/articles/${bundle.slug}`).maybeSingle());
  if (route && (route.source !== "game" || route.page_type !== "article" || route.page_id !== current.id)) throw new Error("Article route is owned by another page; refusing to unpublish.");
  return { game, current, route, alreadyUnpublished: current.is_published === false };
}

export async function unpublishGameArticle(bundle: Bundle, deps: UnpublishDeps) {
  const log = deps.log ?? console.log;
  const url = `https://bloxodes.com/articles/${bundle.slug}`;
  const { game, current, route, alreadyUnpublished } = await unpublishPreflight(deps.db, bundle);
  if (alreadyUnpublished) log(`Plan: ${bundle.slug} (id ${current.id}, ${bundle.namespace}/${game.slug}) is already unpublished. Apply skips the write and only re-verifies readback, revalidation and the live 404.`);
  else log(`Plan: set game_article_pages.is_published=false for ${bundle.slug} (id ${current.id}, ${bundle.namespace}/${game.slug}). Content, author, cover and published_at stay. Route ${route ? `/articles/${bundle.slug} (${route.status})` : "none"} stays reserved for this article.`);
  if (!deps.apply) {
    log("PASS game-article@1 unpublish preflight; no writes.");
    return { applied: false as const, id: current.id };
  }
  if (deps.target === "production") {
    if (!deps.assertPublication || !deps.revalidate || !deps.verifyGone || !deps.lock) throw new Error("Production unpublish requires publication guard, lock, revalidation and live checks.");
    await deps.assertPublication();
  }
  const unlock = deps.lock ? await deps.lock() : async () => {};
  if (!unlock) throw new Error("Article publication is busy; retry.");
  try {
    const latest = await unpublishPreflight(deps.db, bundle);
    if (!isDeepStrictEqual(latest.current, current)) throw new Error("Live game article changed during unpublish preflight; retry.");
    if (alreadyUnpublished) {
      log(`Skip write: ${bundle.slug} is already unpublished; repeating the checks only.`);
    } else {
      // Not retried: a mutation must run once. The filters make it a no-op if the row moved.
      let update = deps.db.from("game_article_pages").update({ is_published: false })
        .eq("id", current.id).eq("namespace", bundle.namespace).eq("game_id", game.id).eq("is_published", true);
      if (current.updated_at) update = update.eq("updated_at", current.updated_at);
      const written = await update.select("*").maybeSingle();
      if (written.error) throw written.error;
      if (!written.data) throw new Error("Game article changed before write; nothing was unpublished. Retry.");
    }
    // Read back from the table, not the write response.
    const stored: Row = await read(() => deps.db.from("game_article_pages").select("*").eq("id", current.id).single());
    if (stored.is_published !== false) throw new Error("Readback: game article is still published.");
    for (const field of Object.keys(current)) {
      if (!CHANGED_FIELDS.has(field) && !isDeepStrictEqual(stored[field], current[field])) throw new Error(`Readback: ${field} changed during unpublish.`);
    }
    const visible = await read(() => deps.db.from("game_article_pages_view").select("id").eq("id", current.id).maybeSingle());
    if (visible) throw new Error("Readback: game article is still in game_article_pages_view.");
    const listed = await read(() => deps.db.from("search_index").select("is_published").eq("entity_type", "game_article").eq("entity_id", current.id).maybeSingle());
    if (listed?.is_published) throw new Error("Readback: search_index still lists the article as published.");
    log(`PASS readback: ${bundle.slug} is_published=false and out of game_article_pages_view.`);
    if (deps.target === "production") {
      await deps.revalidate!(bundle.slug);
      await deps.verifyGone!(url);
    }
    log(`PASS ${alreadyUnpublished ? "re-verified unpublished" : "unpublished"} game article: ${url}`);
    return { applied: true as const, id: current.id, wrote: !alreadyUnpublished };
  } finally { await unlock(); }
}

// The article page renders only rows in game_article_pages_view, so a removed
// article must answer 404 once its cache is revalidated.
export async function verifyGameArticleGone(url: string, { attempts = 5, delayMs = 2000, fetchPage = fetch }: { attempts?: number; delayMs?: number; fetchPage?: typeof fetch } = {}) {
  for (let attempt = 1; ; attempt++) {
    const response = await retryPublishNetwork(() => fetchPage(url, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30_000) }));
    await response.body?.cancel().catch(() => {});
    if (response.status === 404 || response.status === 410) { console.log(`PASS live article gone: ${url} (HTTP ${response.status})`); return; }
    if (attempt >= attempts) throw new Error(`Unpublished article still answers HTTP ${response.status} at ${url}.`);
    await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
  }
}

export async function unpublishGameArticleBundle(options: ContentOptions) {
  if (options.updatePublished || options.only?.length || options.approvedHubCoverSha256) throw new Error("--unpublish takes no --update-published, --only or cover approval flags.");
  if (options.target === "production" && options.apply && !options.allowProd) throw new Error("Production apply requires --allow-prod.");
  const root = await fs.realpath(path.resolve(options.bundle!));
  const bundle = bundleSchema.parse(JSON.parse(await fs.readFile(await bundlePath(root, "bundle.json"), "utf8")));
  console.log(`${options.apply ? "Apply" : "Dry run"}: game-article@1 unpublish, ${bundle.namespace}/${bundle.slug}, target=${options.target}`);
  const { assertLocalContentPublication } = await import("../shared/local-content-publication-guard");
  if (options.target === "production") await assertLocalContentPublication();
  if (options.target === "production" && options.apply && !process.env.REVALIDATE_SECRET) throw new Error("Production unpublish needs REVALIDATE_SECRET.");
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { acquireAgentWorkLock } = await import("../shared/agent-work-lock");
  const { revalidatePublishedContent } = await import("../shared/revalidate-published-content");
  await unpublishGameArticle(bundle, {
    db, target: options.target, apply: options.apply,
    assertPublication: assertLocalContentPublication,
    lock: () => acquireAgentWorkLock(path.resolve("tmp/content-publish/article"), "direct-game-article-unpublish"),
    // Same event as publish: the route row stays, so it expands to the article
    // page, /articles, the game archive, author pages, home, feed and sitemaps.
    revalidate: slug => revalidatePublishedContent(process.env, [{ type: "game_content", slug: `articles/${slug}` }]),
    verifyGone: url => verifyGameArticleGone(url),
  });
}
