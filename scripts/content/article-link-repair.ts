import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { articleLinkRepairBundleSchema, type ArticleLinkRepairBundle } from "../../contracts/article-links/v1/schema";
import { articleFinalSchema } from "../../contracts/article/v1/schema";
import { gameArticleFinalSchema } from "../../contracts/game-article/v1/schema";
import { productionArticleDb } from "../articles/article-production";
import { assertArticleLinks, assertArticleLinksOnlyChange } from "./article-links";
import { assertLocalContentPublication } from "../shared/local-content-publication-guard";
import { bundlePath } from "../shared/roblox-wiki-bundle";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";
import { revalidatePublishedContent } from "../shared/revalidate-published-content";
import { verifyArticleLive } from "./article-publish";
import { resolveGameArticleIdentity } from "./game-article-publish";
import { resolveSeoTitle } from "@/lib/seo";
import type { ContentOptions } from "./wiki-content-options";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
type ArticleKind = "roblox" | "game";
// Identity lives in the hashed baseline as well as final.json. It cannot be edited.
const identity = { id: z.string().min(1), published_at: z.string().min(1) };
const repairFaq = z.array(z.object({ q:z.string().min(1), a:z.string().min(1) }).strict()).nullable().optional();
const robloxRepairFinal = articleFinalSchema.extend({ ...identity, faq_json:repairFaq }).strict();
const gameRepairFinal = gameArticleFinalSchema.extend({ ...identity, faq_json:repairFaq, namespace: z.string().min(1), game_id: z.string().min(1) }).strict();
const finalSchema = (kind: ArticleKind) => kind === "game" ? gameRepairFinal : robloxRepairFinal;
export function liveArticleFinal(row: Record<string, any>, kind: ArticleKind = "roblox") {
  const fields = kind === "game"
    ? ["seo_title", "sources_json", "namespace", "game_id"] : ["universe_id", "sources"];
  return finalSchema(kind).parse(Object.fromEntries(["id", "published_at", "slug", "title", "content_md", "meta_description", "cover_image", "author_id", "tags", "faq_json", "is_published", ...fields].map(key => [key, row[key]])));
}
export function assertLinkRepair(live: Record<string, any>, before: unknown, after: unknown, kind: ArticleKind = "roblox") {
  if (!live.is_published || !live.author_id || !live.published_at || !live.cover_image) throw new Error("Link repair requires a live article with its author, date and cover.");
  assertArticleLinksOnlyChange(before, after);
  const { content_md: _body, faq_json: _faq, ...metadata } = before as any;
  const { content_md: _liveBody, faq_json: _liveFaq, ...liveMetadata } = liveArticleFinal(live, kind);
  assertArticleLinksOnlyChange(metadata, liveMetadata, "live metadata", false);
  const final = after as any;
  // A verified rerun may have already applied the requested markup.
  const alreadyApplied = live.content_md === final.content_md && JSON.stringify(live.faq_json) === JSON.stringify(final.faq_json);
  assertArticleLinksOnlyChange(liveArticleFinal(live, kind), alreadyApplied ? after : before, "live", false);
}
export async function prepareArticleLinkRepair(slug: string, folder: string, db: SupabaseClient = productionArticleDb()) {
  const read = async (table: string) => {
    const { data, error } = await db.from(table).select("*").eq("slug", slug).maybeSingle();
    if (error) throw error; return data;
  };
  const [roblox, gameArticle] = await Promise.all([read("articles"), read("game_article_pages")]);
  if (Boolean(roblox) === Boolean(gameArticle)) throw new Error("Article slug must resolve to exactly one article table.");
  const row = roblox ?? gameArticle;
  if (!row.is_published) throw new Error("Link repair requires a published article.");
  const articleKind = roblox ? "roblox" : "game";
  let owner;
  if (articleKind === "game") {
    const { data, error } = await db.from("games").select("id,namespace,slug,kind").eq("id", row.game_id).eq("namespace", row.namespace).single();
    if (error) throw error; owner = data;
  }
  const final = liveArticleFinal(row, articleKind);
  const bytes = Buffer.from(JSON.stringify(final, null, 2) + "\n");
  const bundle = articleLinkRepairBundleSchema.parse({ contract: "article-links@1", articleKind, slug, finalJson: "final.json", beforeJson: "before.json", beforeSha256: hash(bytes),
    ...(owner ? { namespace: owner.namespace, game: { slug: owner.slug, kind: owner.kind } } : {}) });
  const root = path.resolve(folder);
  await fs.mkdir(root); // Refuse an existing folder, including another writer's files.
  await fs.writeFile(path.join(root, "before.json"), bytes, { flag: "wx" });
  await fs.writeFile(path.join(root, "final.json"), bytes, { flag: "wx" });
  await fs.writeFile(path.join(root, "bundle.json"), JSON.stringify(bundle, null, 2) + "\n", { flag: "wx" });
  return bundle;
}
async function verifyRepairLive(final: any, bundle: ArticleLinkRepairBundle) {
  await verifyArticleLive(final, final.cover_image,
    bundle.articleKind === "game" ? resolveSeoTitle(final.seo_title) ?? final.title : final.title);
}
export async function publishArticleLinkRepair(options: ContentOptions, dependencies: {
  db?: SupabaseClient; guard?: typeof assertLocalContentPublication; checkLinks?: typeof assertArticleLinks;
  revalidate?: typeof revalidatePublishedContent; verify?: typeof verifyRepairLive;
} = {}) {
  if (options.target !== "production" || !options.updatePublished) throw new Error("article-links@1 requires --target production --update-published.");
  if (options.only?.length) throw new Error("Article link repairs do not accept --only.");
  const root = await fs.realpath(path.resolve(options.bundle!));
  const bundle = articleLinkRepairBundleSchema.parse(JSON.parse(await fs.readFile(await bundlePath(root, "bundle.json"), "utf8")));
  const beforeBytes = await fs.readFile(await bundlePath(root, bundle.beforeJson));
  if (hash(beforeBytes) !== bundle.beforeSha256) throw new Error("Link repair baseline hash differs.");
  const before = JSON.parse(beforeBytes.toString("utf8"));
  finalSchema(bundle.articleKind).parse(before);
  const finalInput = JSON.parse(await fs.readFile(await bundlePath(root, bundle.finalJson), "utf8"));
  assertArticleLinksOnlyChange(before, finalInput);
  const final = finalSchema(bundle.articleKind).parse(finalInput);
  if (final.slug !== bundle.slug) throw new Error("Link repair slug differs.");
  const guard = dependencies.guard ?? assertLocalContentPublication;
  await guard();
  const db = dependencies.db ?? productionArticleDb();
  const table = bundle.articleKind === "game" ? "game_article_pages" : "articles";
  let game;
  if (bundle.articleKind === "game") {
    game = await resolveGameArticleIdentity(db, bundle.namespace, bundle.game);
    if ((final as any).namespace !== bundle.namespace || (final as any).game_id !== game.id) throw new Error("Link repair game identity differs.");
  }
  const read = async () => {
    let query = db.from(table).select("*").eq("slug", bundle.slug);
    if (bundle.articleKind === "game") query = query.eq("namespace", bundle.namespace).eq("game_id", game.id);
    const { data, error } = await query.single(); if (error) throw error; return data;
  };
  const live = await read();
  assertLinkRepair(live, before, final, bundle.articleKind);
  await (dependencies.checkLinks ?? assertArticleLinks)(final, bundle.articleKind === "game"
    ? { namespace: bundle.namespace, gameSlug: bundle.game.slug, kind: bundle.game.kind } : { universeId: live.universe_id });
  if (!options.apply) { console.log(`PASS article-links@1 ${bundle.articleKind} preflight; only article link markup may change. No writes.`); return; }
  if (!options.allowProd) throw new Error("Production apply requires --allow-prod.");
  if (!process.env.REVALIDATE_SECRET) throw new Error("Production requires REVALIDATE_SECRET.");
  const unlock = await acquireAgentWorkLock(path.resolve("tmp/content-publish/article"), "article-link-repair");
  if (!unlock) throw new Error("Article publication is busy; retry.");
  try {
    await guard();
    const current = await read();
    if (JSON.stringify(current) !== JSON.stringify(live)) throw new Error("Live article changed during link repair preflight; prepare again.");
    if (live.content_md !== final.content_md || JSON.stringify(live.faq_json) !== JSON.stringify(final.faq_json)) {
      let query = db.from(table).update({ content_md: final.content_md, faq_json: final.faq_json }).eq("id", live.id).eq("updated_at", live.updated_at);
      if (bundle.articleKind === "game") query = query.eq("namespace", bundle.namespace).eq("game_id", game.id);
      const { data, error } = await query.select("*").single(); if (error) throw error;
      assertArticleLinksOnlyChange(liveArticleFinal(data, bundle.articleKind), final, "readback", false);
      for (const field of ["id", "slug", "namespace", "game_id", "author_id", "published_at", "cover_image"]) if (data[field] !== live[field]) throw new Error(`Link repair changed ${field}.`);
    }
    await (dependencies.revalidate ?? revalidatePublishedContent)(process.env, [bundle.articleKind === "game"
      ? { type: "game_content", slug: `articles/${final.slug}` } : { type: "article", slug: final.slug }]);
    await (dependencies.verify ?? verifyRepairLive)(final, bundle);
    console.log(`PASS updated article links: https://bloxodes.com/articles/${final.slug}`);
  } finally { await unlock(); }
}
