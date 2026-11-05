import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { bundleSchema, articleFinalSchema } from "../../../contracts/article/v1/schema";
import { productionArticleDecision, publishedArticleAction, publishedArticlePayload } from "../../content/article-published-update";
import { assertUpdatePublishedScope, parseContentOptions } from "../../content/wiki-content-options";
import { readWikiContract } from "../wiki-publish-contract";

const id = "11111111-1111-4111-8111-111111111111";
const slug = "example-guide";
const bundle = { contract: "article@1", slug, finalJson: "final.json", mediaJson: "media.json", queueId: id };
const dev = "https://bbtcaurrtyoukvjbxbbj.supabase.co";

test("article contract is strict, versioned and confines paths", async () => {
  assert.equal(bundleSchema.parse(bundle).contract, "article@1");
  for (const bad of [{ ...bundle, contract: "article@2" }, { ...bundle, queueId: "other" }, { ...bundle, slug: "Bad Slug" }, { ...bundle, mediaJson: "../media.json" }, { ...bundle, finalJson: "/final.json" }, { ...bundle, namespace: "minecraft" }]) assert.equal(bundleSchema.safeParse(bad).success, false);
  assert.equal(articleFinalSchema.safeParse({ slug, title: "Guide", content_md: "Text", is_published: false }).success, false);
  assert.equal(parseContentOptions(["status", "--article", slug]).article, slug);
  assert.throws(() => parseContentOptions(["status", "--article", slug, "--game", "example"]));
  assert.throws(() => parseContentOptions(["publish", "/bundle", "--target", "production", "--apply"]));
  const root = path.resolve("tmp", `article-contract-${randomUUID()}`);
  await fs.mkdir(root, { recursive: true });
  try { await fs.writeFile(path.join(root, "bundle.json"), JSON.stringify(bundle)); assert.equal(await readWikiContract(root), "article@1"); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
});

async function fixture(scenario: string) {
  const root = path.resolve("tmp", `article-publish-${randomUUID()}`);
  await fs.mkdir(root, { recursive: true });
  const src = `${dev}/storage/v1/object/public/article-media/articles/${slug}/sources/step.webp`;
  const final = { slug, title: "Example Guide", content_md: `Complete the first task.\n\n## First task\n\n![The task menu shows the first objective](${src})`, universe_id: 12345, faq_json: [] };
  if (scenario.startsWith("video-")) final.content_md += "\n\n{{ youtube: dQw4w9WgXcQ }}";
  await fs.writeFile(path.join(root, "bundle.json"), JSON.stringify(bundle));
  await fs.writeFile(path.join(root, "final.json"), JSON.stringify(final));
  await fs.writeFile(path.join(root, "media.json"), JSON.stringify({ schema: 1, article_slug: slug, required: true, visual_type: "steps", expected_count: 1, entries: [{ id: "step", label: "First task", required: true, placement_heading: "First task", status: "verified", source_page_url: "https://example.com/guide", original_image_url: "https://example.com/step.webp", match_evidence: "The first objective menu for this game", rights_note: "Gameplay screenshot credit", alt: "The task menu shows the first objective", public_url: src, uploaded_path: `articles/${slug}/sources/step.webp`, width: 256, height: 256 }] }));
  await fs.writeFile(path.join(root, "image.png"), await sharp({ create: { width: 256, height: 256, channels: 3, background: "red" } }).png().toBuffer());
  const preload = `
    import fs from 'node:fs';
    const root=${JSON.stringify(root)}, scenario=${JSON.stringify(scenario)};
    const calls=[];
    let row={id:${JSON.stringify(id)},workflow_mode:'agent_runner',status:scenario==='already-published'?'published':'completed',result_slug:${JSON.stringify(slug)},result_path:root+'/final.json',production_url:scenario==='already-published'?'https://bloxodes.com/articles/${slug}':null,completed_at:'retained',published_at:'original-publication-date',updated_at:'original-update-date',attempts:2};
    process.on('exit',()=>fs.writeFileSync(root+'/report.json',JSON.stringify({calls,row})));
    globalThis.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url??input.href);
      const method=init?.method??'GET'; calls.push({url:url.href,method});
      const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
      if(url.hostname==='www.youtube.com') return scenario==='video-missing'?new Response(null,{status:404}):json({type:'video',html:'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>'});
      if(url.pathname.includes('/storage/')) return new Response(scenario==='corrupt-image'?'broken':fs.readFileSync(root+'/image.png'),{headers:{'content-type':'image/png'}});
      if(url.pathname.endsWith('/article_generation_queue')) {
        if(method==='PATCH') {
          if(scenario==='queue-race') row.status='blocked';
          const matches=[...url.searchParams].filter(([key])=>key!=='select').every(([key,value])=>String(row[key])===value.replace(/^eq\./,''));
          if(!matches) return json([]);
          Object.assign(row,JSON.parse(init.body));return json([{id:row.id}]);
        }
        return json(row);
      }
      if(url.pathname.endsWith('/roblox_universes')) return json({universe_id:12345});
      throw new Error('Unexpected request '+method+' '+url.href);
    };
  `;
  return { root, preload };
}

for (const scenario of ["dry-run", "corrupt-image", "video-resolves", "video-missing"]) test(`article ${scenario} makes no writes`, async () => {
  const { root, preload } = await fixture(scenario);
  try {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--import", `data:text/javascript,${encodeURIComponent(preload)}`, "scripts/content/roblox-wiki-cli.ts", "publish", root], { encoding: "utf8", timeout: 30_000, env: { ...process.env, BLOXODES_ENV_PROFILE: "process-only", SUPABASE_URL: dev, SUPABASE_SERVICE_ROLE: "test-only-role" } });
    const report = JSON.parse(await fs.readFile(path.join(root, "report.json"), "utf8"));
    assert.ok(report.calls.every((call: { method: string }) => call.method === "GET"));
    assert.equal(report.row.status, "completed");
    assert.equal(result.status, ["dry-run", "video-resolves"].includes(scenario) ? 0 : 1, result.stderr);
    if (["dry-run", "video-resolves"].includes(scenario)) assert.match(result.stdout, /Dry run complete; no database or media writes/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

for (const scenario of ["queue-success", "queue-race", "already-published", "failed-verification"]) test(`article acknowledgement ${scenario}`, async () => {
  const { root, preload } = await fixture(scenario);
  try {
    const runner = path.join(root, "runner.mts");
    await fs.writeFile(runner, `
      import {createClient} from '@supabase/supabase-js';
      import {completeArticlePublication} from '../../scripts/content/article-publish';
      const db=createClient('${dev}','test-only-role',{auth:{persistSession:false}});
      const {data:row}=await db.from('article_generation_queue').select('*').eq('id','${id}').single();
      try {
        await completeArticlePublication(db,row,'${slug}',async()=>{
          if (${JSON.stringify(scenario)}==='failed-verification') throw new Error('Live check failed');
        });
      } catch(error) { console.error(error.message);process.exitCode=1; }
    `);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--import", `data:text/javascript,${encodeURIComponent(preload)}`, runner], { encoding: "utf8", timeout: 30_000, env: { ...process.env, BLOXODES_ENV_PROFILE: "process-only" } });
    const report = JSON.parse(await fs.readFile(path.join(root, "report.json"), "utf8"));
    assert.equal(result.status, ["queue-race", "failed-verification"].includes(scenario) ? 1 : 0, result.stderr);
    assert.equal(report.row.status, ["queue-success", "already-published"].includes(scenario) ? "published" : scenario === "queue-race" ? "blocked" : "completed");
    assert.equal(report.row.completed_at, "retained"); assert.equal(report.row.attempts, 2);
    if (scenario === "queue-success") {
      assert.equal(report.row.production_url, `https://bloxodes.com/articles/${slug}`);
      const patch = new URL(report.calls.find((call: { method: string }) => call.method === "PATCH").url).searchParams;
      for (const [field, value] of [["id", id], ["workflow_mode", "agent_runner"], ["status", "completed"], ["result_slug", slug], ["result_path", path.join(root, "final.json")]]) assert.equal(patch.get(field), `eq.${value}`);
      for (const field of ["last_error", "outcome_reason", "locked_at", "locked_by", "next_attempt_at", "rejected_at"]) assert.equal(report.row[field], null);
    }
    if (["already-published", "failed-verification"].includes(scenario)) {
      assert.ok(report.calls.every((call: { method: string }) => call.method === "GET"));
      assert.equal(report.row.published_at, "original-publication-date");
      assert.equal(report.row.updated_at, "original-update-date");
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("article readback compares bodies after normalizing and still catches real differences", async () => {
  const { articleReadbackMismatch } = await import("../../content/article-publish");
  const final = { slug, title: "Guide", content_md: "Body text.\n\n" };
  const stored = { slug, title: "Guide", content_md: "Body text.\n\n", meta_description: null, tags: [], sources: [], faq_json: [], is_published: true };
  assert.equal(articleReadbackMismatch(stored, final), null);
  assert.equal(articleReadbackMismatch({ ...stored, content_md: "Body text." }, final), null);
  assert.equal(articleReadbackMismatch({ ...stored, content_md: "Other text." }, final), "content_md");
  assert.equal(articleReadbackMismatch({ ...stored, title: "Other" }, final), "title");
  assert.equal(articleReadbackMismatch({ ...stored, is_published: false }, final), "is_published");
});

test("article covers are treated as development covers only on the development origin", async () => {
  const { isDevelopmentCover } = await import("../../content/article-publish");
  assert.equal(isDevelopmentCover(`${dev}/storage/v1/object/public/article-media/cover.webp`, dev), true);
  assert.equal(isDevelopmentCover(`${dev}/storage/v1/object/public/article-media/cover.webp`, `${dev}/`), true);
  assert.equal(isDevelopmentCover("https://media.bloxodes.com/storage/v1/object/public/article-media/cover.webp", dev), false);
  assert.equal(isDevelopmentCover(null, dev), false);
});

test("article live check reads the cover from og:image, as the article page renders it", async () => {
  const { verifyArticleLive } = await import("../../content/article-publish");
  const url = `https://bloxodes.com/articles/${slug}`;
  const cover = "https://media.bloxodes.com/storage/v1/object/public/article-media/cover.webp";
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } }).png().toBuffer();
  const page = (og: string) => `<html><head><title>Guide</title><link rel="canonical" href="${url}"/><meta name="description" content="About it"/>${og}</head><body><h1>Guide</h1><div id="article-body"><p>Body</p></div></body></html>`;
  const realFetch = globalThis.fetch;
  const serve = (og: string) => {
    globalThis.fetch = (async (input: string | URL) => {
      if (String(input) !== url) return new Response(image, { headers: { "content-type": "image/png" } });
      const response = new Response(page(og), { headers: { "content-type": "text/html" } });
      Object.defineProperty(response, "url", { value: url });
      return response;
    }) as typeof fetch;
  };
  try {
    serve(`<meta property="og:image" content="${cover}"/>`);
    await verifyArticleLive({ slug, title: "Guide", content_md: "Body" }, cover);
    serve(`<meta property="og:image" content="https://media.bloxodes.com/other.webp"/>`);
    await assert.rejects(() => verifyArticleLive({ slug, title: "Guide", content_md: "Body" }, cover), /Live cover is missing/);
  } finally { globalThis.fetch = realFetch; }
});

test("article bundle files reject symlink escapes", async () => {
  const { bundlePath } = await import("../roblox-wiki-bundle");
  const root = path.resolve("tmp", `article-path-${randomUUID()}`);
  await fs.mkdir(path.join(root, "bundle"), { recursive: true });
  try {
    await fs.writeFile(path.join(root, "outside.json"), "{}");
    await fs.symlink(path.join(root, "outside.json"), path.join(root, "bundle", "final.json"));
    await assert.rejects(() => bundlePath(path.join(root, "bundle"), "final.json"), /escapes its folder/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});


test("published article differences require explicit update permission, including stale owner copy", async () => {
  const { articleReadbackMismatch } = await import("../../content/article-publish");
  const final = { slug, title: "Guide", content_md: "Bundle text." };
  const live = { ...final, content_md: "Owner edited this text.", meta_description: null, tags: [], sources: [], faq_json: [], is_published: true };
  const mismatch = articleReadbackMismatch(live, final);
  assert.equal(mismatch, "content_md");
  assert.throws(() => publishedArticleAction(mismatch), /live article differs.*--update-published.*apply the change/);
  assert.equal(publishedArticleAction(mismatch, true), "update");
});

test("matching published articles only verify with or without update permission", async () => {
  const { articleReadbackMismatch } = await import("../../content/article-publish");
  const final = { slug, title: "Guide", content_md: "Same text." };
  const live = { ...final, meta_description: null, tags: [], sources: [], faq_json: [], is_published: true };
  for (const flag of [false, true]) assert.equal(publishedArticleAction(articleReadbackMismatch(live, final), flag), "verify");
});

test("published update payload keeps the author, original date and null-cover fallback", () => {
  const live = { id, slug, author_id: "original-author", published_at: "2025-01-02T03:04:05Z", is_published: true, cover_image: "https://media.bloxodes.com/existing-cover.webp" };
  const draft = { slug, title: "Edited guide", content_md: "Changed first body image and layout.", author_id: "different-author", published_at: "2026-11-05T00:00:00Z", is_published: true, cover_image: "https://media.bloxodes.com/newly-generated-cover.webp" };
  assert.equal(publishedArticleAction("content_md", true), "update");
  const payload = publishedArticlePayload(draft, live, { cover_image: null });
  assert.equal(payload.author_id, live.author_id);
  assert.equal(payload.published_at, live.published_at);
  assert.equal(payload.is_published, true);
  assert.equal(payload.slug, live.slug);
  assert.equal(payload.cover_image, live.cover_image);
  assert.equal(payload.content_md, draft.content_md);
  assert.equal(payload.title, draft.title);
  assert.equal(publishedArticlePayload(draft, live, { cover_image: draft.cover_image }).cover_image, draft.cover_image);
  for (const changed of [{ ...live, slug: "other" }, { ...live, is_published: false }, { ...live, author_id: "" }, { ...live, published_at: "" }, { ...live, cover_image: "" }]) {
    assert.throws(() => publishedArticlePayload(draft, changed, { cover_image: null }), /same existing published article/);
  }
});

test("update-published parses as a publish-only boolean and rejects every other contract", () => {
  const options = parseContentOptions(["publish", "/bundle", "--update-published"]);
  assert.equal(options.updatePublished, true);
  assert.doesNotThrow(() => assertUpdatePublishedScope(options, "article@1"));
  for (const contract of ["game-article@1", "roblox-wiki@1", "game-wiki@1"]) {
    assert.throws(() => assertUpdatePublishedScope(options, contract), /only valid for article@1/);
    assert.doesNotThrow(() => assertUpdatePublishedScope({ ...options, updatePublished: false }, contract));
  }
  for (const args of [["publish", "/bundle", "--update-published=false"], ["publish", "/bundle", "--update-published", "--update-published"], ["status", "--article", slug, "--update-published"], ["candidates", "--update-published"], ["deployed-sha", "--update-published"]]) {
    assert.throws(() => parseContentOptions(args));
  }
  assert.equal(parseContentOptions(["publish", "/bundle", "--target", "production", "--update-published"]).apply, false);
  assert.equal(parseContentOptions(["publish", "/bundle", "--target", "production", "--apply", "--allow-prod", "--update-published"]).updatePublished, true);
});

test("production comparison projects promoted image URLs without changing the bundle", async () => {
  const { productionArticleExpectation } = await import("../../content/article-publish");
  const src = `${dev}/storage/v1/object/public/article-media/articles/${slug}/sources/step.webp`;
  const final = { slug, title: "Guide", content_md: `![Step](${src})` };
  const manifest: Parameters<typeof productionArticleExpectation>[1] = { schema: 1, article_slug: slug, visual_type: "steps", required: true, expected_count: 1, entries: [{ id: "step", label: "Step", required: true, placement_heading: "Step", status: "verified", public_url: src, uploaded_path: `articles/${slug}/sources/step.webp` }] };
  const { expected, expectedManifest } = productionArticleExpectation(final, manifest, "article-media")!;
  assert.match(expected.content_md, /https:\/\/media\.bloxodes\.com\/storage\/v1\/object\/public\/article-media\//);
  assert.equal(final.content_md, `![Step](${src})`);
  assert.equal(manifest.entries[0].public_url, src);
  assert.notEqual(expectedManifest.entries[0].public_url, src);
});

// Expected outcomes are explicit so this table can catch decision-order regressions.
const productionCases = [
  { mismatch: null, updatePublished: false, explicitCover: false, completed: "retry", published: "verify" },
  { mismatch: null, updatePublished: false, explicitCover: true, completed: "retry", published: "verify" },
  { mismatch: null, updatePublished: true, explicitCover: false, completed: "retry", published: "verify" },
  { mismatch: null, updatePublished: true, explicitCover: true, completed: "update", published: "update" },
  { mismatch: "content_md", updatePublished: false, explicitCover: false, completed: "refuse", published: "refuse" },
  { mismatch: "content_md", updatePublished: false, explicitCover: true, completed: "refuse", published: "refuse" },
  { mismatch: "content_md", updatePublished: true, explicitCover: false, completed: "update", published: "update" },
  { mismatch: "content_md", updatePublished: true, explicitCover: true, completed: "update", published: "update" },
] as const;
for (const queueStatus of ["completed", "published"] as const) {
  for (const entry of productionCases) {
    test(`production decision ${queueStatus}, flag=${entry.updatePublished}, cover=${entry.explicitCover}, mismatch=${entry.mismatch}`, () => {
      const input = { ...entry, queueStatus };
      const action = entry[queueStatus];
      assert.deepEqual(productionArticleDecision({ ...input, live: { is_published: true } }), {
        action, acknowledgeQueue: queueStatus === "completed" && action !== "refuse",
      });
      if (entry.mismatch) {
        assert.deepEqual(productionArticleDecision({ ...input, mismatch: "universe_id", live: { is_published: true } }), {
          action, acknowledgeQueue: queueStatus === "completed" && action !== "refuse",
        });
      }
      for (const live of [null, { is_published: false }]) {
        assert.deepEqual(productionArticleDecision({ ...input, live }), {
          action: "new", acknowledgeQueue: queueStatus === "completed",
        });
      }
    });
  }
}

test("missing media bucket skips production comparison instead of projecting undefined URLs", async () => {
  const { productionArticleExpectation } = await import("../../content/article-publish");
  const src = `${dev}/storage/v1/object/public/article-media/articles/${slug}/sources/step.webp`;
  const final = { slug, title: "Guide", content_md: `![Step](${src})` };
  const manifest: Parameters<typeof productionArticleExpectation>[1] = { schema: 1, article_slug: slug, visual_type: "steps", required: true, expected_count: 1, entries: [{ id: "step", label: "Step", required: true, placement_heading: "Step", status: "verified", public_url: src, uploaded_path: `articles/${slug}/sources/step.webp` }] };
  for (const bucket of [undefined, "", "   "]) {
    assert.equal(productionArticleExpectation(final, manifest, bucket), null);
    for (const queueStatus of ["completed", "published"]) {
      for (const updatePublished of [false, true]) {
        for (const explicitCover of [false, true]) {
          for (const live of [null, { is_published: true }]) {
            assert.deepEqual(productionArticleDecision({ live, mismatch: undefined, queueStatus, updatePublished, explicitCover }), {
              action: "skip", acknowledgeQueue: false,
            });
          }
        }
      }
    }
  }
  assert.equal(final.content_md, `![Step](${src})`);
  assert.equal(manifest.entries[0].public_url, src);
});
