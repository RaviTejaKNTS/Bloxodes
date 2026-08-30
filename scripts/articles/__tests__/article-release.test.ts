import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { ArticleImageManifest } from "../../content/article-image-readiness";
import {
  assertProductionSnapshot,
  parseReleaseOptions,
  pickCoverSourceEntry,
  productionChildEnvironment,
  readProductionCredentials,
  type ProductionCredentials,
} from "../release-completed-articles";

const QUEUE_ID = "123e4567-e89b-42d3-a456-426614174000";
const SLUG = "tested-article";
const IMAGE_URL = `https://media.bloxodes.com/articles/${SLUG}/sources/first.webp`;

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

test("release uses the first verified image as the deterministic cover source", () => {
  assert.equal(pickCoverSourceEntry(manifest())?.id, "first");
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
