import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { collectArticleImages } from "../../content/collect-article-images";
import { checkArticleImageReadiness, type ArticleImageManifest } from "../../content/article-image-readiness";

test("production manifests pass readiness without development credentials and reuse objects", async t => {
  const directory = path.resolve("tmp", `production-images-${randomUUID()}`);
  await fs.mkdir(directory, { recursive: true });
  const slug = "fisch-guide", object = `articles/${slug}/sources/step.webp`;
  const url = `https://media.bloxodes.com/storage/v1/object/public/bloxodes-media/${object}`;
  const manifest: ArticleImageManifest = { schema: 1, article_slug: slug, visual_type: "steps", required: true, expected_count: 1,
    entries: [{ id: "step", label: "Task menu", required: true, placement_heading: "Task menu", status: "verified", source_page_url: "https://example.com/guide", original_image_url: "https://example.com/image.png",
      alt: "The task menu shows the first objective", match_evidence: "The exact task menu and objective match the guide", rights_note: "Gameplay screenshot with credit", public_url: url, uploaded_path: object, width: 256, height: 256 }] };
  const final = { slug, content_md: `## Task menu\n\n![The task menu shows the first objective](${url})` };
  assert.equal(checkArticleImageReadiness({ manifest, finalJson: final, env: {} }).ready, true);
  const bytes = await sharp({ create: { width: 256, height: 256, channels: 3, background: "red" } }).webp().toBuffer();
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    requests.push(String(input)); assert.equal(init?.method ?? "GET", "GET");
    assert.equal(String(input), url);
    return new Response(bytes, { headers: { "content-type": "image/webp" } });
  });
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE", "SUPABASE_MEDIA_BUCKET", "SUPABASE_MEDIA_PUBLIC_URL", "NODE_ENV"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { SUPABASE_URL: "https://database.bloxodes.com", SUPABASE_SERVICE_ROLE: "test-only", SUPABASE_MEDIA_BUCKET: "bloxodes-media", SUPABASE_MEDIA_PUBLIC_URL: "https://media.bloxodes.com", NODE_ENV: "production" });
  try {
    const file = path.join(directory, "media.json"), finalFile = path.join(directory, "final.json");
    await fs.writeFile(file, JSON.stringify(manifest)); await fs.writeFile(finalFile, JSON.stringify(final));
    await assert.rejects(collectArticleImages({ manifest: file, finalFile, apply: true, allowProd: false }), /allow-prod/);
    await collectArticleImages({ manifest: file, finalFile, apply: true, allowProd: true });
    assert.deepEqual(requests, [url]);
    assert.deepEqual(JSON.parse(await fs.readFile(finalFile, "utf8")), final);
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    await fs.rm(directory, { recursive: true });
  }
});

test("older development manifests recollect original images without requesting managed development", async t => {
  const directory = path.resolve("tmp", `article-media-cutover-${randomUUID()}`);
  await fs.mkdir(directory, { recursive: true });
  const object = "articles/legacy-guide/sources/task.webp";
  const devUrl = `https://bbtcaurrtyoukvjbxbbj.supabase.co/storage/v1/object/public/article-media/${object}`;
  const productionUrl = `https://media.bloxodes.com/storage/v1/object/public/bloxodes-media/${object}`;
  const entry = { id: "task", label: "Task menu", required: true, placement_heading: "Task menu", status: "verified", public_url: devUrl, uploaded_path: object,
    source_page_url: "https://example.com/guide", original_image_url: "https://example.com/task.png", alt: "The task menu shows the first objective", match_evidence: "The task menu matches the guide objective", rights_note: "Gameplay screenshot with credit", width: 256, height: 256 };
  const manifest = { schema: 1, article_slug: "legacy-guide", visual_type: "steps", required: true, expected_count: 1, entries: [entry] };
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE", "SUPABASE_MEDIA_BUCKET", "SUPABASE_MEDIA_PUBLIC_URL", "NODE_ENV"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { SUPABASE_URL: "https://database.bloxodes.com", SUPABASE_SERVICE_ROLE: "test-only", SUPABASE_MEDIA_BUCKET: "bloxodes-media", SUPABASE_MEDIA_PUBLIC_URL: "https://media.bloxodes.com", NODE_ENV: "production" });
  const bytes = await sharp({ create: { width: 256, height: 256, channels: 3, background: "red" } }).webp().toBuffer();
  let uploads = 0, originals = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    assert.ok(!url.includes("supabase.co"));
    if ((init?.method ?? "GET") !== "GET") { uploads++; return new Response(JSON.stringify({ Key: object }), { headers: { "content-type": "application/json" } }); }
    if (url === entry.original_image_url) originals++;
    else assert.equal(url, productionUrl);
    return new Response(bytes, { headers: { "content-type": "image/webp" } });
  });
  try {
    const media = path.join(directory, "media.json"), final = path.join(directory, "final.json");
    await fs.writeFile(media, JSON.stringify(manifest));
    await fs.writeFile(final, JSON.stringify({ slug: "legacy-guide", content_md: `## Task menu\n\n![The task menu shows the first objective](${devUrl})` }));
    await collectArticleImages({ manifest: media, finalFile: final, apply: true, allowProd: true });
    assert.equal(originals, 1); assert.equal(uploads, 1);
    assert.ok(JSON.parse(await fs.readFile(final, "utf8")).content_md.includes(productionUrl));
    assert.equal(JSON.parse(await fs.readFile(media, "utf8")).entries[0].public_url, productionUrl);
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    await fs.rm(directory, { recursive: true });
  }
});

test("production media preflight rejects old development URLs before any image fetch", async () => {
  const { assertProductionArticleMediaUrls } = await import("../../content/article-image-readiness");
  const dev = "https://bbtcaurrtyoukvjbxbbj.supabase.co/storage/v1/object/public/article-media/image.webp";
  assert.throws(() => assertProductionArticleMediaUrls({ slug: "guide", content_md: `![Step](${dev})` }), /cannot use managed-development media/);
  assert.throws(() => assertProductionArticleMediaUrls({ slug: "guide", content_md: "Body", cover_image: dev }), /production cover_image or null/);
  assert.doesNotThrow(() => assertProductionArticleMediaUrls({ slug: "guide", content_md: "![Step](https://media.bloxodes.com/image.webp)", cover_image: null }));
});
