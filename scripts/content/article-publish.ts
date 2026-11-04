import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { load } from "cheerio";
import sharp from "sharp";
import { articleFinalSchema, bundleSchema, type ArticleFinal } from "../../contracts/article/v1/schema";
import type { ContentOptions } from "./wiki-content-options";
import { bundlePath } from "../shared/roblox-wiki-bundle";
import { assertEditorialSlug } from "../shared/editorial-slugs";
import { publicCopyFindings } from "./check-public-copy";
import { assertArticleImageReadiness, checkArticleImageReadiness, readArticleImageManifest, findArticleImages, usedVerifiedArticleImages, type ArticleImageManifest } from "./article-image-readiness";
import { assertNoArticleMediaErrors, checkArticleMedia } from "./check-article-media";
import { assertArticleUniverseReadback } from "./article-final-readback";
import { findYouTubeDirectives } from "@/lib/article-media";
import { resolveOfficialArticleGame } from "../articles/article-game-identity";
import { resolveArticleDevCredentials } from "../articles/article-queue-env";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";
import { assertLocalContentPublication } from "../shared/local-content-publication-guard";
import { retryPublishNetwork, requirePublishResponse } from "../shared/publish-network.mjs";
import { fetchImageBytes } from "../shared/fetch-image-bytes";
import { revalidatePublishedContent } from "../shared/revalidate-published-content";

const json = async (file: string) => JSON.parse(await fs.readFile(file, "utf8"));
const client = (url: string, key: string) => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(30_000) }) },
});
const read = async <T>(work: () => PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> => retryPublishNetwork(async () => {
  const result = await work(); if (result.error) throw new Error(result.error.message); return result.data;
});
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
type QueueRow = { id: string; workflow_mode: string; status: string; result_slug: string | null; result_path: string | null; production_url: string | null };
export function assertArticleQueue(row: QueueRow | null, slug: string) {
  if (!row || row.workflow_mode !== "agent_runner" || !["completed", "published"].includes(row.status) || row.result_slug !== slug || !row.result_path) throw new Error("Article requires its matching completed/published agent_runner queue result.");
  if (row.status === "published" && row.production_url !== `https://bloxodes.com/articles/${slug}`) throw new Error("Published queue URL differs from bundle slug.");
}

// Same fields as articles:queue:update published; preserve result and completion evidence.
export async function acknowledgeArticleQueue(db: SupabaseClient, row: QueueRow, slug: string) {
  assertArticleQueue(row, slug);
  if (row.status === "published") return;
  const now = new Date().toISOString();
  const result = await db.from("article_generation_queue").update({
    status: "published", updated_at: now, published_at: now, rejected_at: null,
    production_url: `https://bloxodes.com/articles/${slug}`, outcome_reason: null, last_error: null,
    locked_at: null, locked_by: null, next_attempt_at: null,
  }).eq("id", row.id).eq("workflow_mode", "agent_runner").eq("status", row.status)
    .eq("result_slug", slug).eq("result_path", row.result_path!).select("id");
  if (result.error || result.data?.length !== 1) throw new Error("Article queue changed before acknowledgement; inspect and rerun the same bundle.");
  const saved = await read(() => db.from("article_generation_queue").select("*").eq("id", row.id).single());
  assertArticleQueue(saved, slug);
  if (saved.status !== "published") throw new Error("Article queue acknowledgement readback failed.");
}

// Verification must finish before acknowledgement. An exception leaves the row retryable.
export async function completeArticlePublication(db: SupabaseClient, row: QueueRow, slug: string, verify: () => Promise<void>) {
  await verify();
  await acknowledgeArticleQueue(db, row, slug);
}

// The importer stores content_md as given, so compare bodies the way the old publisher does.
const normalizedBody = (value: unknown) => String(value ?? "").replace(/\r\n/g, "\n").trim();
export function articleReadbackMismatch(stored: Record<string, unknown>, final: ArticleFinal) {
  if (normalizedBody(stored.content_md) !== normalizedBody(final.content_md)) return "content_md";
  for (const [key, expected] of Object.entries({ title: final.title, slug: final.slug, meta_description: final.meta_description ?? null, tags: final.tags ?? [], sources: final.sources ?? [], faq_json: final.faq_json ?? [], is_published: true })) {
    if (stable(stored[key]) !== stable(expected)) return key;
  }
  return null;
}

export const isDevelopmentCover = (cover: string | null | undefined, devUrl: string) =>
  Boolean(cover) && new URL(cover!, "https://bloxodes.com").origin === new URL(devUrl).origin;

async function articleReadback(db: SupabaseClient, final: ArticleFinal, manifest: ArticleImageManifest, production: boolean) {
  const stored = await read(() => db.from("articles").select("*").eq("slug", final.slug).single());
  const mismatch = articleReadbackMismatch(stored, final);
  if (mismatch) throw new Error(`Article readback mismatch: ${mismatch}`);
  assertArticleUniverseReadback(stored.universe_id, final.universe_id, final.slug);
  if (!stored.cover_image || !stored.author_id) throw new Error("Article readback has no cover or author.");
  if (production) {
    const { assertProductionSnapshot } = await import("../articles/release-completed-articles");
    const provenance = await read(() => db.from("article_source_images").select("public_url,uploaded_path,original_url").eq("article_id", stored.id));
    assertProductionSnapshot({ finalJson: { ...final, content_md: final.content_md.trim() }, manifest, article: stored, provenance });
  }
  return stored;
}

export async function verifyArticleAssets(final: ArticleFinal, cover?: string | null) {
  const images = [...new Set([...findArticleImages(final.content_md).map(image => image.src), ...(cover ? [cover] : [])])];
  for (const src of images) await retryPublishNetwork(async () => {
    const response = await fetch(new URL(src, "https://bloxodes.com"), { signal: AbortSignal.timeout(30_000) });
    await requirePublishResponse(response, "Article image");
    if (!response.headers.get("content-type")?.startsWith("image/")) throw new Error("Article asset is not an image.");
    await sharp(Buffer.from(await response.arrayBuffer())).raw().toBuffer();
  });
  for (const { videoId } of findYouTubeDirectives(final.content_md)) {
    if (!videoId) throw new Error("Invalid article video embed.");
    await retryPublishNetwork(async () => {
      const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      await requirePublishResponse(response, "Article video");
      const payload = await response.json();
      if (payload.type !== "video" || !String(payload.html).includes(`/embed/${videoId}`)) throw new Error(`Video ${videoId} does not resolve as an embeddable video.`);
    });
  }
  console.log(`PASS decodable images (${images.length}) and resolvable video embeds`);
}

export async function verifyArticleLive(final: ArticleFinal, cover: string) {
  const url = `https://bloxodes.com/articles/${final.slug}`;
  await retryPublishNetwork(async () => {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    await requirePublishResponse(response, "Live article");
    if (response.status !== 200 || response.url.replace(/\/$/, "") !== url) throw new Error("Live article must return HTTP 200 without a redirect.");
    const html = load(await response.text());
    const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
    if (html("h1").length !== 1 || normalize(html("h1").text()) !== normalize(final.title) || !html("title").text().includes(final.title)) throw new Error("Live article titles differ from final.json.");
    if (!html("#article-body").text().trim() || /application error|unhandled runtime error|internal server error/i.test(html("body").text())) throw new Error("Live article body is empty or reports an application error.");
    if (html('link[rel="canonical"]').attr("href") !== url || !html('meta[name="description"]').attr("content")?.trim()) throw new Error("Live canonical or description is missing or incorrect.");
    // The article page shows its cover in the social image tags, not as an <img>.
    if (html('meta[property="og:image"]').attr("content") !== new URL(cover, url).href) throw new Error("Live cover is missing.");
    const matches = (src: string, expected: string) => src === expected || new URL(src || "/", url).searchParams.get("url") === expected;
    const bodySources = html("#article-body img").map((_, el) => html(el).attr("src") ?? "").get();
    for (const image of findArticleImages(final.content_md)) if (!bodySources.some(src => matches(src, image.src))) throw new Error("Live body image is missing.");
    for (const { videoId } of findYouTubeDirectives(final.content_md)) {
      if (!html("#article-body iframe").toArray().some(el => html(el).attr("src")?.includes(`youtube-nocookie.com/embed/${videoId}`))) throw new Error("Live video embed is missing.");
    }
    // Include every rendered body image, even images not recorded by authoring helpers.
    await verifyArticleAssets({ ...final, content_md: bodySources.map(src => `![Rendered image](${new URL(src, url).href})`).join("\n") }, cover);
  });
  console.log(`PASS live article: ${url}`);
}

export async function publishArticleBundle(options: ContentOptions) {
  if (options.only?.length || options.approvedHubCoverSha256) throw new Error("Article bundles do not accept wiki selection or cover approval flags.");
  if (options.target === "production" && options.apply && !options.allowProd) throw new Error("Production apply requires --allow-prod.");
  const root = await fs.realpath(path.resolve(options.bundle!));
  const bundle = bundleSchema.parse(await json(await bundlePath(root, "bundle.json")));
  const finalPath = await bundlePath(root, bundle.finalJson);
  const mediaPath = await bundlePath(root, bundle.mediaJson);
  const finalBytes = await fs.readFile(finalPath);
  const final = articleFinalSchema.parse(JSON.parse(finalBytes.toString("utf8")));
  if (final.slug !== bundle.slug) throw new Error("Article final slug differs from bundle slug.");
  assertEditorialSlug(final.slug, "articles.slug", final.universe_id ?? null, { matchAnyTrailingId: false });
  console.log(`${options.apply ? "Apply preflight" : "Dry run"}: article@1, ${bundle.slug}, target=${options.target}`);
  if (options.target === "production") await assertLocalContentPublication();
  if (options.apply && !process.env.SUPABASE_MEDIA_BUCKET?.trim()) throw new Error("Article apply requires SUPABASE_MEDIA_BUCKET.");
  if (options.target === "production" && new URL(process.env.SUPABASE_MEDIA_PUBLIC_URL || "https://invalid.example").origin !== "https://media.bloxodes.com") throw new Error("Production requires SUPABASE_MEDIA_PUBLIC_URL=https://media.bloxodes.com.");
  const db = client(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
  const dev = options.target === "managed-dev" ? { url: process.env.SUPABASE_URL!, serviceRole: process.env.SUPABASE_SERVICE_ROLE! } : resolveArticleDevCredentials({ envFile: process.env.ARTICLE_DEV_ENV_FILE || path.resolve(".envs/targets/managed-dev.env") });
  const queueDb = options.target === "managed-dev" ? db : client(dev.url, dev.serviceRole);
  const queue = await read(() => queueDb.from("article_generation_queue").select("*").eq("id", bundle.queueId).single()) as QueueRow;
  assertArticleQueue(queue, final.slug);
  // Do not claim completion of a different file than the queue approved.
  if (queue.status !== "published") {
    const approved = await fs.readFile(path.resolve(queue.result_path!));
    if (!approved.equals(finalBytes)) throw new Error("Bundle final bytes differ from the completed queue result_path.");
  }
  let game: Awaited<ReturnType<typeof resolveOfficialArticleGame>>["game"] = null;
  if (final.universe_id) {
    const existing = await read(() => db.from("roblox_universes").select("universe_id").eq("universe_id", final.universe_id!).maybeSingle());
    if (!existing) {
      game = (await resolveOfficialArticleGame(final.universe_id)).game;
      if (!game || game.id !== final.universe_id) throw new Error("Article universe identity could not be confirmed unchanged.");
    }
  }
  const findings = publicCopyFindings(final, finalPath);
  if (findings.length) throw new Error(findings.map(f => `${f.field}: ${f.rule}: ${f.excerpt}`).join("\n"));
  const manifest = await readArticleImageManifest(mediaPath);
  const imageEnv = { ...process.env, SUPABASE_URL: dev.url };
  assertArticleImageReadiness(checkArticleImageReadiness({ manifest, finalJson: final, env: imageEnv }), mediaPath);
  // Keep source media validation separate from target credentials until promotion.
  assertNoArticleMediaErrors(await checkArticleMedia({ ...final, env: imageEnv, requireLocalFiles: true }));
  if (final.cover_image && findArticleImages(final.content_md).some(image => image.src === final.cover_image)) throw new Error("Article cover must not repeat a body image.");
  await verifyArticleAssets(final, final.cover_image);
  console.log("PASS article schema, slug, queue, game identity, copy, image readiness and media checks");
  if (!options.apply) { console.log("PASS all checks. Dry run complete; no database or media writes."); return; }
  const unlock = await acquireAgentWorkLock(path.resolve("tmp/article-publication"), "direct-article-publish");
  if (!unlock) throw new Error("Publication outbox is busy; retry after it finishes.");
  let staging: string | undefined;
  try {
    const currentQueue = await read(() => queueDb.from("article_generation_queue").select("*").eq("id", bundle.queueId).single()) as QueueRow;
    if (stable(currentQueue) !== stable(queue)) throw new Error("Queue row changed during preflight; rerun the bundle.");
    const intent = await json(path.resolve("tmp/article-publication", `${bundle.queueId}.json`)).catch(error => { if (error.code !== "ENOENT") throw error; return null; });
    if (intent?.dispatchHash && !intent.publishedAt && queue.status !== "published") throw new Error("An old GitHub dispatch exists for this row. Resolve it before direct publication.");
    if (options.target === "production") {
      if (!process.env.REVALIDATE_SECRET) throw new Error("Production requires REVALIDATE_SECRET.");
      await assertLocalContentPublication();
    }
    if (options.target === "production" && queue.status === "published") {
      const expected = structuredClone(final);
      const expectedManifest = structuredClone(manifest);
      for (const entry of usedVerifiedArticleImages(expectedManifest, expected.content_md)) {
        if (!entry.public_url || entry.public_url.startsWith("/")) continue;
        const url = `https://media.bloxodes.com/storage/v1/object/public/${process.env.SUPABASE_MEDIA_BUCKET}/${entry.uploaded_path}`;
        expected.content_md = expected.content_md.split(entry.public_url).join(url);
        entry.public_url = url;
      }
      const stored = await articleReadback(db, expected, expectedManifest, true);
      await verifyArticleAssets(expected, stored.cover_image);
      await revalidatePublishedContent(process.env, [{ type: "article", slug: final.slug }]);
      await verifyArticleLive(expected, stored.cover_image);
      console.log(`PASS already published: https://bloxodes.com/articles/${final.slug}`);
      return;
    }
    await fs.mkdir(path.resolve("tmp/article-direct"), { recursive: true });
    staging = await fs.mkdtemp(path.resolve("tmp/article-direct/run-"));
    const stagedFinal = path.join(staging, "final.json");
    const stagedMedia = path.join(staging, "media.json");
    await fs.writeFile(stagedFinal, JSON.stringify(final)); await fs.writeFile(stagedMedia, JSON.stringify(manifest));
    if (game) {
      const result = await db.from("roblox_universes").upsert({ universe_id: game.id, root_place_id: game.rootPlaceId, name: game.name, slug: `${game.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${game.id}`, stats_tier: "NEW", stats_tier_reason: "article_identity_preflight" }, { onConflict: "universe_id", ignoreDuplicates: true });
      if (result.error) throw new Error(result.error.message);
    }
    // Existing CLIs keep their CI guards; only this guarded entrypoint calls the reusable functions.
    const { collectArticleImages } = await import("./collect-article-images");
    const { importArticle } = await import("./import-content-final");
    const { syncArticleImageProvenance } = await import("./sync-article-image-provenance");
    const { downloadCoverSource } = await import("../articles/release-completed-articles");
    await collectArticleImages({ manifest: stagedMedia, finalFile: stagedFinal, apply: true, allowProd: options.allowProd });
    const promoted = articleFinalSchema.parse(await json(stagedFinal));
    const promotedManifest = await readArticleImageManifest(stagedMedia);
    // A development cover can't pass the target's media checks. Its bytes become the cover source instead.
    let cover: string | null = null;
    if (isDevelopmentCover(promoted.cover_image, dev.url)) {
      cover = path.join(staging, "cover-source.webp");
      await fs.writeFile(cover, await fetchImageBytes(promoted.cover_image!));
      promoted.cover_image = null;
    }
    assertArticleImageReadiness(checkArticleImageReadiness({ manifest: promotedManifest, finalJson: promoted }), stagedMedia);
    assertNoArticleMediaErrors(await checkArticleMedia(promoted));
    cover ??= await downloadCoverSource({ finalJson: promoted, manifest: promotedManifest }, staging);
    await importArticle(promoted, false, cover, false);
    await syncArticleImageProvenance(promotedManifest, { apply: true }, db);
    const stored = await articleReadback(db, promoted, promotedManifest, options.target === "production");
    await verifyArticleAssets(promoted, stored.cover_image);
    if (options.target === "production") await completeArticlePublication(queueDb, queue, final.slug, async () => {
      await revalidatePublishedContent(process.env, [{ type: "article", slug: final.slug }]);
      await verifyArticleLive(promoted, stored.cover_image);
    });
    console.log(`PASS published article to ${options.target}: https://bloxodes.com/articles/${final.slug}`);
  } finally {
    try { if (staging) await fs.rm(staging, { recursive: true, force: true }); }
    finally { await unlock(); }
  }
}

export async function articleContentStatus(options: ContentOptions) {
  const db = client(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
  const row = await read(() => db.from("articles").select("id,slug,title,is_published,published_at,updated_at").eq("slug", options.article!).maybeSingle());
  console.log(JSON.stringify({ target: options.target, article: row, url: `https://bloxodes.com/articles/${options.article}` }, null, 2));
}
