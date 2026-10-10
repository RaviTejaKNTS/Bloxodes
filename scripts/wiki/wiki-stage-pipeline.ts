import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { saveJson } from "../articles/article-pipeline";
import { executeWikiModelStage, StageInterrupted, WikiOwnershipError, wikiArtifactHashes, type WikiModelOptions, type WikiStageTask } from "./wiki-stage-runtime";
import { isWikiReview, wikiStageConfig, type WikiStageConfig, type WikiStage } from "./wiki-stage-config";
import { parseWikiDecision, type WikiCollection, type WikiDecision, type WikiIdentity } from "./wiki-stage-prompts";

export type WikiWorkflowResult = {
  queueId: string; universeId: number; wikiSlug: string; outcome: "ready" | "blocked"; outcomeReason?: string;
  suggestionsPath: string; wikiFinalPath?: string; approvedCollections: string[];
  blockedCollections: Array<{ slug: string; reason: string }>; collectionManifests: string[];
};
type RecordEntry = { stage: WikiStage; round: number; decision: WikiDecision; attemptDir: string; models: unknown[]; timing: unknown };
type Entity = {
  status: "active" | "completed" | "blocked"; index: number; reason?: string;
  passes: Partial<Record<WikiStage, number>>; calls: Record<string, number>; feedback: string;
  reuseWritingAfterImages?: boolean;
  configs?: Partial<Record<WikiStage, WikiStageConfig>>;
  history: RecordEntry[]; inFlight?: WikiStageTask & { round: number; decision?: WikiDecision };
  hashes?: Record<string, string>;
};
export type WikiStageState = { version: 1; identity: WikiIdentity; suggestions: Entity; collections: Array<WikiCollection & { state: Entity }>; hub: Entity; integrityError?: string; result?: WikiWorkflowResult };
const collectionFlow: WikiStage[] = ["collection_research", "collection_research_review", "collection_data", "collection_data_review", "collection_images", "collection_image_review", "collection_writing", "collection_editorial_review"];
const hubFlow: WikiStage[] = ["hub_research", "hub_research_review", "hub_writing", "hub_editorial_review"];
const freshEntity = (): Entity => ({ status: "active", index: 0, passes: {}, calls: {}, feedback: "", history: [] });
const optional = (stage: WikiStage) => stage === "collection_images" || stage === "collection_image_review";
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));
const folderHashes = (root: string) => wikiArtifactHashes(root);
async function assertRetained(entity: Entity, folder: string) {
  if (entity.hashes && (!entity.inFlight || (isWikiReview(entity.inFlight.stage) && !entity.inFlight.decision)) && JSON.stringify(entity.hashes) !== JSON.stringify(await folderHashes(folder))) throw new WikiOwnershipError(`Retained approved artifacts changed: ${folder}`);
}
function stop(entity: Entity, stage: WikiStage, reason: string) { entity.status = "blocked"; entity.reason = `${stage}: ${reason}`; }
function datasetRows(data: any): any[] {
  if (data?.meta?.schemaVersion !== 2 || !Array.isArray(data.items) || !data.items.length || data.items.some((r: any) => !r.item || !r.system || typeof r.system.slug !== "string") || new Set(data.items.map((r: any) => r.system.slug)).size !== data.items.length) throw new Error("Collection requires a nonempty wrapped v2 dataset with unique item slugs.");
  return data.items;
}
async function requireFiles(folder: string, files: string[]) { for (const file of files) await readFile(path.join(folder, file)); }
async function validateOutput(task: WikiStageTask, identity: WikiIdentity, decision: WikiDecision) {
  if (isWikiReview(task.stage)) return;
  if (task.stage === "collection_suggestions") {
    const text = await readFile(path.join(task.folder, "suggestions.md"), "utf8");
    const selected = decision.collections ?? [];
    if (/\[source discovery incomplete\]/i.test(text) || (text.match(/\[create\]/gi)?.length ?? 0) !== selected.length || selected.some(c => !text.includes(`slug: ${c.slug}`))) throw new Error("Structured suggestions do not match every [create] recommendation.");
  }
  if (task.stage.endsWith("research")) await requireFiles(task.folder, ["brief.md"]);
  if (task.stage === "collection_data") {
    datasetRows(await json(path.join(task.folder, "dataset.json")));
    const manifest = await json(path.join(task.folder, "runtime-manifest.json"));
    if (manifest.schemaVersion !== 1 || manifest.game?.slug !== identity.wiki_slug || manifest.game?.universeId !== identity.universe_id || manifest.collection?.slug !== task.collection?.slug || !["database", "collectible"].includes(manifest.collection?.pageType) || manifest.dataset !== "dataset.json" || manifest.finalJson !== "final.json" || manifest.mediaRoot !== "media") throw new Error("Runtime manifest identity, page type or workspace paths are invalid.");
  }
  if (task.stage.endsWith("writing")) {
    const final = await json(path.join(task.folder, task.revision ? "final.json" : "draft-final.json"));
    if (Number(final.universe_id) !== identity.universe_id || (task.collection ? final.wiki_slug !== identity.wiki_slug || final.collection_slug !== task.collection.slug || final.code !== `${identity.wiki_slug}-${task.collection.slug}` : final.slug !== identity.wiki_slug)) throw new Error("Writing output identity does not match the queue/collection.");
  }
}
// Trusted downloads supplement the model's image pass. All failures are omissions.
export async function downloadWikiImages(folder: string, signal?: AbortSignal): Promise<string[]> {
  const notes: string[] = [];
  let plan: any;
  try { plan = await json(path.join(folder, "images.json")); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return notes; notes.push(message(error)); return notes; }
  const data = await json(path.join(folder, "dataset.json"));
  const media = await realpath(path.join(folder, "media"));
  if (plan.downloads !== undefined && !Array.isArray(plan.downloads)) return ["Image download plan must contain a downloads array."];
  for (const entry of plan.downloads ?? []) {
    signal?.throwIfAborted();
    try {
      const row = datasetRows(data).find(r => r.system.slug === entry.itemSlug);
      const url = new URL(entry.url);
      if (!row || url.protocol !== "https:" || url.username || url.password || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) throw new Error("Invalid item or public HTTPS image URL.");
      if (typeof entry.sourcePage !== "string" || !/^https?:\/\//.test(entry.sourcePage)) throw new Error("Image source page is missing.");
      if (typeof entry.relativePath !== "string" || path.basename(entry.relativePath) !== entry.relativePath || !/^[a-zA-Z0-9_-]+\.(webp|png|jpe?g|gif)$/i.test(entry.relativePath)) throw new Error("Image download must use a filename under media/.");
      const target = path.join(media, entry.relativePath);
      // Artifact traversal rejects symlinks before this function runs.
      if (row.system.image === `/${entry.relativePath}`) {
        try { await readFile(target); continue; } catch { /* Retained download is unavailable. */ }
      }
      const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000), redirect: "error" });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`Image response ${response.status} is unusable.`);
      if (Number(response.headers.get("content-length")) > 20_000_000) throw new Error("Image exceeds 20 MB.");
      if (!response.body) throw new Error("Image response has no body.");
      const chunks: Uint8Array[] = []; let size = 0;
      const reader = response.body.getReader();
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > 20_000_000) throw new Error("Image exceeds 20 MB.");
          chunks.push(chunk.value);
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      await writeFile(target, Buffer.concat(chunks), { mode: 0o600 });
      row.system.image = `/${entry.relativePath}`;
      await saveJson(path.join(folder, "dataset.json"), data);
    } catch (error) { notes.push(`${entry.itemSlug}: ${message(error)}`); }
  }
  await saveJson(path.join(folder, "dataset.json"), data);
  return notes;
}
export async function acceptWikiImageGaps(folder: string, decision: WikiDecision) {
  const data = await json(path.join(folder, "dataset.json"));
  const rows = datasetRows(data);
  const accepted = new Set(decision.accepted_missing ?? []);
  for (const slug of accepted) if (!rows.some(r => r.system.slug === slug)) { accepted.delete(slug); decision.findings.push(`Image reviewer returned unknown omission slug: ${slug}; ignored.`); }
  for (const row of rows) {
    let available = false;
    if (typeof row.system.image === "string" && row.system.image) {
      const relative = row.system.image.replace(/^\//, "");
      const file = path.resolve(folder, "media", relative);
      if (file.startsWith(`${path.resolve(folder, "media")}${path.sep}`)) {
        try { await readFile(file); available = true; } catch { /* Optional image unavailable. */ }
      }
    }
    if (accepted.has(row.system.slug) || !available) { accepted.add(row.system.slug); row.system.image = null; }
  }
  decision.accepted_missing = [...accepted];
  await saveJson(path.join(folder, "dataset.json"), data);
}
export async function runWikiStagePipeline(options: WikiModelOptions & { execute?: (task: WikiStageTask) => Promise<WikiDecision>; downloadImages?: (folder: string) => Promise<string[]> }): Promise<WikiWorkflowResult> {
  const root = await realpath(options.root);
  await wikiArtifactHashes(root);
  const stateFile = path.join(root, ".stages", "state.json");
  let state: WikiStageState;
  try { state = await json(stateFile); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; state = { version: 1, identity: options.identity, suggestions: freshEntity(), collections: [], hub: freshEntity() }; }
  if (state.version !== 1 || JSON.stringify(state.identity) !== JSON.stringify(options.identity)) throw new Error("Wiki stage state identity/version mismatch.");
  if (state.integrityError) throw new WikiOwnershipError(state.integrityError);
  const persist = async () => {
    await saveJson(stateFile, state);
    const collections = await Promise.all(state.collections.map(async c => {
      const folder = path.join(root, "collections", c.slug);
      let itemCount: number | null = null, imageCount: number | null = null;
      try { const rows = datasetRows(await json(path.join(folder, "dataset.json"))); itemCount = rows.length; imageCount = rows.filter(r => Boolean(r.system.image)).length; }
      catch { /* A blocked/in-flight collection may not have a valid dataset yet. */ }
      return { ...c, folder, itemCount, imageCount, stageReached: c.state.inFlight?.stage ?? c.state.history.at(-1)?.stage ?? collectionFlow[c.state.index] };
    }));
    await saveJson(path.join(root, ".stages/run-report.json"), { identity: options.identity, result: state.result ?? null, integrityError: state.integrityError ?? null, collections, hub: { ...state.hub, folder: path.join(root, "wiki", options.identity.wiki_slug), stageReached: state.hub.inFlight?.stage ?? state.hub.history.at(-1)?.stage }, suggestions: state.suggestions });
  };
  const execute = options.execute ?? ((task: WikiStageTask) => executeWikiModelStage({ ...options, root }, task));
  const approved = () => state.collections.filter(c => c.state.status === "completed").map(c => c.slug);
  const runEntity = async (entity: Entity, folder: string, flow: WikiStage[], collection?: WikiCollection) => {
    await mkdir(folder, { recursive: true });
    await mkdir(path.join(folder, ".aws"), { recursive: true });
    if (collection) await mkdir(path.join(folder, "media"), { recursive: true });
    await assertRetained(entity, folder);
    while (entity.status === "active") {
      options.signal?.throwIfAborted();
      if (Date.now() >= options.deadline) throw new Error("Wiki stage deadline reached; retain the current stage for queue recovery.");
      const stage = flow[entity.index];
      if (!stage) { entity.status = "completed"; entity.hashes = flow[0] === "collection_suggestions" ? undefined : await folderHashes(folder); await persist(); break; }
      if (!entity.inFlight) {
        const workStage = stage.replace(/_(research|data|image|editorial)_review$/, (_, part) => `_${part === "editorial" ? "writing" : part === "image" ? "images" : part}`) as WikiStage;
        const round = isWikiReview(stage) ? (entity.passes[workStage] ?? 1) : (entity.passes[stage] ?? 0) + 1;
        if (round > 2) {
          if (optional(stage)) { entity.index += 1; await persist(); continue; }
          stop(entity, stage, "The saved one-correction budget is exhausted."); await persist(); break;
        }
        if (!isWikiReview(stage)) entity.passes[stage] = round;
        const key = `${stage}-${round}`;
        const attemptDir = path.join(root, ".stages", collection?.slug ?? (stage === "collection_suggestions" ? "suggestions" : "hub"), key, String((entity.calls[key] ?? 0) + 1));
        entity.configs ??= {};
        entity.configs[stage] ??= wikiStageConfig(stage, options.env);
        entity.inFlight = { config: entity.configs[stage], stage, round, folder, collection, revision: stage.endsWith("writing") ? round > 1 : (entity.passes[collection ? "collection_writing" : "hub_writing"] ?? 0) > 1, feedback: entity.feedback, approved: approved(), attemptDir };
        await persist();
      }
      const task = entity.inFlight;
      const key = `${task.stage}-${task.round}`;
      if (!task.decision) {
        if ((entity.calls[key] ?? 0) >= 3) throw new Error(`Saved operational retry limit exhausted for ${key}; inspect retained artifacts.`);
        entity.calls[key] = (entity.calls[key] ?? 0) + 1;
        task.attemptDir = path.join(path.dirname(task.attemptDir), String(entity.calls[key]));
        await persist();
        await mkdir(task.attemptDir, { recursive: true });
        const started = new Date().toISOString();
        try {
          task.decision = parseWikiDecision(await execute(task), stage);
          if (task.decision.status === "completed") await validateOutput(task, options.identity, task.decision);
        } catch (error) {
          await saveJson(path.join(task.attemptDir, "failure.json"), { message: message(error), started_at: started, ended_at: new Date().toISOString() });
          if (error instanceof WikiOwnershipError) state.integrityError = message(error);
          if (!optional(stage) || error instanceof WikiOwnershipError || error instanceof StageInterrupted || options.signal?.aborted || Date.now() >= options.deadline) { delete task.decision; await persist(); throw error; }
          task.decision = { status: "completed", summary: `Optional image stage failed; retain available images and record omissions. ${message(error)}`, findings: [message(error)], repair_stage: null, ...(stage === "collection_image_review" ? { accepted_missing: [] } : {}) };
        }
        await saveJson(path.join(task.attemptDir, "timing.json"), { started_at: started, ended_at: new Date().toISOString() });
        await persist(); // Resume after a returned decision without paying for another model call.
      }
      const d = task.decision;
      if (stage === "collection_images") {
        const downloadSignal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(Math.max(1, options.deadline - Date.now()))]);
        const problems = options.downloadImages ? await options.downloadImages(folder) : await downloadWikiImages(folder, downloadSignal);
        d.findings.push(...problems);
      }
      if (stage === "collection_image_review" && d.status !== "needs_revision") await acceptWikiImageGaps(folder, d);
      if (isWikiReview(stage)) {
        const note = stage.includes("editorial") ? "editorial-review.md" : stage.includes("image") ? "image-review.md" : stage.includes("data") ? "data-review.md" : "research-review.md";
        await writeFile(path.join(folder, note), `${JSON.stringify(d, null, 2)}\n`, { mode: 0o600 });
      }
      await saveJson(path.join(task.attemptDir, "decision.json"), d);
      const optionalJson = async (name: string) => { try { return await json(path.join(task.attemptDir, name)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return null; } };
      entity.history.push({ stage, round: task.round, decision: d, attemptDir: task.attemptDir, models: await optionalJson("model-attempts.json") ?? [], timing: await optionalJson("timing.json") });
      // stage-log.md is code-owned; reviewers never need write permission.
      const logFile = stage === "collection_suggestions" ? path.join(root, ".stages", "suggestions-log.md") : path.join(folder, "stage-log.md");
      await writeFile(logFile, entity.history.map(h => `${h.stage}, pass ${h.round}, ${h.decision.status}, ${h.decision.summary}, findings ${JSON.stringify(h.decision.findings)}, models ${JSON.stringify(h.models)}, timing ${JSON.stringify(h.timing)}, attempt ${h.attemptDir}`).join("\n") + "\n", { mode: 0o600 });
      delete entity.inFlight;
      entity.feedback = JSON.stringify(entity.history.map(h => ({ stage: h.stage, ...h.decision })));
      if (d.status === "completed" || (optional(stage) && d.status === "blocked")) {
        if (stage.endsWith("editorial_review")) {
          if ((entity.passes[collection ? "collection_writing" : "hub_writing"] ?? 0) === 1) await writeFile(path.join(folder, "final.json"), await readFile(path.join(folder, "draft-final.json")), { mode: 0o600 });
        }
        entity.index += 1;
        if (stage === "collection_image_review" && entity.reuseWritingAfterImages) {
          entity.index = flow.indexOf("collection_editorial_review");
          entity.reuseWritingAfterImages = false;
        }
      } else if (d.status === "blocked") stop(entity, stage, d.summary);
      else {
        const defaultRepair = stage.includes("editorial") ? "writing" : stage.includes("image") ? "images" : stage.includes("data") ? "data" : "research";
        const repair = d.repair_stage ?? defaultRepair;
        const target = stage === "collection_suggestions" ? stage : `${collection ? "collection" : "hub"}_${repair}` as WikiStage;
        const index = flow.indexOf(target);
        // Card-image repairs do not require a second copy revision. Re-review the
        // retained final after the image gate when the writing budget was used.
        if (stage === "collection_editorial_review" && target === "collection_images" && (entity.passes.collection_writing ?? 0) >= 2) entity.reuseWritingAfterImages = true;
        if (index < 0 || index > entity.index) stop(entity, stage, `Invalid repair target ${target}. ${d.summary}`);
        else if ((entity.passes[target] ?? 0) >= 2) {
          if (optional(stage) || target === "collection_images") {
            await acceptWikiImageGaps(folder, { ...d, accepted_missing: d.accepted_missing ?? datasetRows(await json(path.join(folder, "dataset.json"))).filter(r => d.findings.some(f => f.includes(r.system.slug))).map(r => r.system.slug) });
            entity.index = optional(stage) ? entity.index + 1 : flow.indexOf(entity.reuseWritingAfterImages ? "collection_editorial_review" : "collection_writing");
            if (optional(stage) && entity.reuseWritingAfterImages) entity.index = flow.indexOf("collection_editorial_review");
            entity.reuseWritingAfterImages = false;
          } else stop(entity, stage, `One correction and re-review did not resolve the findings. ${d.summary}`);
        } else entity.index = index;
      }
      // Suggestions share the root with all entities, so hash only their output.
      if (stage !== "collection_suggestions") entity.hashes = await folderHashes(folder);
      await persist();
    }
  };
  // Root hashing is inappropriate for suggestions once collection files exist.
  const savedSuggestionsHash = state.suggestions.hashes?.["suggestions.md"];
  if (savedSuggestionsHash && (await wikiArtifactHashes(root))["suggestions.md"] !== savedSuggestionsHash) throw new WikiOwnershipError("Approved suggestions changed.");
  state.suggestions.hashes = undefined;
  await runEntity(state.suggestions, root, ["collection_suggestions"]);
  const suggestion = state.suggestions.history.at(-1)?.decision;
  const suggestionsPath = path.join(root, "suggestions.md");
  if (state.suggestions.status === "blocked") {
    try { await readFile(suggestionsPath); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await writeFile(suggestionsPath, state.suggestions.reason || "Suggestions blocked."); }
  } else {
    const text = await readFile(suggestionsPath, "utf8");
    const selected = suggestion?.collections ?? [];
    if (/\[source discovery incomplete\]/i.test(text) || (text.match(/\[create\]/gi)?.length ?? 0) !== selected.length || selected.some(c => !text.includes(`slug: ${c.slug}`))) throw new Error("Structured suggestions do not match every [create] recommendation.");
    state.suggestions.hashes = { "suggestions.md": (await wikiArtifactHashes(root))["suggestions.md"] };
    if (!state.collections.length) state.collections = selected.map(c => ({ ...c, state: freshEntity() }));
    await persist();
    for (const collection of state.collections) await runEntity(collection.state, path.join(root, "collections", collection.slug), collectionFlow, { slug: collection.slug, name: collection.name });
    await runEntity(state.hub, path.join(root, "wiki", options.identity.wiki_slug), hubFlow);
  }
  state.suggestions.hashes = { "suggestions.md": (await wikiArtifactHashes(root))["suggestions.md"] };
  const ready = state.suggestions.status === "completed" && state.hub.status === "completed" && approved().length > 0;
  const result: WikiWorkflowResult = {
    queueId: options.identity.id, universeId: options.identity.universe_id, wikiSlug: options.identity.wiki_slug,
    outcome: ready ? "ready" : "blocked", outcomeReason: ready ? "Authoring approved; trusted GitHub QA/publication remains pending." : state.suggestions.reason || state.hub.reason || "No collection cleared the evidence gates.",
    suggestionsPath, ...(state.hub.status === "completed" ? { wikiFinalPath: path.join(root, "wiki", options.identity.wiki_slug, "final.json") } : {}),
    approvedCollections: approved(), blockedCollections: state.collections.filter(c => c.state.status === "blocked").map(c => ({ slug: c.slug, reason: c.state.reason! })),
    collectionManifests: approved().map(slug => path.join(root, "collections", slug, "runtime-manifest.json"))
  };
  state.result = result;
  await persist();
  await saveJson(path.join(root, "workflow-result.json"), result);
  return result;
}
