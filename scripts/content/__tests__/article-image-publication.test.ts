import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectableArticleImages } from "../collect-article-images";
import { findArticleImages, usedVerifiedArticleImages, type ArticleImageManifest, type ArticleImageEntry } from "../article-image-readiness";
import { removeUnusedArticleImageProvenance, syncArticleImageProvenance } from "../sync-article-image-provenance";
import { syncImageProvenance } from "../verify-article-finals";
import { verifyArticleBrowser } from "../verify-article-browser";
import { assertProductionSnapshot } from "../../articles/release-completed-articles";

const slug = "publication-selection";
function manifest(): ArticleImageManifest {
  return { schema: 1, article_slug: slug, visual_type: "items", required: true, expected_count: 4, entries: ["used", "unused", "local", "rejected"].map((id): ArticleImageEntry => ({
    id, label: `${id} screenshot`, required: true, placement_heading: "Recipe",
    status: id === "rejected" ? "accepted_missing" : "verified",
    public_url: id === "local" ? "/games/sword.webp" : `https://development.supabase.co/storage/v1/object/public/media/articles/${slug}/sources/${id}.webp`,
    uploaded_path: `articles/${slug}/sources/${id}.webp`,
    original_image_url: `https://wiki.example/${id}.png`, source_page_url: `https://wiki.example/${id}`,
    missing_reason: "The reviewer rejected this unrelated screenshot.", acceptance_note: "Written recipe instructions cover this optional image.",
    search_queries: ["sword recipe screenshot", "sword upgrade screenshot"], searched_source_urls: ["https://wiki.example/recipe", "https://guide.example/upgrade"],
    match_evidence: "The screenshot shows the exact weapon recipe.", rights_note: "Gameplay screenshot with recorded credit.", alt: "Weapon recipe requirements", width: 1280, height: 720,
  })) };
}
function block(src: string) {
  return ["```tier-list", "schema: 1", "id: weapons", "title: Weapons ranked", "tiers:", "  - rank: S", "    items:", "      - name: Sword", `        image: ${src}`, "        alt: Weapon recipe requirements", "```"].join("\n");
}
function body(input: ArticleImageManifest) {
  return `## Recipe\n\n${block(input.entries[0]!.public_url!)}\n\n![Weapon recipe requirements](${input.entries[2]!.public_url})\n\nUnused audit URL: ${input.entries[1]!.public_url}`;
}

test("publication collector selects body images and pre-writing collection retains all approved candidates", () => {
  const input = manifest();
  const finalJson = { slug, content_md: body(input) };
  assert.deepEqual(usedVerifiedArticleImages(input, finalJson.content_md).map(entry => entry.id), ["used", "local"]);
  assert.deepEqual(collectableArticleImages(input, finalJson).map(entry => entry.id), ["used"]);
  assert.deepEqual(collectableArticleImages(input, null).map(entry => entry.id), ["used", "unused"]);
  assert.deepEqual(collectableArticleImages(input, { slug, content_md: "Written instructions only." }), []);
  assert.deepEqual(findArticleImages(finalJson.content_md).map(image => image.src).sort(), [input.entries[0]!.public_url, input.entries[2]!.public_url].sort());
});

test("publication collector skips unused assets before any credentials or upload are required", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "article-collector-selection-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = manifest();
  const mediaPath = path.join(directory, "media.json"), finalPath = path.join(directory, "final.json");
  const before = `${JSON.stringify(input)}\n`;
  await writeFile(mediaPath, before);
  await writeFile(finalPath, JSON.stringify({ slug, content_md: `## Recipe\n\nAudit URL: ${input.entries[0]!.public_url}` }));
  const outputPath = path.join(directory, "collector.log");
  const output = openSync(outputPath, "w");
  try {
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/content/collect-article-images.ts", "--manifest", mediaPath, "--file", finalPath, "--apply", "--allow-prod"], {
      encoding: "utf8", env: { PATH: process.env.PATH, BLOXODES_ENV_PROFILE: "process-only", NODE_ENV: "production" }, stdio: ["ignore", output, "pipe"],
    });
    assert.equal(result.status, 0, result.stderr);
  } finally { closeSync(output); }
  assert.match(await readFile(outputPath, "utf8"), /promotable=0[\s\S]*collection complete: uploaded=0/);
  assert.equal(await readFile(mediaPath, "utf8"), before);
});

test("the file-only readiness command reports unused verified development images", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "article-readiness-selection-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const mediaPath = path.join(directory, "media.json"), finalPath = path.join(directory, "final.json"), outputPath = path.join(directory, "readiness.log");
  await writeFile(mediaPath, JSON.stringify(manifest()));
  await writeFile(finalPath, JSON.stringify({ slug, content_md: "## Recipe\n\nWritten instructions only." }));
  const output = openSync(outputPath, "w");
  try {
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/content/check-article-image-readiness.ts", "--manifest", mediaPath, "--file", finalPath], {
      encoding: "utf8", env: { PATH: process.env.PATH, BLOXODES_ENV_PROFILE: "process-only", SUPABASE_URL: "https://database.bloxodes.com" }, stdio: ["ignore", output, "pipe"],
    });
    assert.equal(result.status, 0, result.stderr);
  } finally { closeSync(output); }
  assert.match(await readFile(outputPath, "utf8"), /verified=3 uploaded=2 inserted=0 unused=3/);
});

function mockProvenanceClient(content_md: string, canonicalizeStoredUrls = false) {
  const payloads: Array<Record<string, unknown>> = [];
  const lookups: string[] = [];
  const rows: Array<Record<string, unknown>> = [];
  const deletions: string[][] = [];
  let cleanupError: string | null = null;
  let insertError: string | null = null;
  const storedPayload = (payload: Record<string, unknown>) => canonicalizeStoredUrls ? {
    ...payload,
    // Match the database trigger, which rewrites hosts but preserves whitespace.
    public_url: String(payload.public_url)
      .replaceAll("https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/", "https://media.bloxodes.com/storage/v1/object/public/")
      .replaceAll("https://database.bloxodes.com/storage/v1/object/public/", "https://media.bloxodes.com/storage/v1/object/public/"),
  } : payload;
  const client = {
    from(table: string) {
      assert.ok(["articles", "article_source_images"].includes(table));
      const filters = new Map<string, unknown>();
      let operation = "select";
      let update: Record<string, unknown> | null = null;
      let ids: string[] = [];
      const matches = (row: Record<string, unknown>) => [...filters].every(([column, value]) => row[column] === value);
      const query = {
        select(_columns: string) { return query; },
        eq(column: string, value: string) { filters.set(column, value); if (column === "uploaded_path") lookups.push(value); return query; },
        in(column: string, values: string[]) { assert.equal(column, "id"); ids = values; return query; },
        limit(_count: number) { return query; },
        async maybeSingle() { return { data: table === "articles" ? { id: "article-id", slug, content_md } : rows.find(matches) ?? null, error: null }; },
        async insert(payload: Record<string, unknown>) {
          if (insertError) return { error: { message: insertError } };
          payloads.push(payload); rows.push({ id: `row-${payloads.length}`, ...storedPayload(payload) }); return { error: null };
        },
        update(payload: Record<string, unknown>) { operation = "update"; update = payload; return query; },
        delete() { operation = "delete"; return query; },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          const execute = () => {
            assert.equal(table, "article_source_images");
            assert.equal(filters.get("article_id"), "article-id", "Every provenance read or mutation must stay scoped to this article");
            if (operation === "delete") {
              if (cleanupError) return { error: { message: cleanupError } };
              deletions.push(ids);
              for (let index = rows.length - 1; index >= 0; index -= 1) {
                if (matches(rows[index]!) && ids.includes(String(rows[index]!.id))) rows.splice(index, 1);
              }
            } else if (operation === "update") {
              for (const row of rows.filter(matches)) Object.assign(row, storedPayload(update!));
            }
            return { data: rows.filter(matches), error: null };
          };
          return Promise.resolve().then(execute).then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as NonNullable<Parameters<typeof syncImageProvenance>[2]>;
  return { client, payloads, lookups, rows, deletions,
    setContent(value: string) { content_md = value; },
    failCleanup(message: string | null) { cleanupError = message; },
    failInsert(message: string | null) { insertError = message; },
  };
}

for (const sync of ["standalone", "final verification"] as const) {
  for (const host of ["development.supabase.co", "bmwksaykcsndsvgspapz.supabase.co", "database.bloxodes.com"]) {
    test(`${sync} provenance trims payload URLs and retains the inserted row after cleanup for ${host}`, async () => {
      const input = manifest();
      const publicUrl = input.entries[0]!.public_url!.replace("development.supabase.co", host);
      input.entries[0]!.public_url = ` ${publicUrl} `;
      const storedUrl = host === "development.supabase.co" ? publicUrl : publicUrl.replace(host, "media.bloxodes.com");
      const content = `## Recipe\n\n${block(storedUrl)}`;
      const mock = mockProvenanceClient(content, true);
      const run = () => sync === "standalone"
        ? syncArticleImageProvenance(input, { apply: true }, mock.client)
        : syncImageProvenance([{ file: "media.json", manifest: input }], new Map([[slug, { id: "article-id", content_md: content }]]) as unknown as Parameters<typeof syncImageProvenance>[1], mock.client);
      await run();
      assert.equal(mock.payloads.length, 1);
      assert.equal(mock.payloads[0]!.public_url, publicUrl, "Payload URLs are trimmed without rewriting their host");
      assert.equal(mock.rows.length, 1, "The newly inserted provenance row must survive cleanup");
      assert.equal(mock.rows[0]!.public_url, storedUrl);
      const insertedId = mock.rows[0]!.id;
      mock.rows[0]!.public_url = ` ${storedUrl} `;
      await run();
      assert.equal(mock.rows.length, 1);
      assert.equal(mock.rows[0]!.id, insertedId);
      assert.equal(mock.rows[0]!.public_url, storedUrl, "Update payload URLs are trimmed too");
      assert.deepEqual(mock.deletions, []);
      assert.equal(input.entries[0]!.public_url, ` ${publicUrl} `);
    });
  }
  for (const refresh of ["drops all images", "swaps image A for image B"] as const) {
    test(`${sync} provenance sync and strict readback pass when a refresh ${refresh}`, async () => {
      const input = manifest();
      for (const entry of input.entries) entry.public_url = `https://media.bloxodes.com/${entry.uploaded_path}`;
      let content = `## Recipe\n\n${block(input.entries[0]!.public_url!)}`;
      const mock = mockProvenanceClient(content);
      const otherArticle = { id: "other-row", article_id: "other-article", public_url: input.entries[0]!.public_url };
      mock.rows.push(otherArticle);
      const run = async () => {
        mock.setContent(content);
        if (sync === "standalone") await syncArticleImageProvenance(input, { apply: true }, mock.client);
        else await syncImageProvenance([{ file: "media.json", manifest: input }], new Map([[slug, { id: "article-id", content_md: content }]]) as unknown as Parameters<typeof syncImageProvenance>[1], mock.client);
      };
      const readback = async () => {
        const { data: provenance } = await mock.client.from("article_source_images").select("public_url,uploaded_path,original_url").eq("article_id", "article-id");
        assertProductionSnapshot({
          manifest: input, finalJson: { title: "Weapon recipe", slug, content_md: content },
          article: { id: "article-id", title: "Weapon recipe", slug, content_md: content, cover_image: `https://media.bloxodes.com/articles/${slug}/cover.webp`, is_published: true },
          provenance: provenance as Parameters<typeof assertProductionSnapshot>[0]["provenance"],
        });
      };
      await run();
      await run();
      await readback();
      assert.equal(mock.rows.filter(row => row.article_id === "article-id").length, 1);
      const previousId = String(mock.rows.find(row => row.article_id === "article-id")!.id);
      content = refresh === "drops all images" ? "## Recipe\n\nWritten instructions." : `## Recipe\n\n${block(input.entries[1]!.public_url!)}`;
      await run();
      await readback();
      await run();
      await readback();
      assert.equal(input.entries[0]!.status, "verified");
      assert.deepEqual(mock.deletions, [[previousId]]);
      assert.ok(mock.rows.includes(otherArticle), "Another article's provenance must survive cleanup");
    });
  }
}

test("provenance cleanup normalizes stored URLs and body URLs while removing unrelated rows", async () => {
  const suffix = `storage/v1/object/public/media/articles/${slug}/sources/used.webp`;
  for (const [bodyHost, rowHost] of [
    ["media.bloxodes.com", "bmwksaykcsndsvgspapz.supabase.co"],
    ["database.bloxodes.com", "media.bloxodes.com"],
    ["bmwksaykcsndsvgspapz.supabase.co", "database.bloxodes.com"],
  ]) {
    const content = `![Weapon recipe requirements](https://${bodyHost}/${suffix})`;
    const mock = mockProvenanceClient(content);
    const retained = { id: "retained", article_id: "article-id", public_url: ` https://${rowHost}/${suffix} ` };
    mock.rows.push(retained,
      { id: "unrelated-host", article_id: "article-id", public_url: `https://development.supabase.co/${suffix}` },
      { id: "unused", article_id: "article-id", public_url: "https://media.bloxodes.com/unused.webp" });
    await removeUnusedArticleImageProvenance("article-id", content, mock.client);
    assert.deepEqual(mock.rows, [retained]);
    assert.deepEqual(mock.deletions, [["unrelated-host", "unused"]]);
  }
});

test("provenance dry runs preserve old rows and failed writes do not remove them", async () => {
  const input = manifest();
  const mock = mockProvenanceClient("Written instructions.");
  const old = { id: "old-row", article_id: "article-id", public_url: input.entries[1]!.public_url };
  mock.rows.push(old);
  await syncArticleImageProvenance(input, { apply: false }, mock.client);
  assert.deepEqual(mock.rows, [old]);
  assert.deepEqual(mock.deletions, []);

  mock.setContent(body(input));
  mock.failInsert("Write failed");
  await assert.rejects(syncArticleImageProvenance(input, { apply: true }, mock.client), /Write failed/);
  assert.deepEqual(mock.rows, [old]);
  assert.deepEqual(mock.deletions, []);
});

test("provenance cleanup errors fail sync so publication can retry", async () => {
  const mock = mockProvenanceClient("Written instructions.");
  mock.rows.push({ id: "old-row", article_id: "article-id", public_url: manifest().entries[0]!.public_url });
  mock.failCleanup("Delete failed");
  await assert.rejects(syncArticleImageProvenance(manifest(), { apply: true }, mock.client), /Failed to remove unused article article-id provenance: Delete failed/);
  mock.failCleanup(null);
  await syncArticleImageProvenance(manifest(), { apply: true }, mock.client);
  assert.deepEqual(mock.rows, []);
});

for (const content of ["selected", "empty"] as const) {
  test(`standalone provenance sync writes only used hosted entries for a ${content} body`, async () => {
    const input = manifest();
    const mock = mockProvenanceClient(content === "selected" ? body(input) : "Written instructions.");
    await syncArticleImageProvenance(input, { apply: true }, mock.client);
    assert.deepEqual(mock.lookups, content === "selected" ? [input.entries[0]!.uploaded_path] : []);
    assert.deepEqual(mock.payloads.map(payload => payload.public_url), content === "selected" ? [input.entries[0]!.public_url] : []);
  });

  test(`final verification provenance sync writes only used hosted entries for a ${content} body`, async () => {
    const input = manifest();
    const mock = mockProvenanceClient("");
    const rows = new Map([[slug, { id: "article-id", content_md: content === "selected" ? body(input) : "Written instructions." }]]) as unknown as Parameters<typeof syncImageProvenance>[1];
    await syncImageProvenance([{ file: "media.json", manifest: input }], rows, mock.client);
    assert.deepEqual(mock.lookups, content === "selected" ? [input.entries[0]!.uploaded_path] : []);
    assert.deepEqual(mock.payloads.map(payload => payload.public_url), content === "selected" ? [input.entries[0]!.public_url] : []);
  });
}

test("browser publication verification expects Markdown and structured images without unused audit URLs", async () => {
  const input = manifest();
  let closed = false;
  const launch = async () => ({ browser: { newPage: async () => ({}), close: async () => { closed = true; } }, executable: "mock-browser" });
  const expected = [input.entries[0]!.public_url!, input.entries[2]!.public_url!].sort();
  let checked = false;
  await verifyArticleBrowser([{ title: "Weapon recipe", slug, content: body(input) }], "http://preview.example", launch as unknown as Parameters<typeof verifyArticleBrowser>[2], async (_page, options) => {
    checked = true;
    assert.equal(options.url, `http://preview.example/articles/${slug}`);
    assert.deepEqual(options.expectedImageSources?.slice().sort(), expected);
  });
  assert.equal(checked, true);
  assert.equal(closed, true);
});
