import "./load-notion-article-env";

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { randomUUID } from "node:crypto";
import { parse as parseDotenv } from "dotenv";
import { z } from "zod";

import { slugify } from "@/lib/slug";
import {
  ARTICLE_CURATION_PROMPT_VERSION,
  ARTICLE_CURATION_REVISIT_REASON_CODES,
  ARTICLE_CURATION_ZERO_APPROVAL_WARN_RUNS
} from "./article-curation-config";
import { groupingSimilarity, sameSearchIntent } from "./article-curation-intent";
import { withArticleState, type ArticleLocalState } from "./article-local-state";
import { createNotionArticleQueue, type NotionArticleQueue } from "./notion-article-queue";
import { fetchProductionEditorialInventory } from "./production-editorial-inventory";

import { ARTICLE_TOPIC_DEDUPE_STATUSES } from "./article-queue-status";
import { findProductionArticleDuplicate } from "./article-queue-dedupe";

type Options = {
  apply: boolean;
  limit: number;
  model: string;
};

type CandidateRow = {
  id: string;
  source_name: string;
  source_url: string;
  source_title: string;
  source_published_at: string;
  source_discovered_at: string;
  source_description: string | null;
  source_evidence: { headings?: unknown; excerpt?: unknown } | null;
  source_categories: string[];
  discovered_from: string;
};

type InventoryItem = {
  family: string;
  title: string;
  key: string;
};

type QueueSourceItem = {
  candidate_id: string;
  source_name: string;
  source_url: string;
  source_title: string;
  source_published_at: string;
  source_description: string | null;
  source_evidence: CandidateRow["source_evidence"];
};

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const ReasonCodeSchema = z.enum([
  "approved",
  "codes",
  "wiki",
  "collection",
  "catalog",
  "event",
  "checklist",
  "quiz",
  "tool",
  "stats",
  "link_page",
  "duplicate_candidates",
  "existing_coverage",
  "unsupported_article_type",
  "thin_topic",
  "insufficient_evidence",
  "other"
]);

const DecisionSchema = z.object({
  candidate_ids: z.array(z.string()).min(1),
  decision: z.enum(["approve", "reject"]),
  canonical_title: z.string().nullable(),
  article_type: z.enum(["guide", "tier_list", "explainer"]).nullable(),
  topic_key: z.string().nullable(),
  primary_candidate_id: z.string().nullable(),
  reason_code: ReasonCodeSchema,
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1)
});

const CurationResponseSchema = z.object({
  decisions: z.array(DecisionSchema)
});

type CurationDecision = z.infer<typeof DecisionSchema>;

function printUsage() {
  console.log(
    "Usage: npm run articles:curate -- [--apply] [--limit N] [--model MODEL]"
  );
  console.log(
    "GROQ_API_KEY is required. Use BLOXODES_ENV_OVERLAYS=articles or set GROQ_ENV_FILE to an explicit env file."
  );
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    apply: false,
    limit: 12,
    model: process.env.ARTICLE_CURATION_MODEL?.trim() || DEFAULT_MODEL
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--limit") {
      options.limit = parseLimit(argv[++index]);
    } else if (arg.startsWith("--limit=")) {
      options.limit = parseLimit(arg.split("=")[1]);
    } else if (arg === "--model") {
      options.model = requireValue(argv[++index], "--model");
    } else if (arg.startsWith("--model=")) {
      options.model = requireValue(arg.split("=")[1], "--model");
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function parseLimit(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error("--limit must be an integer from 1 to 100.");
  }
  return parsed;
}

function requireValue(value: string | undefined, flag: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${flag} requires a value.`);
  return trimmed;
}

function loadGroqApiKey(): string {
  const direct = process.env.GROQ_API_KEY?.trim();
  if (direct) return direct;
  const envFile = process.env.GROQ_ENV_FILE?.trim();
  if (!envFile) throw new Error("GROQ_API_KEY is required. Set GROQ_ENV_FILE to reuse a local env file securely.");
  const parsed = parseDotenv(readFileSync(envFile, "utf8"));
  const key = parsed.GROQ_API_KEY?.trim();
  if (!key) throw new Error(`${envFile} does not contain GROQ_API_KEY.`);
  return key;
}

function deterministicRejection(candidate: CandidateRow): { code: "codes" | "link_page"; reason: string } | null {
  const combined = `${candidate.source_title} ${new URL(candidate.source_url).pathname.replace(/[-_/]+/g, " ")}`;
  const withoutErrors = combined.replace(/\berror codes?\b/gi, "");
  if (/\bcodes\b|\b(?:promo|redeem|working|active|expired)\s+code\b/i.test(withoutErrors)) {
    return { code: "codes", reason: "Codes and redemption coverage belongs to the codes page workflow." };
  }
  if (/\b(?:discord|trello)\b.*\b(?:link|links|server|board)\b|\bofficial links?\b/i.test(combined)) {
    return { code: "link_page", reason: "Link-directory coverage is not an article guide, tier list, or explainer." };
  }
  return null;
}

function loadRelevantInventory(allRows: InventoryItem[], candidates: CandidateRow[]): InventoryItem[] {
  return allRows
    .map((item) => ({
      item,
      score: Math.max(
        ...candidates.map((candidate) => {
          const inventoryTitle = `${item.title} ${item.key.replace(/-/g, " ")}`;
          return Math.max(...candidateIntentSurfaces(candidate).map((sourceIntent) => {
            if (!sameSearchIntent(sourceIntent, inventoryTitle)) return 0;
            const similarity = groupingSimilarity(sourceIntent, inventoryTitle);
            return similarity.shared * 10 + similarity.jaccard;
          }));
        })
      )
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.family.localeCompare(b.item.family))
    .slice(0, 80)
    .map(({ item }) => item);
}

function candidateIntentSurfaces(candidate: CandidateRow): string[] {
  const headings = Array.isArray(candidate.source_evidence?.headings)
    ? candidate.source_evidence.headings.filter((value): value is string => typeof value === "string").slice(0, 16)
    : [];
  return [candidate.source_title, candidate.source_description ?? "", ...headings].filter(Boolean);
}

function candidateSearchCorpus(candidate: CandidateRow): string {
  return candidateIntentSurfaces(candidate).join(" ");
}

function supportsDerivedAngle(candidate: CandidateRow, canonicalTitle: string): boolean {
  if (sameSearchIntent(candidate.source_title, canonicalTitle)) return true;
  const similarity = groupingSimilarity(candidateSearchCorpus(candidate), canonicalTitle);
  return similarity.shared >= 3 || (similarity.shared >= 2 && similarity.jaccard >= 0.18);
}

function buildPrompt(candidates: CandidateRow[], inventory: InventoryItem[], validationFeedback?: string): string {
  const candidatePayload = candidates.map((candidate, index) => ({
    id: `C${index}`,
    title: candidate.source_title,
    source: candidate.source_name,
    url: candidate.source_url,
    published_at: candidate.source_published_at,
    description: candidate.source_description?.slice(0, 500) ?? null,
    source_headings: Array.isArray(candidate.source_evidence?.headings)
      ? candidate.source_evidence.headings
        .filter((value): value is string => typeof value === "string")
        .slice(0, 8)
        .map((value) => value.slice(0, 120))
      : [],
    source_excerpt: typeof candidate.source_evidence?.excerpt === "string"
      ? candidate.source_evidence.excerpt.slice(0, 600)
      : null,
    categories: candidate.source_categories
  }));
  const inventoryPayload = inventory.map((item) => ({ family: item.family, title: item.title, key: item.key }));

  return `You are the strict Bloxodes Roblox editorial curator. Review every discovery candidate, group sources that cover the same core topic, and decide which topic groups deserve an article-generation job.

ONLY APPROVE these article types:
- guide: a focused, actionable gameplay how-to or progression guide
- tier_list: a genuine ranking of units, weapons, classes, abilities, traits, or similar gameplay choices
- explainer: a focused explanation of one useful gameplay mechanic or system

REJECT anything owned by another Bloxodes page family:
- codes: active codes, expired codes, promo codes, redemption instructions, or code lists
- wiki: broad game overviews, wiki hubs, controls hubs, or "everything you need to know"
- collection: exhaustive reference inventories such as all weapons, all pets, all boats, all NPCs, all items, all characters, or database-style lists
- catalog: IDs, asset catalogs, music/decal/font lists, broad cross-game item directories
- event: countdowns, schedules, release dates/times, "when is the next update", event hubs, or event calendars
- checklist, quiz, tool/calculator/planner/tracker, stats/leaderboard, Trello/Discord/official-links pages

CURATION RULES:
1. Account for every candidate ID at least once. Usually use it once. A single source lead may appear in several approved decisions only when its evidence clearly supports several distinct, useful article angles. A rejected candidate must appear exactly once and may not also appear in an approved decision.
2. Group candidates ONLY when they cover the same Roblox game AND the same interchangeable search intent/player task. Different games must always be separate decisions. Different mechanics, items, guide goals, or ranking subjects in the same game must also be separate. Never group merely because candidates share an article type, say "tier list", or belong to the same game.
3. Reject a candidate that overlaps EXISTING BLOXODES COVERAGE, including an existing curated queue topic, only when it serves the same interchangeable player task or search intent. Sharing a game name, article type, broad category, or one generic noun is never enough. A guide for one item, mechanic, location, job, style, or ritual does not overlap a different guide in the same game.
4. Do not approve a broad collection merely because the source calls it a guide.
5. A narrow gameplay task guide is allowed. A database-like "all X" reference is not. A real tier ranking is allowed and is not a collection merely because it ranks many choices.
6. Treat patch notes and update announcements as source leads, not necessarily as the final article. Derive focused guides or explainers from their headings and excerpt when they reveal a concrete player task, mechanic, item, boss, build, ritual, unlock, or progression change. One update source may yield zero, one, or several distinct approved angles. Never approve a patch-notes recap merely because it is recent.
7. Prefer topics with clear player intent, enough source evidence, and a useful angle. Reject thin announcements only when their supplied headings/excerpt do not support a focused article.
8. Never invent a source, candidate ID, fact, or existing page.
9. Approved canonical titles must include the Roblox game name and clearly state the useful promise.
10. topic_key must be a stable lowercase hyphenated key describing game plus intent, without dates, update versions, hype, or publisher names.
11. primary_candidate_id must be one of the group's candidate_ids. Choose the clearest and most authoritative source.
12. A decision containing several IDs means those source articles could all support one identical Bloxodes article. For example, never group tier lists for different games, and never group one game's beginner guide with that game's weather-events reference.

Allowed reason_code values:
approved, codes, wiki, collection, catalog, event, checklist, quiz, tool, stats, link_page, duplicate_candidates, existing_coverage, unsupported_article_type, thin_topic, insufficient_evidence, other

For rejected decisions, canonical_title, article_type, topic_key, and primary_candidate_id must be null. For approved decisions, reason_code must be "approved" and those fields must be populated.

Return only this JSON object:
{
  "decisions": [
    {
      "candidate_ids": ["C0", "C2"],
      "decision": "approve",
      "canonical_title": "Game Name Beginner Progression Guide",
      "article_type": "guide",
      "topic_key": "game-name-beginner-progression",
      "primary_candidate_id": "C0",
      "reason_code": "approved",
      "reason": "Focused gameplay guide with clear player intent and no owned-page overlap.",
      "confidence": 0.93
    }
  ]
}

DISCOVERY CANDIDATES:
${JSON.stringify(candidatePayload)}

RELEVANT EXISTING BLOXODES COVERAGE:
${JSON.stringify(inventoryPayload)}${validationFeedback ? `

YOUR PREVIOUS RESPONSE FAILED LOCAL VALIDATION:
${validationFeedback}
Return a fully corrected JSON object. Split unrelated candidate IDs into separate decisions. Account for every ID, allowing reuse only across distinct approved angles supported by that lead.` : ""}`;
}

export function validateDecisions(
  parsed: z.infer<typeof CurationResponseSchema>,
  candidates: CandidateRow[]
): CurationDecision[] {
  const validIds = new Set(candidates.map((_candidate, index) => `C${index}`));
  const approvedIds = new Set<string>();
  const rejectedIds = new Set<string>();
  const topicKeys = new Set<string>();

  for (const decision of parsed.decisions) {
    for (const id of decision.candidate_ids) {
      if (!validIds.has(id)) throw new Error(`Groq returned unknown candidate ID ${id}.`);
      if (decision.decision === "reject") {
        if (rejectedIds.has(id)) throw new Error(`Groq rejected candidate ${id} more than once.`);
        if (approvedIds.has(id)) throw new Error(`Groq both approved and rejected candidate ${id}.`);
        rejectedIds.add(id);
      } else {
        if (rejectedIds.has(id)) throw new Error(`Groq both rejected and approved candidate ${id}.`);
        approvedIds.add(id);
      }
    }
    if (decision.candidate_ids.length > 1) {
      for (let leftIndex = 0; leftIndex < decision.candidate_ids.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < decision.candidate_ids.length; rightIndex += 1) {
          const leftAlias = decision.candidate_ids[leftIndex];
          const rightAlias = decision.candidate_ids[rightIndex];
          const left = candidates[Number(leftAlias.slice(1))];
          const right = candidates[Number(rightAlias.slice(1))];
          const similarity = groupingSimilarity(left.source_title, right.source_title);
          const supportsApprovedAngle = decision.decision === "approve" && Boolean(decision.canonical_title) &&
            supportsDerivedAngle(left, decision.canonical_title!) && supportsDerivedAngle(right, decision.canonical_title!);
          if (!sameSearchIntent(left.source_title, right.source_title) && !supportsApprovedAngle) {
            throw new Error(
              `Groq grouped candidates ${leftAlias} and ${rightAlias} without the same search intent or shared evidence for the derived angle (title similarity ${similarity.jaccard.toFixed(2)}).`
            );
          }
        }
      }
    }
    if (decision.decision === "approve") {
      if (!decision.canonical_title || !decision.article_type || !decision.topic_key || !decision.primary_candidate_id) {
        throw new Error("Groq approved a topic without all required article fields.");
      }
      if (decision.reason_code !== "approved") throw new Error("Groq approved a topic with a rejection reason code.");
      if (!decision.candidate_ids.includes(decision.primary_candidate_id)) {
        throw new Error("Groq primary_candidate_id is not part of its topic group.");
      }
      const normalizedKey = slugify(decision.topic_key);
      if (!normalizedKey) throw new Error("Groq approved a topic with an empty topic_key.");
      if (topicKeys.has(normalizedKey)) throw new Error(`Groq returned duplicate approved topic_key ${normalizedKey}.`);
      topicKeys.add(normalizedKey);
      decision.topic_key = normalizedKey;
    } else {
      if (decision.reason_code === "approved") throw new Error("Groq rejected a topic with the approved reason code.");
      if (decision.canonical_title || decision.article_type || decision.topic_key || decision.primary_candidate_id) {
        throw new Error("Groq rejected a topic but populated article-only fields.");
      }
    }
  }
  const accounted = new Set([...approvedIds, ...rejectedIds]);
  if (accounted.size !== validIds.size) {
    const missing = [...validIds].filter((id) => !accounted.has(id));
    throw new Error(`Groq did not account for candidates: ${missing.join(", ")}`);
  }
  return parsed.decisions;
}

async function curateWithGroq(
  apiKey: string,
  model: string,
  candidates: CandidateRow[],
  inventory: InventoryItem[]
): Promise<{ decisions: CurationDecision[]; raw: Record<string, unknown> }> {
  const attempts: Record<string, unknown>[] = [];
  let validationFeedback: string | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response: Response | null = null;
    for (let requestAttempt = 1; requestAttempt <= 3; requestAttempt += 1) {
      response = await fetch(GROQ_CHAT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: buildPrompt(candidates, inventory, validationFeedback) }],
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: Math.min(3200, Math.max(1200, 700 + candidates.length * 190))
        }),
        signal: AbortSignal.timeout(90_000)
      });
      if (response.ok) break;
      const errorText = await response.text();
      if (response.status !== 429 || requestAttempt === 3) {
        throw new Error(`Groq curation failed (${response.status}): ${errorText.slice(0, 500)}`);
      }
      const retryHeader = Number(response.headers.get("retry-after"));
      const bodySeconds = Number(errorText.match(/try again in ([\d.]+)s/i)?.[1]);
      const retrySeconds = Number.isFinite(retryHeader) && retryHeader > 0
        ? retryHeader
        : Number.isFinite(bodySeconds) && bodySeconds > 0
          ? bodySeconds
          : 30 * requestAttempt;
      const waitMs = Math.min(90_000, Math.max(1_000, Math.ceil(retrySeconds * 1000) + 1_000));
      console.warn(`Groq curation rate limited; retrying request in ${Math.ceil(waitMs / 1000)} seconds.`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    if (!response?.ok) throw new Error("Groq curation exhausted its rate-limit retries.");
    const payload = (await response.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
      usage?: Record<string, unknown>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq returned no curation content.");
    try {
      const json = JSON.parse(content) as unknown;
      const parsed = CurationResponseSchema.safeParse(json);
      if (!parsed.success) throw new Error(`Groq curation JSON failed validation: ${parsed.error.message}`);
      const decisions = validateDecisions(parsed.data, candidates);
      attempts.push({ attempt, usage: payload.usage ?? null, response: parsed.data });
      if (payload.usage) console.log(`Groq usage: ${JSON.stringify(payload.usage)}`);
      return {
        decisions,
        raw: { model: payload.model ?? model, attempts }
      };
    } catch (error) {
      validationFeedback = error instanceof Error ? error.message : String(error);
      attempts.push({ attempt, usage: payload.usage ?? null, validation_error: validationFeedback });
      if (attempt === 3) throw new Error(`Groq failed local curation validation after 3 attempts: ${validationFeedback}`);
    }
  }
  throw new Error("Groq curation exhausted its validation attempts.");
}

function queueSourceItem(candidate: CandidateRow): QueueSourceItem {
  return {
    candidate_id: candidate.id,
    source_name: candidate.source_name,
    source_url: candidate.source_url,
    source_title: candidate.source_title,
    source_published_at: candidate.source_published_at,
    source_description: candidate.source_description,
    source_evidence: candidate.source_evidence
  };
}

function mergeJsonRows<T extends object>(existing: unknown, incoming: T[], key: keyof T): Record<string, unknown>[] {
  const rows = Array.isArray(existing) ? existing.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [];
  const merged = new Map<string, Record<string, unknown>>();
  for (const inputRow of [...rows, ...incoming]) {
    const row = inputRow as Record<string, unknown>;
    const value = typeof row[key as string] === "string" ? row[key as string] : JSON.stringify(row);
    merged.set(String(value), row);
  }
  return [...merged.values()];
}

async function createOrMergeQueueItem(
  queue: NotionArticleQueue, decision: CurationDecision, candidates: CandidateRow[], runId: string, model: string
): Promise<string> {
  const primary = candidates[Number(decision.primary_candidate_id!.slice(1))];
  const sourceItems = decision.candidate_ids.map(id => queueSourceItem(candidates[Number(id.slice(1))]));
  const sourceUrls = sourceItems.map(item => item.source_url);
  const result = await queue.put({
    article_title: decision.canonical_title, article_type: decision.article_type, status: "pending",
    workflow_mode: "agent_runner", source_name: primary.source_name, source_url: primary.source_url,
    source_published_at: primary.source_published_at, source_discovered_at: primary.source_discovered_at,
    source_urls: sourceUrls, source_items: sourceItems, topic_key: decision.topic_key,
    curation_model: model, curation_prompt_version: ARTICLE_CURATION_PROMPT_VERSION,
    curation_reason: decision.reason, curation_confidence: decision.confidence, curation_run_id: runId,
    curated_at: new Date().toISOString(),
    source_metadata: { candidate_ids: sourceItems.map(item => item.candidate_id), grouped_source_count: sourceItems.length, primary_candidate_id: primary.id }
  });
  if (!result.created) {
    const existing = result.row;
    const mergedItems = mergeJsonRows(existing.source_items, sourceItems, "source_url");
    const mergedUrls = [...new Set([...existing.source_urls, ...sourceUrls])];
    if (JSON.stringify(mergedItems) !== JSON.stringify(existing.source_items) || JSON.stringify(mergedUrls) !== JSON.stringify(existing.source_urls)) {
      await queue.update(existing.id, { source_items: mergedItems, source_urls: mergedUrls, sources: mergedUrls.join("\n"),
        source_metadata: { ...existing.source_metadata, candidate_ids: mergedItems.map(item => item.candidate_id).filter(Boolean), grouped_source_count: mergedItems.length } });
    }
  }
  return result.row.id;
}

function markRepeatedZeroApprovalDegraded(state: ArticleLocalState, run: Record<string, any>) {
  if (run.approved_group_count > 0) return false;
  const recent = state.runs.filter(row => row.prompt_version === ARTICLE_CURATION_PROMPT_VERSION && row.status === "completed").slice(-ARTICLE_CURATION_ZERO_APPROVAL_WARN_RUNS);
  if (recent.length < ARTICLE_CURATION_ZERO_APPROVAL_WARN_RUNS || recent.some(row => row.approved_group_count > 0)) return false;
  run.degraded = true;
  run.degraded_reason = `${ARTICLE_CURATION_ZERO_APPROVAL_WARN_RUNS} consecutive ${ARTICLE_CURATION_PROMPT_VERSION} runs approved zero topics.`;
  console.error(`DEGRADED ARTICLE CURATION: ${run.degraded_reason}`);
  return true;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const queue = createNotionArticleQueue();
  await queue.validate();
  const apiKey = loadGroqApiKey();
  await withArticleState(options.apply, async (state, save) => {
    // A saved plan resumes with exactly the same aliases and decisions. An
    // interrupted model call has made no queue writes and can start again.
    const resumable = state.runs.find(run => run.status === "running" && Array.isArray(run.decisions));
    for (const run of state.runs.filter(run => run.status === "running" && run !== resumable)) {
      run.status = "failed"; run.error = "Recovered interrupted curation before a decision plan was saved.";
      run.completed_at = new Date().toISOString();
    }
    for (const candidate of state.candidates) {
      if (candidate.curation_status === "processing" && candidate.curation_run_id !== resumable?.id) {
        candidate.curation_status = "pending"; candidate.curation_run_id = null;
      }
    }
    const queued = await queue.list();
    if (options.apply) {
      const duplicates = await queue.reconcileDuplicates(queued);
      if (duplicates) console.log(`Skipped ${duplicates} duplicate article queue row(s).`);
      const recovered = await queue.recoverClaims(queued);
      if (recovered) console.log(`Recovered ${recovered} expired article queue claim(s) or due blocked item(s).`);
    }
    const statuses = new Map(queued.map(row => [row.id, row.status]));
    const revisit = new Set<string>(ARTICLE_CURATION_REVISIT_REASON_CODES);
    for (const candidate of state.candidates) {
      if (candidate.curation_prompt_version === ARTICLE_CURATION_PROMPT_VERSION) continue;
      const ids = [...new Set([candidate.queue_id, ...(candidate.queue_ids ?? [])].filter(Boolean))];
      if (candidate.curation_status === "rejected" && revisit.has(candidate.curation_reason_code) ||
          candidate.curation_status === "approved" && ids.some(id => ["skipped", "failed"].includes(statuses.get(id) ?? ""))) {
        Object.assign(candidate, { curation_status: "pending", curation_run_id: null, queue_id: null, queue_ids: [],
          curation_prompt_version: null, recuration_count: Number(candidate.recuration_count ?? 0) + 1 });
      }
    }
    const selected = resumable ? resumable.candidate_ids.map((id: string) => {
      const candidate = state.candidates.find(row => row.id === id);
      if (!candidate) throw new Error(`Curation recovery is missing candidate ${id}.`);
      return candidate;
    }) : state.candidates.filter(row => row.curation_status === "pending")
      .sort((a, b) => String(b.source_published_at ?? "").localeCompare(String(a.source_published_at ?? "")) || a.created_at.localeCompare(b.created_at)).slice(0, options.limit);
    const candidates = selected as CandidateRow[];
    const run: Record<string, any> = resumable ?? { id: randomUUID(), status: "running", model: options.model,
      prompt_version: ARTICLE_CURATION_PROMPT_VERSION, candidate_count: candidates.length,
      candidate_ids: candidates.map(candidate => candidate.id), created_at: new Date().toISOString() };
    if (options.apply) {
      if (!resumable) state.runs.push(run);
      for (const candidate of selected) Object.assign(candidate, { curation_status: "processing", curation_run_id: run.id, updated_at: new Date().toISOString() });
      await save();
    }
    try {
      let decisions = run.decisions as CurationDecision[] | undefined;
      if (!decisions) {
        const deterministic: CurationDecision[] = candidates.flatMap((candidate, index) => {
          const rejected = deterministicRejection(candidate);
          return rejected ? [{ candidate_ids: [`C${index}`], decision: "reject" as const,
            canonical_title: null, article_type: null, topic_key: null, primary_candidate_id: null,
            reason_code: rejected.code, reason: rejected.reason, confidence: 1 }] : [];
        });
        const deterministicIds = new Set(deterministic.flatMap(decision => decision.candidate_ids));
        const indexes = candidates.map((_candidate, index) => index).filter(index => !deterministicIds.has(`C${index}`));
        const groqCandidates = indexes.map(index => candidates[index]);
        const production = groqCandidates.length ? (await fetchProductionEditorialInventory()).items : [];
        const inventory = loadRelevantInventory([...production, ...queued.filter(row => ARTICLE_TOPIC_DEDUPE_STATUSES.includes(row.status)).map(row => ({ family: "queue", title: row.article_title, key: row.topic_key || row.id }))], groqCandidates);
        const result = groqCandidates.length ? await curateWithGroq(apiKey, options.model, groqCandidates, inventory)
          : { decisions: [] as CurationDecision[], raw: {} };
        decisions = [...deterministic, ...result.decisions.map(decision => ({ ...decision,
          candidate_ids: decision.candidate_ids.map(id => `C${indexes[Number(id.slice(1))]}`),
          primary_candidate_id: decision.primary_candidate_id ? `C${indexes[Number(decision.primary_candidate_id.slice(1))]}` : null
        }))].sort((a, b) => Number(a.candidate_ids[0].slice(1)) - Number(b.candidate_ids[0].slice(1)));
        validateDecisions({ decisions }, candidates);
        Object.assign(run, { decisions, raw_response: result.raw });
        await save();
      }
      // Recheck current production before any queue creation, including resumes.
      const production = decisions.some(decision => decision.decision === "approve") ? (await fetchProductionEditorialInventory()).items : [];
      decisions = decisions.map(decision => decision.decision === "approve" && findProductionArticleDuplicate(decision.canonical_title!, production)
        ? { ...decision, decision: "reject" as const, canonical_title: null, article_type: null, topic_key: null, primary_candidate_id: null,
            reason_code: "existing_coverage" as const, reason: "The article is already published in production." } : decision);
      console.table(decisions.map(decision => ({ decision: decision.decision, title: decision.canonical_title, reason: decision.reason_code })));
      if (!options.apply) { console.log("Dry run: no Notion pages or state files changed."); return; }
      const idsByAlias = new Map<string, Array<{ queueId: string; decision: CurationDecision }>>();
      for (const decision of decisions.filter(decision => decision.decision === "approve")) {
        const queueId = await createOrMergeQueueItem(queue, decision, candidates, run.id, run.model);
        for (const alias of decision.candidate_ids) idsByAlias.set(alias, [...(idsByAlias.get(alias) ?? []), { queueId, decision }]);
      }
      let approved = 0, rejected = 0;
      for (const [index, candidate] of selected.entries()) {
        const alias = `C${index}`, approvals = idsByAlias.get(alias) ?? [];
        if (approvals.length) {
          const ids = [...new Set(approvals.map(entry => entry.queueId))];
          const keys = [...new Set(approvals.map(entry => entry.decision.topic_key))];
          Object.assign(candidate, { curation_status: "approved", curation_reason_code: "approved",
            curation_reason: approvals.map(entry => entry.decision.reason).join(" | ").slice(0, 2000),
            curation_confidence: Math.max(...approvals.map(entry => entry.decision.confidence)),
            queue_id: ids[0], queue_ids: ids, topic_key: keys.length === 1 ? keys[0] : null });
          approved++;
        } else {
          const rejection = decisions.find(decision => decision.decision === "reject" && decision.candidate_ids.includes(alias));
          if (!rejection) throw new Error(`Candidate ${alias} has no curation outcome.`);
          Object.assign(candidate, { curation_status: "rejected", curation_reason_code: rejection.reason_code,
            curation_reason: rejection.reason, curation_confidence: rejection.confidence, queue_id: null, queue_ids: [], topic_key: null });
          rejected++;
        }
        Object.assign(candidate, { curation_model: run.model, curation_prompt_version: ARTICLE_CURATION_PROMPT_VERSION,
          curated_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
      Object.assign(run, { status: "completed", approved_group_count: decisions.filter(decision => decision.decision === "approve").length,
        approved_candidate_count: approved, rejected_candidate_count: rejected, completed_at: new Date().toISOString(), decisions });
      if (markRepeatedZeroApprovalDegraded(state, run)) process.exitCode = 2;
      await save();
      console.log(`Curation completed: ${run.approved_group_count} queue topic(s), ${rejected} rejected source candidate(s).`);
    } catch (error) {
      // Retain the plan and processing rows. The OS/PID lock makes the next
      // invocation the sole owner and it resumes the same Notion idempotency keys.
      if (options.apply) { run.error = error instanceof Error ? error.message : String(error); await save(); }
      throw error;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
