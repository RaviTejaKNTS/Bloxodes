import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { MANAGED_TARGET, managedGamePagesPayload, parseGameIdentities, productionGameIdentities, referencedGameIds } from "../managed-game-identities.mjs";

const prodGame = "b95a66e8-6af0-4d2f-b08b-1288e66fb83b";
const devGame = "d682d654-70a2-460b-a010-93a9a7851467";
const root = "6a1f0c33-5d3a-4c7e-9e57-1f2b6e3a9c01";
const quiz = "07bdb7b2-6765-442b-bfd1-f4b96051a658";
const identity = { id: prodGame, namespace: "example", slug: "example-2", kind: "game" };

// Development: the franchise root shares its ID, the game was created separately.
function development({ games = [{ id: root, namespace: "example", slug: "example", kind: "franchise" }, { id: devGame, namespace: "example", slug: "example-2", kind: "game" }], pages = [], tasks = [] } = {}) {
  return {
    checklistItems: async ({ namespace, page_id }) => tasks.filter(task => task.namespace === namespace && task.page_id === page_id).map(({ id, item_key }) => ({ id, item_key })),
    gameById: async id => games.find(game => game.id === id) ?? null,
    gameByIdentity: async ({ namespace, slug, kind }) => games.find(game => game.namespace === namespace && game.slug === slug && game.kind === kind)?.id ?? null,
    pageId: async (table, filters) => pages.find(page => page.table === table && Object.entries(filters).every(([key, value]) => page[key] === value))?.id ?? null,
  };
}
const quizPayload = () => ({ quizzes: [{ id: quiz, namespace: "example", game_id: prodGame, slug: "example-2", title: "Example Quiz", is_published: true }] });

test("a page authored with a production game ID maps to the same development game", async () => {
  const payload = quizPayload();
  const result = await managedGamePagesPayload({ payload, namespace: "example", identities: [identity], target: MANAGED_TARGET, lookup: development() });
  assert.equal(result.payload.quizzes[0].game_id, devGame);
  assert.equal(result.payload.quizzes[0].id, quiz);
  assert.deepEqual(result.changes, [{ group: "games", from: prodGame, to: devGame }]);
  assert.equal(payload.quizzes[0].game_id, prodGame, "the reviewed input is never modified");
});

test("games that already share an ID are left alone", async () => {
  const payload = { wiki: [{ namespace: "example", game_id: root, slug: "example", title: "Example" }] };
  const result = await managedGamePagesPayload({ payload, namespace: "example", identities: [], target: MANAGED_TARGET, lookup: development() });
  assert.deepEqual(result.changes, []);
  assert.equal(result.payload.wiki[0].game_id, root);
});

test("an unknown game still fails", async () => {
  // Production identity known, but no development game has that namespace, slug and kind.
  await assert.rejects(managedGamePagesPayload({ payload: quizPayload(), namespace: "example", identities: [{ ...identity, slug: "missing" }], target: MANAGED_TARGET, lookup: development() }), /No managed development game matches production game example\/missing \(game\)/);
  await assert.rejects(managedGamePagesPayload({ payload: quizPayload(), namespace: "example", identities: [{ ...identity, kind: "franchise" }], target: MANAGED_TARGET, lookup: development() }), /No managed development game matches/);
  // No production identity at all: the ID stays as authored so the publisher's ownership check rejects it.
  const unresolved = await managedGamePagesPayload({ payload: quizPayload(), namespace: "example", identities: [], target: MANAGED_TARGET, lookup: development() });
  assert.equal(unresolved.payload.quizzes[0].game_id, prodGame);
  assert.deepEqual(unresolved.changes, []);
  // A production game from another namespace never maps.
  await assert.rejects(managedGamePagesPayload({ payload: quizPayload(), namespace: "example", identities: [{ ...identity, namespace: "other" }], target: MANAGED_TARGET, lookup: development() }), /belongs to namespace other/);
});

test("mapping refuses every target except managed development", async () => {
  for (const target of ["https://database.bloxodes.com", "https://bloxodesdb.ravitejaknts.com", "https://other.supabase.co", undefined]) {
    await assert.rejects(managedGamePagesPayload({ payload: quizPayload(), namespace: "example", identities: [identity], target, lookup: development() }), /only against the managed development target/);
  }
});

test("existing development pages and batch games keep their development IDs", async () => {
  const devQuiz = "2f0d5a8e-0b9c-4a43-8a35-7d1f8c6b2e10";
  const devCodes = "9c3e4b7a-1d2f-4e5a-b6c7-d8e9f0a1b2c3";
  const prodCodes = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
  const payload = {
    games: [{ id: prodGame, namespace: "example", parent_id: root, slug: "example-2", kind: "game", title: "Example 2" }],
    quizzes: quizPayload().quizzes,
    codesPages: [{ id: prodCodes, game_id: prodGame, slug: "example-2", title: "Example 2 Codes" }],
    codes: [{ code_page_id: prodCodes, code: "FREE", status: "active" }],
  };
  const lookup = development({ pages: [{ table: "game_quiz_pages", namespace: "example", slug: "example-2", id: devQuiz }, { table: "game_code_pages", game_id: devGame, id: devCodes }] });
  const result = await managedGamePagesPayload({ payload, namespace: "example", identities: [], target: MANAGED_TARGET, lookup });
  assert.equal(result.payload.games[0].id, devGame);
  assert.equal(result.payload.games[0].parent_id, root);
  assert.equal(result.payload.quizzes[0].game_id, devGame);
  assert.equal(result.payload.quizzes[0].id, devQuiz);
  assert.equal(result.payload.codesPages[0].id, devCodes);
  assert.equal(result.payload.codes[0].code_page_id, devCodes);
});

test("two reviewed pages never collapse onto one development page", async () => {
  const devWiki = "4b1e2c3d-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
  const payload = { wiki: [
    { id: "5c2f3d4e-7a8b-4c9d-8e1f-2a3b4c5d6e7f", game_id: prodGame, slug: "example-2", title: "One" },
    { id: "6d3a4e5f-8b9c-4dae-9f2a-3b4c5d6e7f80", game_id: prodGame, slug: "example-2-b", title: "Two" },
  ] };
  const lookup = development({ pages: [{ table: "game_wiki_pages", game_id: devGame, id: devWiki }] });
  await assert.rejects(managedGamePagesPayload({ payload, namespace: "example", identities: [identity], target: MANAGED_TARGET, lookup }), /Several wiki rows map to development page/);
});

const prodChecklist = "7e4b5f60-9cad-4ebf-8a3b-4c5d6e7f8091";
const devChecklist = "8f5c6071-adbe-4fc0-9b4c-5d6e7f8091a2";
const prodTask = n => `0000000${n}-1111-4111-8111-111111111111`;
const devTask = n => `0000000${n}-2222-4222-8222-222222222222`;
const checklistPayload = (pageId = prodChecklist) => ({
  checklists: [{ id: pageId, namespace: "example", game_id: prodGame, slug: "example-2-100-percent", title: "Example 2 100%", is_public: true, published_at: "2026-11-01T00:00:00Z" }],
  checklistItems: [
    { id: prodTask(1), page_id: pageId, namespace: "example", item_key: "boss-one", section_code: "1", title: "Beat the first boss" },
    { id: prodTask(2), page_id: pageId, namespace: "example", item_key: "boss-two", section_code: "1", title: "Beat the second boss" },
    { id: prodTask(3), page_id: pageId, namespace: "example", item_key: "new-task", section_code: "2", title: "A task new in this batch" },
  ],
});
const devTasks = pageId => [
  { id: devTask(1), page_id: pageId, namespace: "example", item_key: "boss-one" },
  { id: devTask(2), page_id: pageId, namespace: "example", item_key: "boss-two" },
];

test("a checklist with a different development page UUID keeps the development page and task UUIDs", async () => {
  const payload = checklistPayload();
  const lookup = development({ pages: [{ table: "game_checklist_pages", namespace: "example", slug: "example-2-100-percent", id: devChecklist }], tasks: devTasks(devChecklist) });
  const result = await managedGamePagesPayload({ payload, namespace: "example", identities: [identity], target: MANAGED_TARGET, lookup });
  const [page] = result.payload.checklists;
  assert.equal(page.id, devChecklist);
  assert.equal(page.game_id, devGame);
  assert.deepEqual(result.payload.checklistItems.map(item => [item.page_id, item.item_key, item.id]), [
    [devChecklist, "boss-one", devTask(1)],
    [devChecklist, "boss-two", devTask(2)],
    [devChecklist, "new-task", prodTask(3)],
  ]);
  assert.deepEqual(result.changes.filter(change => change.group.startsWith("checklist")), [
    { group: "checklists", from: prodChecklist, to: devChecklist },
    { group: "checklistItems", from: prodTask(1), to: devTask(1) },
    { group: "checklistItems", from: prodTask(2), to: devTask(2) },
  ]);
  assert.equal(payload.checklists[0].id, prodChecklist, "the reviewed input is never modified");
  assert.equal(payload.checklistItems[0].id, prodTask(1));
});

test("a checklist with the same page UUID still maps retained task UUIDs", async () => {
  const lookup = development({ pages: [{ table: "game_checklist_pages", namespace: "example", slug: "example-2-100-percent", id: prodChecklist }], tasks: devTasks(prodChecklist) });
  const result = await managedGamePagesPayload({ payload: checklistPayload(), namespace: "example", identities: [identity], target: MANAGED_TARGET, lookup });
  assert.equal(result.payload.checklists[0].id, prodChecklist);
  assert.deepEqual(result.payload.checklistItems.map(item => [item.page_id, item.id]), [[prodChecklist, devTask(1)], [prodChecklist, devTask(2)], [prodChecklist, prodTask(3)]]);
  assert.equal(result.changes.some(change => change.group === "checklists"), false);
});

test("a checklist new to development passes through with its reviewed UUIDs", async () => {
  const result = await managedGamePagesPayload({ payload: checklistPayload(), namespace: "example", identities: [identity], target: MANAGED_TARGET, lookup: development() });
  assert.deepEqual(result.payload.checklists[0].id, prodChecklist);
  assert.deepEqual(result.payload.checklistItems.map(item => item.id), [prodTask(1), prodTask(2), prodTask(3)]);
  assert.deepEqual(result.changes, [{ group: "games", from: prodGame, to: devGame }]);
});

test("two reviewed checklists never collapse onto one development page", async () => {
  const payload = checklistPayload();
  payload.checklists.push({ ...payload.checklists[0], id: "9a6d7182-becf-4ad1-8c5d-6e7f8091a2b3", slug: "example-2-other" });
  const lookup = development({ pages: [
    { table: "game_checklist_pages", namespace: "example", slug: "example-2-100-percent", id: devChecklist },
    { table: "game_checklist_pages", namespace: "example", slug: "example-2-other", id: devChecklist },
  ] });
  await assert.rejects(managedGamePagesPayload({ payload, namespace: "example", identities: [identity], target: MANAGED_TARGET, lookup }), /Several checklists rows map to development page/);
});

test("production identities cover only games the selected game pages reference", async () => {
  const batch = { operations: [{ publisher: "game-pages", namespace: "example", file: "a.json" }, { publisher: "content-final", file: "b.json" }] };
  const payloads = { "a.json": { games: [{ id: root, slug: "example", kind: "franchise" }], quizzes: quizPayload().quizzes, wiki: [{ game_id: root }] } };
  assert.deepEqual(referencedGameIds(payloads["a.json"]), [prodGame]);
  let asked;
  const identities = await productionGameIdentities(batch, file => payloads[file], async ids => { asked = ids; return [{ ...identity }, { id: devGame, namespace: "example", slug: "x", kind: "game" }]; });
  assert.deepEqual(asked, [prodGame]);
  assert.deepEqual(identities, [identity]);
  assert.deepEqual(parseGameIdentities(JSON.stringify(identities)), identities);
  assert.deepEqual(parseGameIdentities(""), []);
  for (const bad of ["{}", JSON.stringify([{ ...identity, kind: "dlc" }]), JSON.stringify([identity, identity]), JSON.stringify([{ ...identity, extra: 1 }])]) assert.throws(() => parseGameIdentities(bad));
});

test("production publication never maps IDs and identities reach only managed QA", () => {
  const publisher = fs.readFileSync(new URL("../publish-content.ts", import.meta.url), "utf8");
  assert.match(publisher, /const mappedFile = managed && operation\.publisher === "game-pages" \? await managedGamePagesFile/);
  assert.doesNotMatch(fs.readFileSync(new URL("../../games/publish-game-pages.ts", import.meta.url), "utf8"), /managed-game-identities|PRODUCTION_GAME_IDENTITIES/);
  const selected = fs.readFileSync(new URL("../../../.github/workflows/publish-content.yml", import.meta.url), "utf8");
  const identityJob = selected.split("\n  game-identities:\n")[1].split("\n  managed:\n")[0];
  const install = identityJob.split("\n      - run: npm ci")[0];
  assert.doesNotMatch(install, /secrets\./, "no secret reaches dependency installation");
  assert.match(identityJob.split("id: lookup")[1], /SUPABASE_SERVICE_ROLE: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE \}\}/);
  const publishJob = selected.split("\n  publish:\n")[1];
  assert.doesNotMatch(publishJob, /PRODUCTION_GAME_IDENTITIES|game_identities/);
  assert.match(selected, /game_identities: \$\{\{ needs\.game-identities\.outputs\.games \}\}/);
  const qa = fs.readFileSync(new URL("../../../.github/workflows/managed-content-qa.yml", import.meta.url), "utf8");
  assert.match(qa, /test "\$SUPABASE_URL" = https:\/\/bbtcaurrtyoukvjbxbbj\.supabase\.co/);
  assert.match(qa, /BLOXODES_PRODUCTION_GAME_IDENTITIES: \$\{\{ inputs\.game_identities \}\}/);
});
