import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

import type { ArticleImageManifest } from "../../content/article-image-readiness";
import {
  assertProductionSnapshot,
  downloadCoverSource,
  parseReleaseOptions,
  pickCoverSourceEntry,
  productionChildEnvironment,
  readProductionCredentials,
  readReleaseArtifact,
  resolveReleaseArtifactPath,
  type ProductionCredentials,
} from "../release-completed-articles";
import { artifactHashes } from "../article-pipeline";
import { fetchWithTransientRetries, TransientHttpError } from "../../shared/transient-http";

const QUEUE_ID = "123e4567-e89b-42d3-a456-426614174000";
const SLUG = "tested-article";
const IMAGE_URL = `https://media.bloxodes.com/articles/${SLUG}/sources/first.webp`;

test("pipeline release requires matching approval, technical checks and unchanged artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "article-release-path-"));
  const run = path.join(root, "tmp/article-pipeline/run");
  const content = path.join(run, "content");
  const file = path.join(content, "final.json");
  try {
    await mkdir(content, { recursive: true });
    for (const name of ["brief.md", "media.json", "final.json"]) await writeFile(path.join(content, name), "approved");
    const state = { status: "completed", stage: "done", job: { id: QUEUE_ID, slug: SLUG }, artifacts: await artifactHashes(content),
      history: ["copy_check", "image_check", "import_verify", "browser_verify"].map(stage => ({ stage, decision: { status: "completed" } })) };
    const saveState = () => writeFile(path.join(run, "state.json"), JSON.stringify(state));
    await saveState();
    await writeFile(path.join(run, "editorial_review.json"), JSON.stringify({ status: "completed" }));
    assert.equal(await resolveReleaseArtifactPath(file, QUEUE_ID, SLUG, root), file);
    await assert.rejects(resolveReleaseArtifactPath(file, "wrong-id", SLUG, root), /matching completed approval/);
    state.status = "blocked"; await saveState();
    await assert.rejects(resolveReleaseArtifactPath(file, QUEUE_ID, SLUG, root), /matching completed approval/);
    state.status = "completed"; state.history.pop(); await saveState();
    await assert.rejects(resolveReleaseArtifactPath(file, QUEUE_ID, SLUG, root), /missing browser_verify/);
    await writeFile(file, "unreviewed change");
    await assert.rejects(resolveReleaseArtifactPath(file, QUEUE_ID, SLUG, root), /no longer matches final.json/);
    const legacy = path.join(root, "tmp/content-workspace/article"); await mkdir(legacy, { recursive: true });
    await writeFile(path.join(root, "outside.json"), "outside");
    await symlink(path.join(root, "outside.json"), path.join(legacy, "final.json"));
    await assert.rejects(resolveReleaseArtifactPath(path.join(legacy, "final.json"), QUEUE_ID, SLUG, root), /outside an approved/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

function manifest(): ArticleImageManifest {
  return {
    schema: 1,
    article_slug: SLUG,
    visual_type: "other",
    required: true,
    expected_count: 2,
    entries: [
      {
        id: "first",
        label: "First image",
        required: true,
        placement_heading: "First",
        status: "verified",
        source_page_url: "https://example.com/source",
        original_image_url: "https://example.com/first.png",
        uploaded_path: `articles/${SLUG}/sources/first.webp`,
        public_url: IMAGE_URL,
      },
      {
        id: "second",
        label: "Second image",
        required: true,
        placement_heading: "Second",
        status: "accepted_missing",
      },
    ],
  };
}

test("article release checks development inputs and promoted staging with separate media targets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "article-release-staging-"));
  const bundle = path.join(root, "content/releases/frozen");
  const original = path.join(bundle, "tmp/content-workspace/article");
  const staged = path.join(root, "tmp/content-workspace/staged");
  const previousRoot = process.env.BLOXODES_ARTIFACT_ROOT;
  const targetKeys = ["SUPABASE_URL", "SUPABASE_MEDIA_PUBLIC_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const;
  const previousTargets = Object.fromEntries(targetKeys.map(key => [key, process.env[key]]));
  const productionEnv = { SUPABASE_URL: "https://database.bloxodes.com", SUPABASE_MEDIA_PUBLIC_URL: "https://media.bloxodes.com" };
  const devEnv = { SUPABASE_URL: "https://bbtcaurrtyoukvjbxbbj.supabase.co" };
  const devUrl = `${devEnv.SUPABASE_URL}/storage/v1/object/public/article-media/articles/${SLUG}/sources/first.webp`;
  try {
    await mkdir(original, {recursive: true});
    await mkdir(staged, {recursive: true});
    const media = manifest();
    media.entries = [{...media.entries[0]!, public_url: devUrl, match_evidence: "The verified source shows the required item.", rights_note: "Source attribution retained.", alt: "First image", width: 640, height: 480}];
    media.expected_count = 1;
    const final = {title: "Tested article", slug: SLUG, content_md: `## First\n\n![First image](${devUrl})`};
    await writeFile(path.join(original, "final.json"), JSON.stringify(final));
    await writeFile(path.join(original, "media.json"), JSON.stringify(media));
    const row = {id: QUEUE_ID, article_title: "Tested article", workflow_mode: "agent_runner", status: "completed", result_path: "tmp/content-workspace/article/final.json", result_slug: SLUG, production_url: null};
    process.env.BLOXODES_ARTIFACT_ROOT = bundle;
    process.env.SUPABASE_URL = productionEnv.SUPABASE_URL;
    process.env.SUPABASE_MEDIA_PUBLIC_URL = productionEnv.SUPABASE_MEDIA_PUBLIC_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalHashes = await artifactHashes(original);
    await assert.rejects(readReleaseArtifact(row), /public_url is not Bloxodes-hosted/);
    const approved = await readReleaseArtifact(row, undefined, devEnv);
    for (const name of ["final.json", "media.json"]) await copyFile(path.join(original, name), path.join(staged, name));
    const stagedRow = {...row, result_path: "tmp/content-workspace/staged/final.json"};
    await assert.rejects(readReleaseArtifact(stagedRow, root, productionEnv), /public_url is not Bloxodes-hosted/);
    assert.deepEqual((await readReleaseArtifact(stagedRow, root, devEnv)).finalJson, approved.finalJson);
    for (const badUrl of [devUrl.replace("bbtcaurrtyoukvjbxbbj", "another-project"), devUrl.replace("/storage/v1/object/public/", "/unowned/")]) {
      await writeFile(path.join(staged, "media.json"), JSON.stringify({...media, entries: [{...media.entries[0], public_url: badUrl}]}));
      await writeFile(path.join(staged, "final.json"), JSON.stringify({...final, content_md: final.content_md.replace(devUrl, badUrl)}));
      await assert.rejects(readReleaseArtifact(stagedRow, root, devEnv), /public_url is not Bloxodes-hosted/);
    }
    const promotedMedia = {...media, entries: [{...media.entries[0], public_url: IMAGE_URL}]};
    const promotedFinal = {...final, content_md: final.content_md.replace(devUrl, IMAGE_URL)};
    await writeFile(path.join(staged, "media.json"), JSON.stringify(promotedMedia));
    await writeFile(path.join(staged, "final.json"), JSON.stringify(promotedFinal));
    const promoted = await readReleaseArtifact(stagedRow, root, productionEnv);
    assert.equal(approved.finalPath, path.join(original, "final.json"));
    assert.equal(promoted.finalPath, path.join(staged, "final.json"));
    assert.deepEqual(promoted.finalJson, promotedFinal);
    assert.deepEqual(await artifactHashes(original), originalHashes);
    assert.deepEqual(JSON.parse(await readFile(approved.finalPath, "utf8")), final);
    assert.equal(process.env.BLOXODES_ARTIFACT_ROOT, bundle);
    assert.equal(process.env.SUPABASE_URL, productionEnv.SUPABASE_URL);
    assert.equal(process.env.SUPABASE_MEDIA_PUBLIC_URL, productionEnv.SUPABASE_MEDIA_PUBLIC_URL);
  } finally {
    if (previousRoot === undefined) delete process.env.BLOXODES_ARTIFACT_ROOT;
    else process.env.BLOXODES_ARTIFACT_ROOT = previousRoot;
    for (const key of targetKeys) {
      if (previousTargets[key] === undefined) delete process.env[key];
      else process.env[key] = previousTargets[key];
    }
    await rm(root, {recursive: true, force: true});
  }
});

test("release accepts only an exact queue-ID allowlist", () => {
  const parsed = parseReleaseOptions(["--queue-id", QUEUE_ID, "--apply", "--allow-prod"], { NODE_ENV: "test" });
  assert.deepEqual(parsed.queueIds, [QUEUE_ID]);
  assert.equal(parsed.apply, true);
  assert.throws(() => parseReleaseOptions([], { NODE_ENV: "test" }), /At least one --queue-id/);
  assert.throws(
    () => parseReleaseOptions(["--queue-id", QUEUE_ID, "--queue-id", QUEUE_ID], { NODE_ENV: "test" }),
    /Duplicate --queue-id/,
  );
  assert.throws(
    () => parseReleaseOptions(["--queue-id", QUEUE_ID, "--apply"], { NODE_ENV: "test" }),
    /requires both --apply and --allow-prod/,
  );
});

test("production child environment removes development credentials", () => {
  const credentials: ProductionCredentials = {
    url: "https://database.bloxodes.com",
    serviceRole: "production-service-role",
    mediaBucket: "media",
    mediaPublicUrl: "https://media.bloxodes.com",
  };
  const env = productionChildEnvironment(credentials, {
    ARTICLE_DEV_SUPABASE_URL: "https://development.supabase.co",
    ARTICLE_DEV_SUPABASE_SERVICE_ROLE: "development-service-role",
    SUPABASE_URL: "https://development.supabase.co",
    SUPABASE_SERVICE_ROLE: "development-service-role",
    BLOXODES_ENV_OVERLAYS: "articles",
    NODE_ENV: "development",
  });
  assert.equal(env.SUPABASE_URL, credentials.url);
  assert.equal(env.SUPABASE_SERVICE_ROLE, credentials.serviceRole);
  assert.equal(env.ARTICLE_DEV_SUPABASE_URL, undefined);
  assert.equal(env.ARTICLE_DEV_SUPABASE_SERVICE_ROLE, undefined);
  assert.equal(env.BLOXODES_ENV_OVERLAYS, undefined);
  assert.equal(env.BLOXODES_ENV_PROFILE, "process-only");
  assert.equal(env.NODE_ENV, "production");
});

test("release uses the first used verified image as the deterministic cover source", () => {
  const input = manifest();
  input.entries.unshift({ ...input.entries[0]!, id: "unused", public_url: "https://development.supabase.co/unused.webp" });
  const content = `## First\n\n![First image](${IMAGE_URL})`;
  assert.equal(pickCoverSourceEntry(input, content)?.id, "first");
  assert.equal(pickCoverSourceEntry(input, "Written instructions only."), null);
});

test("cover download skips unused images and passes a used source to the importer", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "article-cover-source-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = manifest();
  input.entries.unshift({ ...input.entries[0]!, id: "unused", public_url: "https://development.supabase.co/unused.webp" });
  const finalJson = { title: "Tested article", slug: SLUG, content_md: `## First\n\n![First image](${IMAGE_URL})` };
  const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).webp().toBuffer();
  let calls = 0;
  const fetchSource: typeof fetchWithTransientRetries = async url => {
    calls += 1;
    assert.equal(url, IMAGE_URL);
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/webp" } });
  };
  const file = await downloadCoverSource({ manifest: input, finalJson }, directory, fetchSource);
  assert.deepEqual(await readFile(file!), bytes);
  assert.equal(await downloadCoverSource({ manifest: input, finalJson: { ...finalJson, content_md: "No body images." } }, directory, fetchSource), null);
  assert.equal(calls, 1);
});

test("unavailable cover sources return the normal importer fallback", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "article-cover-fallback-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const artifact = { manifest: manifest(), finalJson: { title: "Tested article", slug: SLUG, content_md: `## First\n\n![First image](${IMAGE_URL})` } };
  const failures: Array<[string, typeof fetchWithTransientRetries]> = [
    ["404", (url, init) => fetchWithTransientRetries(url, init, { fetchImpl: async () => new Response("Missing", { status: 404 }) })],
    ["HTTP error response", async () => new Response("Missing", { status: 404, headers: { "content-type": "image/webp" } })],
    ["transient", async () => { throw new TransientHttpError("Source unavailable"); }],
    ["bad content type", async () => new Response("HTML", { headers: { "content-type": "text/html" } })],
    ["empty body", async () => new Response(null, { headers: { "content-type": "image/webp" } })],
    ["body read failure", async () => new Response(new ReadableStream({ start(controller) { controller.error(new Error("Interrupted body")); } }), { headers: { "content-type": "image/webp" } })],
  ];
  for (const [name, fetchSource] of failures) {
    assert.equal(await downloadCoverSource(artifact, directory, fetchSource), null, name);
  }
});

test("corrupt used body image bytes fail cover decoding and never use the importer fallback", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "article-cover-corrupt-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const artifact = { manifest: manifest(), finalJson: { title: "Tested article", slug: SLUG, content_md: `## First\n\n![First image](${IMAGE_URL})` } };
  const valid = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).webp().toBuffer();
  for (const bytes of [Buffer.from("Broken image"), valid.subarray(0, 12)]) {
    await assert.rejects(downloadCoverSource(artifact, directory, async () => new Response(new Uint8Array(bytes), { headers: { "content-type": "image/webp" } })), /unsupported image format|corrupt header/i);
    assert.deepEqual(await readdir(directory), []);
  }
});

test("cover staging write failures remain operational failures", async () => {
  const artifact = { manifest: manifest(), finalJson: { title: "Tested article", slug: SLUG, content_md: `## First\n\n![First image](${IMAGE_URL})` } };
  const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).webp().toBuffer();
  await assert.rejects(downloadCoverSource(artifact, "/dev/null", async () => new Response(new Uint8Array(bytes), { headers: { "content-type": "image/webp" } })), /ENOTDIR/);
});

test("production snapshot requires exact content, body images, and provenance", () => {
  const content = `## First\n\n![First image](${IMAGE_URL})`;
  const input = {
    finalJson: { title: "Tested article", slug: SLUG, content_md: content },
    manifest: manifest(),
    article: {
      id: "article-id",
      slug: SLUG,
      title: "Tested article",
      cover_image: `https://media.bloxodes.com/articles/${SLUG}/cover.webp`,
      content_md: content,
      is_published: true,
    },
    provenance: [
      {
        public_url: IMAGE_URL,
        uploaded_path: `articles/${SLUG}/sources/first.webp`,
        original_url: "https://example.com/first.png",
      },
    ],
  };
  assert.doesNotThrow(() => assertProductionSnapshot(input));
  assert.throws(
    () => assertProductionSnapshot({ ...input, article: { ...input.article, content_md: `${content}\nchanged` } }),
    /does not match the normalized/,
  );
  assert.throws(
    () => assertProductionSnapshot({ ...input, provenance: [] }),
    /provenance rows mismatch/,
  );
  const devUrl = `https://bbtcaurrtyoukvjbxbbj.supabase.co/storage/v1/object/public/article-media/articles/${SLUG}/sources/first.webp`;
  const devContent = content.replace(IMAGE_URL, devUrl);
  assert.throws(() => assertProductionSnapshot({
    ...input,
    finalJson: {...input.finalJson, content_md: devContent},
    manifest: {...input.manifest, entries: input.manifest.entries.map(entry => entry.status === "verified" ? {...entry, public_url: devUrl} : entry)},
    article: {...input.article, content_md: devContent},
  }), /promoted body image is not hosted/);
});

test("production readback allows unused verified development entries and zero body images", () => {
  const input = manifest();
  input.entries[0]!.public_url = `https://development.supabase.co/storage/v1/object/public/media/${input.entries[0]!.uploaded_path}`;
  const content = "## First\n\nWritten instructions only.";
  const snapshot = {
    finalJson: { title: "Tested article", slug: SLUG, content_md: content },
    manifest: input,
    article: { id: "article-id", slug: SLUG, title: "Tested article", cover_image: `https://media.bloxodes.com/articles/${SLUG}/cover.webp`, content_md: content, is_published: true },
    provenance: [],
  };
  assert.doesNotThrow(() => assertProductionSnapshot(snapshot));
});

test("production readback compares only used verified entries, including block-only images", () => {
  const input = manifest();
  input.entries.push({ ...input.entries[0]!, id: "unused", label: "Unused image", uploaded_path: `articles/${SLUG}/sources/unused.webp`, public_url: `https://development.supabase.co/storage/v1/object/public/media/articles/${SLUG}/sources/unused.webp` });
  input.expected_count += 1;
  const content = ["## First", "", "```tier-list", "schema: 1", "id: weapons", "title: Weapon rankings", "tiers:", "  - rank: S", "    items:", "      - name: Sword", `        image: ${IMAGE_URL}`, "        alt: First image", "```"].join("\n");
  const snapshot = {
    finalJson: { title: "Tested article", slug: SLUG, content_md: content },
    manifest: input,
    article: { id: "article-id", slug: SLUG, title: "Tested article", cover_image: `https://media.bloxodes.com/articles/${SLUG}/cover.webp`, content_md: content, is_published: true },
    provenance: [{ public_url: IMAGE_URL, uploaded_path: `articles/${SLUG}/sources/first.webp`, original_url: "https://example.com/first.png" }],
  };
  assert.doesNotThrow(() => assertProductionSnapshot(snapshot));
  assert.throws(() => assertProductionSnapshot({ ...snapshot, provenance: [] }), /provenance rows mismatch/);
  const unknownContent = content.replace(IMAGE_URL, "https://media.bloxodes.com/unapproved.webp");
  assert.throws(() => assertProductionSnapshot({ ...snapshot, finalJson: { ...snapshot.finalJson, content_md: unknownContent }, article: { ...snapshot.article, content_md: unknownContent } }), /body image URLs mismatch/);
});

test("production credentials accept only the canonical production target", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "bloxodes-article-release-test-"));
  try {
    const validPath = path.join(directory, "production.env");
    await writeFile(
      validPath,
      [
        "SUPABASE_URL=https://database.bloxodes.com",
        "SUPABASE_SERVICE_ROLE=service-role",
        "SUPABASE_MEDIA_BUCKET=media",
        "SUPABASE_MEDIA_PUBLIC_URL=https://media.bloxodes.com",
      ].join("\n"),
    );
    assert.equal((await readProductionCredentials(validPath)).url, "https://database.bloxodes.com");

    const invalidPath = path.join(directory, "development.env");
    await writeFile(
      invalidPath,
      [
        "SUPABASE_URL=https://development.supabase.co",
        "SUPABASE_SERVICE_ROLE=service-role",
        "SUPABASE_MEDIA_BUCKET=media",
        "SUPABASE_MEDIA_PUBLIC_URL=https://media.bloxodes.com",
      ].join("\n"),
    );
    await assert.rejects(readProductionCredentials(invalidPath), /does not target/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("production snapshot keeps distinct images when their source URL is shared", () => {
  const sharedManifest: ArticleImageManifest = {
    schema: 1,
    article_slug: "shared-source-image-test",
    visual_type: "other",
    required: true,
    expected_count: 2,
    entries: [
      {
        id: "one",
        label: "First image",
        required: true,
        placement_heading: "First image",
        status: "verified",
        source_page_url: "https://example.com/first",
        original_image_url: "https://cdn.example.com/shared.png",
        uploaded_path: "articles/shared-source-image-test/sources/one.webp",
        public_url: "https://media.bloxodes.com/storage/v1/object/public/media/articles/shared-source-image-test/sources/one.webp",
        alt: "First image",
      },
      {
        id: "two",
        label: "Second image",
        required: true,
        placement_heading: "Second image",
        status: "verified",
        source_page_url: "https://example.com/second",
        original_image_url: "https://cdn.example.com/shared.png",
        uploaded_path: "articles/shared-source-image-test/sources/two.webp",
        public_url: "https://media.bloxodes.com/storage/v1/object/public/media/articles/shared-source-image-test/sources/two.webp",
        alt: "Second image",
      },
    ],
  };
  const contentMd = [
    `![First image](${sharedManifest.entries[0]!.public_url})`,
    `![Second image](${sharedManifest.entries[1]!.public_url})`,
  ].join("\n\n");

  assert.doesNotThrow(() => {
    assertProductionSnapshot({
      finalJson: { title: "Shared source image test", slug: sharedManifest.article_slug, content_md: contentMd },
      manifest: sharedManifest,
      article: {
        id: "article-id",
        slug: sharedManifest.article_slug,
        title: "Shared source image test",
        cover_image: "https://media.bloxodes.com/storage/v1/object/public/media/covers/shared-source-image-test.webp",
        content_md: contentMd,
        is_published: true,
      },
      provenance: [
        {
          public_url: sharedManifest.entries[0]!.public_url!,
          uploaded_path: sharedManifest.entries[0]!.uploaded_path!,
          original_url: sharedManifest.entries[0]!.original_image_url!,
        },
        {
          public_url: sharedManifest.entries[1]!.public_url!,
          uploaded_path: sharedManifest.entries[1]!.uploaded_path!,
          original_url: sharedManifest.entries[1]!.original_image_url!,
        },
      ],
    });
  });
});

test("production snapshot tolerates importer-only Markdown line-ending normalization", () => {
  const finalJson = {
    title: "Whitespace normalization test",
    slug: "whitespace-normalization-test",
    content_md: "## Guide\n\nKeep the first unlock practical.\n",
  };
  assert.doesNotThrow(() => {
    assertProductionSnapshot({
      finalJson,
      manifest: { schema: 1, article_slug: finalJson.slug, visual_type: "other", required: true, expected_count: 0, entries: [] },
      article: {
        id: "article-id",
        slug: finalJson.slug,
        title: finalJson.title,
        cover_image: "https://media.bloxodes.com/storage/v1/object/public/media/covers/whitespace-normalization-test.webp",
        content_md: finalJson.content_md.trim(),
        is_published: true,
      },
      provenance: [],
    });
  });
});
