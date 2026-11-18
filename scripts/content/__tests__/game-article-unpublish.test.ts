import test from "node:test";
import assert from "node:assert/strict";
import { gameArticleFinalSchema } from "../../../contracts/game-article/v1/schema";
import { gameArticlePayload, publishGameArticleBundle } from "../game-article-publish";
import { unpublishGameArticle, verifyGameArticleGone } from "../game-article-unpublish";
import { assertUnpublishScope, assertUpdatePublishedScope, parseContentOptions } from "../wiki-content-options";

const GAME = { id: "game-gta-6", namespace: "gta", slug: "gta-6", kind: "game" };
const OTHER = { id: "game-rdr-2", namespace: "red-dead", slug: "red-dead-redemption-2", kind: "game" };
const ARTICLE = {
  id: "article-1", namespace: "gta", game_id: GAME.id, slug: "gta-6-100-percent-completion-checklist", title: "Checklist",
  content_md: "Body", cover_image: "https://media.bloxodes.com/a.webp", author_id: "author-1", tags: [], faq_json: [], sources_json: [],
  canonical_path: "/articles/gta-6-100-percent-completion-checklist", is_published: true,
  published_at: "2026-11-10T00:00:00Z", created_at: "2026-11-10T00:00:00Z", updated_at: "2026-11-10T00:00:00Z",
};
const bundle = { slug: ARTICLE.slug, namespace: "gta", game: { slug: "gta-6", kind: "game" } };

// Minimal PostgREST stand-in: eq filters, select, single/maybeSingle and update.
function fakeDb(pages: any[]) {
  const writes: any[] = [];
  const tables: Record<string, () => any[]> = {
    games: () => [GAME, OTHER],
    game_article_pages: () => pages,
    game_article_pages_view: () => pages.filter(page => page.is_published),
    search_index: () => pages.map(page => ({ entity_type: "game_article", entity_id: page.id, is_published: page.is_published })),
    site_routes: () => pages.map(page => ({ path: page.canonical_path, source: "game", page_type: "article", page_id: page.id, game_id: page.game_id, status: "live" })),
  };
  const db = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let patch: Record<string, unknown> | null = null;
      const rows = () => tables[table]().filter(row => filters.every(([key, value]) => row[key] === value));
      const finish = (single: boolean) => {
        let found = rows();
        if (patch) {
          writes.push({ table, patch, filters: [...filters] });
          for (const row of found) Object.assign(row, patch, { updated_at: "2026-11-18T00:00:00Z" });
        }
        found = found.map(row => structuredClone(row));
        if (found.length > 1) return Promise.resolve({ data: null, error: { message: "multiple rows" } });
        if (single && !found.length) return Promise.resolve({ data: null, error: { message: "no rows" } });
        return Promise.resolve({ data: found[0] ?? null, error: null });
      };
      const query: any = {
        select: () => query,
        update: (values: Record<string, unknown>) => { patch = values; return query; },
        eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
        single: () => finish(true),
        maybeSingle: () => finish(false),
      };
      return query;
    },
  };
  return { db: db as any, writes };
}

const lines = () => { const out: string[] = []; return { out, log: (line: string) => out.push(line) }; };

test("unpublish dry run writes nothing", async () => {
  const pages = [structuredClone(ARTICLE)];
  const { db, writes } = fakeDb(pages);
  const { out, log } = lines();
  const result = await unpublishGameArticle(bundle, { db, target: "production", apply: false, log });
  assert.equal(result.applied, false);
  assert.equal(writes.length, 0);
  assert.equal(pages[0].is_published, true);
  assert.ok(out.some(line => line.includes("no writes")));
});

test("unpublish apply sets only is_published, reads back and revalidates", async () => {
  const pages = [structuredClone(ARTICLE)];
  const { db, writes } = fakeDb(pages);
  const calls: string[] = [];
  const { log } = lines();
  const result = await unpublishGameArticle(bundle, {
    db, target: "production", apply: true, log,
    assertPublication: async () => { calls.push("guard"); },
    lock: async () => async () => { calls.push("unlock"); },
    revalidate: async slug => { calls.push(`revalidate:${slug}`); },
    verifyGone: async url => { calls.push(`gone:${url}`); },
  });
  assert.equal(result.applied, true);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].patch, { is_published: false });
  assert.deepEqual(writes[0].filters, [["id", ARTICLE.id], ["namespace", "gta"], ["game_id", GAME.id], ["is_published", true], ["updated_at", ARTICLE.updated_at]]);
  assert.equal(pages.length, 1, "row is kept");
  assert.equal(pages[0].is_published, false);
  for (const field of ["content_md", "author_id", "published_at", "created_at", "cover_image", "title"] as const) assert.equal(pages[0][field], ARTICLE[field]);
  assert.deepEqual(calls, ["guard", `revalidate:${ARTICLE.slug}`, `gone:https://bloxodes.com/articles/${ARTICLE.slug}`, "unlock"]);
});

test("unpublish refuses an article owned by another game", async () => {
  const pages = [{ ...structuredClone(ARTICLE), namespace: "red-dead", game_id: OTHER.id }];
  const { db, writes } = fakeDb(pages);
  await assert.rejects(unpublishGameArticle(bundle, { db, target: "managed-dev", apply: true, log: () => {} }), /another game/);
  const wrongGame = { ...bundle, game: { slug: "red-dead-redemption-2", kind: "game" } };
  await assert.rejects(unpublishGameArticle(wrongGame, { db: fakeDb([structuredClone(ARTICLE)]).db, target: "managed-dev", apply: true, log: () => {} }), /does not exist|another game/);
  assert.equal(writes.length, 0);
  assert.equal(pages[0].is_published, true);
});

test("unpublish refuses missing and already-unpublished articles", async () => {
  const hidden = [{ ...structuredClone(ARTICLE), is_published: false }];
  const first = fakeDb(hidden);
  await assert.rejects(unpublishGameArticle(bundle, { db: first.db, target: "managed-dev", apply: true, log: () => {} }), /already unpublished/);
  assert.equal(first.writes.length, 0);
  const empty = fakeDb([]);
  await assert.rejects(unpublishGameArticle(bundle, { db: empty.db, target: "managed-dev", apply: false, log: () => {} }), /does not exist/);
});

test("production apply refuses without its guards", async () => {
  const { db, writes } = fakeDb([structuredClone(ARTICLE)]);
  await assert.rejects(unpublishGameArticle(bundle, { db, target: "production", apply: true, log: () => {} }), /requires publication guard/);
  assert.equal(writes.length, 0);
});

test("live check waits for a 404 and fails on a page that stays up", async () => {
  let status = 200;
  const fetchPage = (async () => new Response("", { status })) as typeof fetch;
  await assert.rejects(verifyGameArticleGone("https://bloxodes.com/articles/x", { attempts: 2, delayMs: 1, fetchPage }), /HTTP 200/);
  status = 404;
  await verifyGameArticleGone("https://bloxodes.com/articles/x", { attempts: 1, delayMs: 1, fetchPage });
});

test("--unpublish is explicit, game-article only and leaves normal publish unchanged", async () => {
  const normal = parseContentOptions(["publish", "/bundle"]);
  assert.equal(normal.unpublish, undefined);
  assert.equal(normal.apply, false);
  const update = parseContentOptions(["publish", "/bundle", "--update-published"]);
  assert.equal(update.unpublish, undefined);
  assert.doesNotThrow(() => assertUpdatePublishedScope(update, "game-article@1"));
  const unpublish = parseContentOptions(["publish", "/bundle", "--unpublish"]);
  assert.equal(unpublish.unpublish, true);
  assert.equal(unpublish.apply, false, "dry run by default");
  assert.equal(parseContentOptions(["publish", "/bundle", "--unpublish", "--target", "production", "--apply", "--allow-prod"]).apply, true);
  assert.throws(() => parseContentOptions(["publish", "/bundle", "--unpublish", "--target", "production", "--apply"]));
  assert.throws(() => parseContentOptions(["publish", "/bundle", "--unpublish", "--update-published"]));
  assert.throws(() => parseContentOptions(["publish", "/bundle", "--unpublish", "--only", "hub"]));
  assert.throws(() => parseContentOptions(["status", "--article", "x", "--unpublish"]));
  assert.doesNotThrow(() => assertUnpublishScope(unpublish, "game-article@1"));
  for (const contract of ["article@1", "game-wiki@1", "roblox-wiki@1", "stats-report@1", "article-links@1"]) assert.throws(() => assertUnpublishScope(unpublish, contract));
  for (const contract of ["article@1", "game-wiki@1"]) assert.doesNotThrow(() => assertUnpublishScope(normal, contract));
  // The publish path still writes live articles and refuses to be used for unpublishing.
  const final = gameArticleFinalSchema.parse({ slug: ARTICLE.slug, title: "Checklist", content_md: "Body text", sources_json: [] });
  assert.equal(gameArticlePayload(final, "gta", GAME.id).is_published, true);
  assert.throws(() => gameArticleFinalSchema.parse({ ...final, is_published: false }));
  await assert.rejects(publishGameArticleBundle({ ...unpublish }), /unpublish path/);
});
