import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runWikiStagePipeline, downloadWikiImages, type WikiStageState } from "../wiki-stage-pipeline";
import { StageInterrupted, WikiOwnershipError, type WikiStageTask } from "../wiki-stage-runtime";
import type { WikiDecision, WikiCollection } from "../wiki-stage-prompts";

const identity = { id: "queue-id", game_name: "Game", wiki_slug: "game", universe_id: 123, root_place_id: 456 };
const done = (extra: Partial<WikiDecision> = {}): WikiDecision => ({ status: "completed", summary: "Approved.", findings: [], repair_stage: null, ...extra });
const save = (file: string, value: unknown) => writeFile(file, JSON.stringify(value));
async function fixture(t: any, collections: WikiCollection[] = [{ slug: "pets", name: "Pets" }]) {
  const root = await mkdtemp(path.join(os.tmpdir(), "wiki-stages-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls: WikiStageTask[] = [];
  const options = { root, worktree: "/repo", identity, env: { BLOXODES_CI_QA: "1" }, codexBin: "unused", deadline: Date.now() + 60_000, downloadImages: async () => [] };
  const execute = async (task: WikiStageTask): Promise<WikiDecision> => {
    calls.push(structuredClone(task));
    if (task.stage === "collection_suggestions") {
      await writeFile(path.join(root, "suggestions.md"), collections.map(c => `[create] ${c.name} | slug: ${c.slug}\nEvidence: https://example.com`).join("\n"));
      return done({ collections });
    }
    if (task.stage.endsWith("research")) await writeFile(path.join(task.folder, "brief.md"), "Verified brief.");
    if (task.stage === "collection_data") {
      await save(path.join(task.folder, "dataset.json"), { meta: { schemaVersion: 2 }, items: [{ item: { name: "Cat" }, system: { slug: "cat", image: null } }] });
      await save(path.join(task.folder, "runtime-manifest.json"), { schemaVersion: 1, game: { slug: "game", universeId: 123 }, collection: { slug: task.collection!.slug, pageType: "database" }, dataset: "dataset.json", finalJson: "final.json", mediaRoot: "media" });
    }
    if (task.stage.endsWith("writing")) await save(path.join(task.folder, task.revision ? "final.json" : "draft-final.json"), task.collection ? { universe_id: 123, wiki_slug: "game", collection_slug: task.collection.slug, code: `game-${task.collection.slug}`, intro_md: task.revision ? "Revised." : "Draft." } : { slug: "game", universe_id: 123, description_md: "The game loop." });
    return done(task.stage === "collection_image_review" ? { accepted_missing: ["cat"] } : {});
  };
  return { root, calls, options, execute, state: async () => JSON.parse(await readFile(path.join(root, ".stages/state.json"), "utf8")) as WikiStageState };
}
test("collections finish first, hub gets only approved collections, and the result contract is unchanged", async t => {
  const f = await fixture(t, [{ slug: "weak", name: "Weak" }, { slug: "pets", name: "Pets" }]);
  const result = await runWikiStagePipeline({ ...f.options, execute: async task => task.collection?.slug === "weak" ? done({ status: "blocked", summary: "No useful evidence." }) : f.execute(task) });
  assert.equal(result.outcome, "ready"); assert.deepEqual(result.approvedCollections, ["pets"]);
  assert.equal(result.blockedCollections[0].slug, "weak");
  assert.deepEqual(f.calls.find(c => c.stage === "hub_research")?.approved, ["pets"]);
  assert.ok(f.calls.findIndex(c => c.stage === "hub_research") > f.calls.findIndex(c => c.stage === "collection_editorial_review"));
  assert.equal(result.wikiFinalPath, path.join(f.root, "wiki/game/final.json"));
  assert.deepEqual(result.collectionManifests, [path.join(f.root, "collections/pets/runtime-manifest.json")]);
  assert.deepEqual(JSON.parse(await readFile(path.join(f.root, "workflow-result.json"), "utf8")), result);
  const count = f.calls.length;
  await runWikiStagePipeline({ ...f.options, execute: f.execute });
  assert.equal(f.calls.length, count, "completed stages never rerun");
});
test("interrupted stages resume saved work without resetting the correction budget", async t => {
  const f = await fixture(t); let interrupt = true;
  const execute = async (task: WikiStageTask) => {
    if (task.stage === "collection_research_review" && !(await f.state()).collections[0].state.passes.collection_data) return done({ status: "needs_revision", summary: "Research needs a fix.", findings: ["Verify cost."], repair_stage: "research" });
    if (task.stage === "collection_data" && interrupt) { interrupt = false; throw new StageInterrupted("Stopped."); }
    return f.execute(task);
  };
  // The second research review must accept the correction.
  let reviews = 0;
  const wrapped = async (task: WikiStageTask) => task.stage === "collection_research_review" && ++reviews > 1 ? f.execute(task) : execute(task);
  await assert.rejects(runWikiStagePipeline({ ...f.options, execute: wrapped }), /Stopped/);
  const state = await f.state();
  assert.equal(state.collections[0].state.passes.collection_research, 2);
  assert.equal(state.collections[0].state.inFlight?.stage, "collection_data");
  const researchCalls = f.calls.filter(c => c.stage === "collection_research").length;
  assert.equal((await runWikiStagePipeline({ ...f.options, execute: wrapped })).outcome, "ready");
  assert.equal(f.calls.filter(c => c.stage === "collection_research").length, researchCalls);
  assert.equal((await f.state()).collections[0].state.calls["collection_data-1"], 2);
});
test("one writing revision preserves the first draft and receives another editorial review", async t => {
  const f = await fixture(t); let review = 0;
  const result = await runWikiStagePipeline({ ...f.options, execute: async task => task.stage === "collection_editorial_review" && ++review === 1 ? done({ status: "needs_revision", summary: "Explain the choice.", findings: ["Add a supported reason."], repair_stage: "writing" }) : f.execute(task) });
  assert.equal(result.outcome, "ready"); assert.equal(review, 2);
  const folder = path.join(f.root, "collections/pets");
  assert.equal(JSON.parse(await readFile(path.join(folder, "draft-final.json"), "utf8")).intro_md, "Draft.");
  assert.equal(JSON.parse(await readFile(path.join(folder, "final.json"), "utf8")).intro_md, "Revised.");
  assert.deepEqual(f.calls.filter(c => c.stage === "collection_writing").map(c => c.revision), [false, true]);
});
test("a second research rejection blocks only that entity and its budget survives resume", async t => {
  const f = await fixture(t);
  const execute = async (task: WikiStageTask) => task.stage === "collection_research_review" ? done({ status: "needs_revision", summary: "Still unsupported.", findings: ["Cost is unsupported."], repair_stage: "research" }) : f.execute(task);
  const result = await runWikiStagePipeline({ ...f.options, execute });
  assert.equal(result.outcome, "blocked"); assert.match(result.blockedCollections[0].reason, /One correction/);
  const count = f.calls.length;
  await runWikiStagePipeline({ ...f.options, execute });
  assert.equal(f.calls.length, count);
});
test("image worker failure and blocked image review never block useful collections", async t => {
  const f = await fixture(t);
  const result = await runWikiStagePipeline({ ...f.options, execute: async task => {
    if (task.stage === "collection_images") throw new Error("Image host unavailable.");
    if (task.stage === "collection_image_review") return done({ status: "blocked", summary: "No images.", accepted_missing: ["cat"] });
    return f.execute(task);
  } });
  assert.equal(result.outcome, "ready");
  const data = JSON.parse(await readFile(path.join(f.root, "collections/pets/dataset.json"), "utf8"));
  assert.equal(data.items[0].system.image, null);
});
test("editorial data findings return to data and its review before a writing revision", async t => {
  const f = await fixture(t); let review = 0;
  await runWikiStagePipeline({ ...f.options, execute: async task => task.stage === "collection_editorial_review" && ++review === 1 ? done({ status: "needs_revision", summary: "Correct the cost.", findings: ["Cost conflicts."], repair_stage: "data" }) : f.execute(task) });
  assert.equal(f.calls.filter(c => c.stage === "collection_data").length, 2);
  assert.equal(f.calls.filter(c => c.stage === "collection_data_review").length, 2);
  assert.equal(f.calls.filter(c => c.stage === "collection_writing").length, 2);
  assert.equal((await f.state()).collections[0].state.status, "completed");
});
test("a blocked hub keeps approved collections in the blocked result", async t => {
  const f = await fixture(t);
  const result = await runWikiStagePipeline({ ...f.options, execute: async task => task.stage === "hub_research_review" ? done({ status: "blocked", summary: "Identity is unsupported." }) : f.execute(task) });
  assert.equal(result.outcome, "blocked"); assert.deepEqual(result.approvedCollections, ["pets"]);
  assert.equal(result.wikiFinalPath, undefined); assert.match(result.outcomeReason!, /Identity/);
});
test("ownership failures are durable and cannot resume into fresh approval", async t => {
  const f = await fixture(t);
  const execute = async (task: WikiStageTask) => { if (task.stage === "collection_images") throw new WikiOwnershipError("Image worker changed costs."); return f.execute(task); };
  await assert.rejects(runWikiStagePipeline({ ...f.options, execute }), /changed costs/);
  const count = f.calls.length;
  await assert.rejects(runWikiStagePipeline({ ...f.options, execute: f.execute }), /changed costs/);
  assert.equal(f.calls.length, count);
});
test("operational retry limits and completed input hashes survive queue recovery", async t => {
  const f = await fixture(t);
  const fail = async () => { throw new Error("Provider unavailable."); };
  for (let i = 0; i < 3; i++) await assert.rejects(runWikiStagePipeline({ ...f.options, execute: fail }), /Provider unavailable/);
  await assert.rejects(runWikiStagePipeline({ ...f.options, execute: f.execute }), /retry limit exhausted/);
  const g = await fixture(t);
  await runWikiStagePipeline({ ...g.options, execute: g.execute });
  await writeFile(path.join(g.root, "collections/pets/final.json"), "{}");
  await assert.rejects(runWikiStagePipeline({ ...g.options, execute: g.execute }), /Retained approved artifacts changed/);
});

test("the saved stage config survives interruption and later env changes", async t => {
  const f = await fixture(t); let first = true;
  await assert.rejects(runWikiStagePipeline({ ...f.options, env: { WIKI_STAGE_COLLECTION_RESEARCH_MODEL: "original-model" }, execute: async task => {
    if (task.stage === "collection_research" && first) { first = false; throw new StageInterrupted("Stopped."); }
    return f.execute(task);
  } }), /Stopped/);
  await runWikiStagePipeline({ ...f.options, env: { WIKI_STAGE_COLLECTION_RESEARCH_MODEL: "replacement-model" }, execute: async task => {
    if (task.stage === "collection_research") assert.equal(task.config?.model, "original-model");
    return f.execute(task);
  } });
});

test("an image-only editorial repair never requires a second writing revision", async t => {
  const f = await fixture(t); let reviews = 0;
  const result = await runWikiStagePipeline({ ...f.options, execute: async task => {
    if (task.stage === "collection_editorial_review") {
      reviews++;
      if (reviews === 1) return done({ status: "needs_revision", summary: "Explain the choice.", findings: ["Add a reason."], repair_stage: "writing" });
      if (reviews === 2) return done({ status: "needs_revision", summary: "Wrong cat image.", findings: ["Omit the cat image."], repair_stage: "images" });
    }
    return f.execute(task);
  } });
  assert.equal(result.outcome, "ready"); assert.equal(reviews, 3);
  assert.equal(f.calls.filter(c => c.stage === "collection_writing").length, 2);
  assert.equal(f.calls.filter(c => c.stage === "collection_images").length, 2);
});


test("recovery rejects protected changes made while the parent was stopped", async t => {
  for (const [stage, file, savedDecision] of [
    ["collection_images", "dataset.json", false],
    ["collection_writing", "brief.md", false],
    ["collection_writing", "dataset.json", true],
    ["collection_research_review", "brief.md", true],
  ] as const) {
    const f = await fixture(t);
    await assert.rejects(runWikiStagePipeline({ ...f.options, execute: async task => {
      if (task.stage === stage) throw new StageInterrupted("Parent stopped.");
      return f.execute(task);
    } }), /Parent stopped/);
    const state = await f.state();
    const task = state.collections[0].state.inFlight!;
    assert.ok(task.ownershipInput, "snapshot is durable before launch");
    if (stage === "collection_images") assert.ok(task.ownershipInput.imageIndependentData);
    if (savedDecision) {
      task.decision = done();
      await save(path.join(f.root, ".stages/state.json"), state);
    }
    const target = path.join(task.folder, file);
    if (file === "dataset.json") {
      const data = JSON.parse(await readFile(target, "utf8"));
      data.items[0].item.cost = 999;
      await save(target, data);
    } else await writeFile(target, "Unapproved replacement.");
    let calls = 0;
    await assert.rejects(runWikiStagePipeline({ ...f.options, execute: async task => { calls++; return f.execute(task); } }), WikiOwnershipError);
    assert.equal(calls, 0);
    assert.ok((await f.state()).integrityError);
  }
});

test("recovery permits an interrupted writer's owned draft and reuses a saved decision", async t => {
  const f = await fixture(t);
  await assert.rejects(runWikiStagePipeline({ ...f.options, execute: async task => {
    const decision = await f.execute(task);
    if (task.stage === "collection_writing") throw new StageInterrupted("Parent stopped.");
    return decision;
  } }), /Parent stopped/);
  const state = await f.state();
  state.collections[0].state.inFlight!.decision = done();
  await save(path.join(f.root, ".stages/state.json"), state);
  let writingCalls = 0;
  assert.equal((await runWikiStagePipeline({ ...f.options, execute: async task => {
    if (task.stage === "collection_writing") writingCalls++;
    return f.execute(task);
  } })).outcome, "ready");
  assert.equal(writingCalls, 0);
});

test("old interrupted state without an original snapshot fails closed", async t => {
  const f = await fixture(t);
  await assert.rejects(runWikiStagePipeline({ ...f.options, execute: async () => { throw new StageInterrupted("Stopped."); } }), /Stopped/);
  const state = await f.state();
  delete state.suggestions.inFlight!.ownershipInput;
  await save(path.join(f.root, ".stages/state.json"), state);
  await assert.rejects(runWikiStagePipeline({ ...f.options, execute: f.execute }), /no original ownership snapshot/);
});

test("failed, malformed, blocked and exhausted image reviews clear existing mappings", async t => {
  for (const mode of ["throw", "malformed", "unknown", "blocked", "revision", "completed"] as const) {
    const f = await fixture(t);
    const result = await runWikiStagePipeline({ ...f.options, execute: async task => {
      if (task.stage === "collection_images") {
        const file = path.join(task.folder, "dataset.json");
        const data = JSON.parse(await readFile(file, "utf8"));
        data.items[0].system.image = "/cat.png";
        await save(file, data);
        await writeFile(path.join(task.folder, "media/cat.png"), "Readable image.");
        return done();
      }
      if (task.stage === "collection_image_review") {
        if (mode === "throw") throw new Error("Reviewer unavailable.");
        if (mode === "malformed") return null as unknown as WikiDecision;
        if (mode === "unknown") return done({ accepted_missing: ["unknown-item"] });
        if (mode === "revision") return done({ status: "needs_revision", findings: ["Wrong cat."], repair_stage: "images", accepted_missing: [] });
        return done({ status: mode === "blocked" ? "blocked" : "completed", accepted_missing: [] });
      }
      return f.execute(task);
    } });
    assert.equal(result.outcome, "ready");
    const data = JSON.parse(await readFile(path.join(f.root, "collections/pets/dataset.json"), "utf8"));
    assert.equal(data.items[0].system.image, mode === "completed" ? "/cat.png" : null);
    const review = (await f.state()).collections[0].state.history.filter(h => h.stage === "collection_image_review").at(-1)!;
    if (mode !== "completed") assert.deepEqual(review.decision.accepted_missing, ["cat"]);
  }
});

test("data and image workers cannot rewrite the approved research brief", async t => {
  for (const stage of ["collection_data", "collection_images"] as const) {
    const f = await fixture(t);
    await assert.rejects(runWikiStagePipeline({ ...f.options, execute: async task => {
      if (task.stage === stage) await writeFile(path.join(task.folder, "brief.md"), "Changed research.");
      return f.execute(task);
    } }), /outside its ownership/);
  }
});

test("a completed review requesting a data repair cannot advance", async t => {
  const f = await fixture(t);
  await assert.rejects(runWikiStagePipeline({ ...f.options, execute: async task => task.stage === "collection_data_review"
    ? done({ repair_stage: "data", findings: ["Wrong cost."] }) : f.execute(task) }), /cannot request repairs/);
  assert.equal(f.calls.filter(task => task.stage === "collection_writing").length, 0);
});

async function imageFixture(t: any) {
  const folder = await mkdtemp(path.join(os.tmpdir(), "wiki-downloads-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await mkdir(path.join(folder, "media"));
  await save(path.join(folder, "dataset.json"), { meta: { schemaVersion: 2 }, items: [{ item: { name: "Cat" }, system: { slug: "cat", image: null } }] });
  return folder;
}
test("optional download plans tolerate null plans and malformed entries", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not fetch malformed plans."); });
  for (const plan of [null, [], { downloads: null }, { downloads: [null, 42, [], {}] }]) {
    const folder = await imageFixture(t);
    await save(path.join(folder, "images.json"), plan);
    const notes = await downloadWikiImages(folder);
    assert.ok(notes.length);
    assert.equal(JSON.parse(await readFile(path.join(folder, "dataset.json"), "utf8")).items[0].system.image, null);
  }
});

test("downloads normalize uppercase extensions and omit GIF", async t => {
  const folder = await imageFixture(t);
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests++; return new Response("png-bytes", { headers: { "content-type": "image/png" } }); });
  const entry = { itemSlug: "cat", url: "https://images.example.com/cat", sourcePage: "https://example.com/cat", relativePath: "cat.GIF" };
  await save(path.join(folder, "images.json"), { downloads: [entry] });
  assert.match((await downloadWikiImages(folder)).join(" "), /GIF is omitted/);
  assert.equal(requests, 0);
  await save(path.join(folder, "images.json"), { downloads: [{ ...entry, relativePath: "cat.PNG" }] });
  assert.deepEqual(await downloadWikiImages(folder), []);
  assert.equal(JSON.parse(await readFile(path.join(folder, "dataset.json"), "utf8")).items[0].system.image, "/cat.png");
  assert.equal(await readFile(path.join(folder, "media/cat.png"), "utf8"), "png-bytes");
  assert.deepEqual(await downloadWikiImages(folder), []);
  assert.equal(requests, 1, "retained lowercase download is reused");
});

test("malformed optional plans do not trap pipeline recovery after a saved decision", async t => {
  const f = await fixture(t);
  const execute = async (task: WikiStageTask) => {
    if (task.stage === "collection_images") { await save(path.join(task.folder, "images.json"), { downloads: [null] }); return done(); }
    return f.execute(task);
  };
  let first = true;
  await assert.rejects(runWikiStagePipeline({ ...f.options, execute, downloadImages: async () => {
    if (first) { first = false; throw new StageInterrupted("Stopped after decision."); }
    return [];
  } }), /Stopped after decision/);
  assert.ok((await f.state()).collections[0].state.inFlight?.decision);
  assert.equal((await runWikiStagePipeline({ ...f.options, execute, downloadImages: downloadWikiImages })).outcome, "ready");
  assert.equal((await f.state()).collections[0].state.history.find(h => h.stage === "collection_images")!.decision.findings.length, 1);
});


test("saved image decisions recover exact code-owned omissions and review notes", async t => {
  const f = await fixture(t);
  await assert.rejects(runWikiStagePipeline({ ...f.options, execute: async task => {
    if (task.stage === "collection_images") {
      const data = JSON.parse(await readFile(path.join(task.folder, "dataset.json"), "utf8"));
      data.items[0].system.image = "/cat.png";
      await save(path.join(task.folder, "dataset.json"), data);
      await writeFile(path.join(task.folder, "media/cat.png"), "Readable image.");
      return done();
    }
    if (task.stage === "collection_image_review") throw new StageInterrupted("Parent stopped.");
    return f.execute(task);
  } }), /Parent stopped/);
  const state = await f.state();
  const task = state.collections[0].state.inFlight!;
  task.decision = done({ accepted_missing: ["cat"] });
  const data = JSON.parse(await readFile(path.join(task.folder, "dataset.json"), "utf8"));
  data.items[0].system.image = null;
  const outputs = { "dataset.json": `${JSON.stringify(data, null, 2)}\n`, "image-review.md": `${JSON.stringify(task.decision, null, 2)}\n` };
  task.codeWrites = Object.fromEntries(Object.entries(outputs).map(([name, bytes]) => [path.relative(f.root, path.join(task.folder, name)), [createHash("sha256").update(bytes).digest("hex")]]));
  await save(path.join(f.root, ".stages/state.json"), state);
  for (const [name, bytes] of Object.entries(outputs)) await writeFile(path.join(task.folder, name), bytes);
  let imageReviews = 0;
  assert.equal((await runWikiStagePipeline({ ...f.options, execute: async task => {
    if (task.stage === "collection_image_review") imageReviews++;
    return f.execute(task);
  } })).outcome, "ready");
  assert.equal(imageReviews, 0);
  assert.equal(JSON.parse(await readFile(path.join(task.folder, "dataset.json"), "utf8")).items[0].system.image, null);
});

test("readable GIF and uppercase worker files are omitted instead of leaving dangling bundle references", async t => {
  for (const filename of ["cat.gif", "cat.PNG"]) {
    const f = await fixture(t);
    await runWikiStagePipeline({ ...f.options, execute: async task => {
      if (task.stage === "collection_images") {
        const data = JSON.parse(await readFile(path.join(task.folder, "dataset.json"), "utf8"));
        data.items[0].system.image = `/${filename}`;
        await save(path.join(task.folder, "dataset.json"), data);
        await writeFile(path.join(task.folder, "media", filename), "Readable image.");
        return done();
      }
      if (task.stage === "collection_image_review") return done({ accepted_missing: [] });
      return f.execute(task);
    } });
    assert.equal(JSON.parse(await readFile(path.join(f.root, "collections/pets/dataset.json"), "utf8")).items[0].system.image, null);
  }
});


test("a GIF response under a PNG filename is a recorded omission", async t => {
  const folder = await imageFixture(t);
  t.mock.method(globalThis, "fetch", async () => new Response("gif-bytes", { headers: { "content-type": "image/gif" } }));
  await save(path.join(folder, "images.json"), { downloads: [{ itemSlug: "cat", url: "https://images.example.com/cat", sourcePage: "https://example.com/cat", relativePath: "cat.png" }] });
  assert.match((await downloadWikiImages(folder)).join(" "), /unsupported format/);
  assert.equal(JSON.parse(await readFile(path.join(folder, "dataset.json"), "utf8")).items[0].system.image, null);
  await assert.rejects(readFile(path.join(folder, "media/cat.png")), { code: "ENOENT" });
});
