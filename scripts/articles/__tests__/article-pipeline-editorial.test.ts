import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { REVIEW_CRITERIA, validateEditorialEvidence } from "../article-editorial-review";
import { runArticlePipeline, type Decision } from "../article-pipeline";
const pass: Decision = { status: "completed", summary: "Reviewed", findings: [], repair_stage: null, accepted_missing: [] };
const final = { title: "Fisch Appraisal", content_md: "Appraisal changes your fish.\n## Fisch Appraisal Cost\nIt costs 450 C$.", faq_json: [{ q: "Can I undo it?", a: "No." }] };
const evidence = () => ({ checks: REVIEW_CRITERIA.map(criterion => ({ criterion, verdict: "pass", quotes: ["Appraisal changes your fish."], assessment: "The draft explains the changed fish before pricing." })), faqs: [{ question: "Can I undo it?", adds_information: true, assessment: "Reversal is not answered in the body." }] });
test("editorial approval requires actual draft evidence and complete FAQ assessments", () => {
  assert.doesNotThrow(() => validateEditorialEvidence(pass, evidence(), final));
  assert.throws(() => validateEditorialEvidence(pass, {}, final), /missing structured/);
  const invented = evidence(); invented.checks[0].quotes = ["A quotation the reviewer invented."];
  assert.throws(() => validateEditorialEvidence(pass, invented, final), /actual draft quotations/);
  const repeated = evidence(); repeated.faqs[0].adds_information = false;
  assert.throws(() => validateEditorialEvidence(pass, repeated, final), /contradicts/);
  const missing = evidence(); missing.faqs = [];
  assert.throws(() => validateEditorialEvidence(pass, missing, final), /every FAQ/);
});
test("explicit revision forks retain approved artifacts and never reset the original run", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "article-fork-"));
  const source = path.join(dir, "original"), target = path.join(dir, "revision");
  const job = { id: "test", title: "Test", slug: "test", article_type: "guide", sources: [] };
  await runArticlePipeline({ job, runDir: source, deadline: Date.now() + 30_000, execute: async stage => {
    if (stage === "research") await writeFile(path.join(source, "content/brief.md"), "approved facts");
    if (stage === "images") await writeFile(path.join(source, "content/media.json"), "approved media");
    if (stage === "writing") await writeFile(path.join(source, "content/final.json"), "original draft");
    return pass;
  } });
  const baseline = await readFile(path.join(source, "state.json"), "utf8");
  const calls: string[] = [];
  const revised = await runArticlePipeline({ job, runDir: target, reviseFrom: source, revisionFeedback: "Remove repeated FAQs", deadline: Date.now() + 30_000,
    execute: async stage => { calls.push(stage); return pass; } });
  assert.equal(calls[0], "writing"); assert.ok(!calls.includes("research")); assert.ok(calls.includes("editorial_review"));
  assert.equal(revised.status, "completed"); assert.equal(revised.origin?.reason, "Remove repeated FAQs");
  assert.equal(await readFile(path.join(source, "state.json"), "utf8"), baseline);
  const reviewedStages: string[] = [];
  await runArticlePipeline({ job, runDir: path.join(dir, "review-first"), reviseFrom: source, reviewFirst: true, deadline: Date.now() + 30_000,
    execute: async stage => { reviewedStages.push(stage); return pass; } });
  assert.equal(reviewedStages[0], "editorial_review"); assert.ok(!reviewedStages.includes("writing"));
  assert.ok(reviewedStages.includes("browser_verify"));
  await writeFile(path.join(source, "content/brief.md"), "unapproved edits");
  await assert.rejects(runArticlePipeline({ job, runDir: path.join(dir, "bad"), reviseFrom: source, deadline: Date.now() + 30_000, execute: async () => pass }), /completed, unchanged/);
});

test("inventory routes strip collection code prefixes and refuse ambiguous ownership", async () => {
  const { inventoryPublicPath } = await import("../production-editorial-inventory");
  const hub = { family: "wiki", title: "Fisch", key: "fisch", universe_id: 1 };
  const collection = { family: "collection", title: "Fish", key: "fisch-fish", universe_id: 1 };
  assert.equal(inventoryPublicPath(collection, [hub, collection]), "/wiki/fisch/fish");
  assert.equal(inventoryPublicPath(collection, []), null);
  assert.equal(inventoryPublicPath(collection, [hub, { ...hub }]), null);
  assert.equal(inventoryPublicPath({ ...collection, universe_id: 2 }, [hub]), null);
});

test("run reports retain failed attempts and wall-time gaps", async () => {
  const { mkdir } = await import("node:fs/promises");
  const { writeArticleRunReport } = await import("../article-run-report");
  const dir = await mkdtemp(path.join(os.tmpdir(), "article-report-"));
  await writeFile(path.join(dir, "state.json"), JSON.stringify({ job: { id: "test", slug: "test" }, status: "completed", stage: "done" }));
  for (let i = 0; i < 2; i++) {
    const attempt = path.join(dir, "attempts", `writing-${i + 1}`);
    await mkdir(attempt, { recursive: true });
    await writeFile(path.join(attempt, "timing.json"), JSON.stringify({ stage: "writing", started_at: new Date(i * 1000).toISOString(), finished_at: new Date(i * 1000 + 500).toISOString(), elapsed_ms: 500, outcome: i ? "completed" : "failed" }));
    await writeFile(path.join(attempt, "codex-events.jsonl"), JSON.stringify({ type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 80, output_tokens: 10 } }) + "\n");
  }
  await writeArticleRunReport(dir, "gpt-5.6-luna", "max");
  const report = JSON.parse(await readFile(path.join(dir, "run-report.json"), "utf8"));
  assert.equal(report.active_ms, 1000); assert.equal(report.wall_ms, 1500); assert.equal(report.attempts[0].outcome, "failed"); assert.equal(report.attempts[1].usage.output_tokens, 10);
});

test("editorial review retains original user feedback after the writer reports completion", async () => {
  const { stagePrompt } = await import("../article-stage-runtime");
  const prompt = stagePrompt({ worktree: "/repo", runDir: "/repo/tmp/revision" } as any, "editorial_review", {
    job: { id: "test", title: "Test", slug: "test", article_type: "guide" }, feedback: "Writer reports success", history: [],
    origin: { runDir: "/repo/tmp/baseline", artifacts: {}, reason: "Keep the useful opening and remove repeated cautions" }
  } as any);
  assert.match(prompt, /Keep the useful opening and remove repeated cautions/);
  assert.match(prompt, /\/repo\/tmp\/baseline\/content\/final.json/);
});


test("production inventory includes game article routes and wiki game identity without changing Roblox rows", async () => {
  const { loadEditorialInventory } = await import("../../../apps/web/src/lib/editorial-inventory");
  const { fetchProductionEditorialInventory, inventoryPublicPath, inventoryMatchesSearch } = await import("../production-editorial-inventory");
  const games = [
    { id: "game", namespace: "example", slug: "example-six", kind: "game", is_published: true },
    { id: "root", namespace: "example", slug: "example", kind: "franchise", is_published: true },
    { id: "hidden", namespace: "example", slug: "hidden", kind: "game", is_published: false },
  ];
  const rows: Record<string, Record<string, unknown>[]> = {
    articles: [{ title: "Roblox Guide", slug: "roblox-guide", universe_id: 123, is_published: true }],
    games,
    game_article_pages_view: [
      { id: "article", game_id: "game", namespace: "example", title: "Example Six Guide", slug: "example-six-guide", canonical_path: "/articles/example-six-guide", is_published: true },
      { id: "draft", game_id: "game", namespace: "example", title: "Draft", slug: "draft", canonical_path: "/articles/draft", is_published: false },
    ],
    game_wiki_pages_view: [
      // The page slug can differ from the game slug; use the game's identity.
      { id: "wiki", game_id: "game", namespace: "example", title: "Example Six Wiki", slug: "six-wiki", canonical_path: "/example/wiki/example-six", is_published: true },
      { id: "hub", game_id: "root", namespace: "example", title: "Example Hub", slug: "example-hub", canonical_path: "/example/wiki", is_published: true },
      { id: "hidden-wiki", game_id: "hidden", namespace: "example", title: "Hidden", slug: "hidden", canonical_path: "/example/wiki/hidden", is_published: true },
    ],
  };
  const db = { from(table: string) {
    let selected = rows[table] ?? [];
    return { select() { return this; }, eq(field: string, value: unknown) { selected = selected.filter(row => row[field] === value); return this; }, order() { return this; },
      range(from: number, to: number) { return Promise.resolve({ data: selected.slice(from, to + 1), error: null }); } };
  } };
  const robloxOnly = await loadEditorialInventory(db as unknown as Parameters<typeof loadEditorialInventory>[0]);
  assert.deepEqual(robloxOnly, [{ family: "article", title: "Roblox Guide", key: "roblox-guide", universe_id: 123 }]);
  const failingGames = { from(table: string) { return table.startsWith("game") ? { select() { throw new Error("game read failed"); } } : db.from(table); } };
  assert.deepEqual(await loadEditorialInventory(failingGames as unknown as Parameters<typeof loadEditorialInventory>[0]), robloxOnly);
  const inventory = await loadEditorialInventory(db as unknown as Parameters<typeof loadEditorialInventory>[0], { includeGames: true });
  assert.equal(inventory.length, 4);
  assert.deepEqual(inventory.find(item => item.key === "roblox-guide"), { family: "article", title: "Roblox Guide", key: "roblox-guide", universe_id: 123 });
  assert.deepEqual(inventory.find(item => item.key === "six-wiki"), {
    family: "wiki", title: "Example Six Wiki", key: "six-wiki", universe_id: null,
    public_path: "/example/wiki/example-six", namespace: "example", slug: "example-six", kind: "game",
  });
  assert.equal(inventory.find(item => item.key === "example-hub")?.kind, "franchise");
  const originalFetch = globalThis.fetch;
  try {
    const urls: string[] = [];
    globalThis.fetch = async (input) => { urls.push(String(input)); return new Response(JSON.stringify({ version: 1, generated_at: "2026-11-04", items: inventory })); };
    await fetchProductionEditorialInventory();
    assert.ok(!urls[0].includes("scope="));
    const payload = await fetchProductionEditorialInventory({ includeGames: true });
    assert.match(urls[1], /scope=all/);
    const article = payload.items.find(item => item.key === "example-six-guide")!;
    assert.equal(inventoryPublicPath(article, payload.items), "/articles/example-six-guide");
    assert.equal(inventoryPublicPath(payload.items.find(item => item.key === "six-wiki")!, payload.items), "/example/wiki/example-six");
    assert.deepEqual(payload.items, inventory);
    const wiki = payload.items.find(item => item.key === "six-wiki")!;
    assert.equal(inventoryMatchesSearch({...wiki,title:"The Sixth Game Wiki"}, "Example Six"), true);
    assert.equal(inventoryMatchesSearch({family:"wiki",title:"Grand Theft Auto VI",key:"gta-6-wiki",universe_id:null,namespace:"gta",slug:"gta-6",kind:"game"}, "GTA 6"), true);
    assert.equal(inventoryMatchesSearch({family:"wiki",title:"Roblox Game",key:"roblox-game",universe_id:1}, "roblox game"), true);
  } finally { globalThis.fetch = originalFetch; }
});
