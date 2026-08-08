import "../shared/load-env";

import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parse as parseDotenv } from "dotenv";
import { z } from "zod";

import { slugify } from "@/lib/slug";
import { resolveArticleDevCredentials } from "./article-queue-env";
import { fetchProductionEditorialInventory } from "./production-editorial-inventory";

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
};

const PROMPT_VERSION = "article-curation-v1-2026-08-07";
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

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "all", "best", "complete", "for", "from", "guide", "how", "in", "is",
  "list", "new", "of", "on", "roblox", "the", "tier", "to", "update", "what", "when", "where", "with"
]);

function printUsage() {
  console.log(
    "Usage: npm run articles:curate -- [--apply] [--limit N] [--model MODEL]"
  );
  console.log("GROQ_API_KEY is required. For local reuse, set GROQ_ENV_FILE=/absolute/path/to/.env.");
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    apply: false,
    limit: 60,
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

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
      .map((token) => (token.length > 4 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token))
  );
}

function groupingSimilarity(left: string, right: string): { shared: number; jaccard: number } {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const union = new Set([...leftTokens, ...rightTokens]);
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return { shared, jaccard: union.size ? shared / union.size : 0 };
}

function overlapScore(candidateTokens: Set<string>, item: InventoryItem): number {
  const itemTokens = tokens(`${item.title} ${item.key}`);
  let shared = 0;
  let longShared = 0;
  for (const token of candidateTokens) {
    if (!itemTokens.has(token)) continue;
    shared += 1;
    if (token.length >= 8) longShared += 1;
  }
  if (shared >= 2) return shared * 10 + longShared;
  if (longShared >= 1) return 5 + longShared;
  return 0;
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
  const candidateTokenSets = candidates.map((candidate) => tokens(candidate.source_title));
  return allRows
    .map((item) => ({ item, score: Math.max(...candidateTokenSets.map((set) => overlapScore(set, item))) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.family.localeCompare(b.item.family))
    .slice(0, 400)
    .map(({ item }) => item);
}

function buildPrompt(candidates: CandidateRow[], inventory: InventoryItem[], validationFeedback?: string): string {
  const candidatePayload = candidates.map((candidate, index) => ({
    id: `C${index}`,
    title: candidate.source_title,
    source: candidate.source_name,
    url: candidate.source_url,
    published_at: candidate.source_published_at,
    description: candidate.source_description?.slice(0, 500) ?? null,
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
1. Account for every candidate ID exactly once.
2. Group candidates ONLY when they cover the same Roblox game AND the same interchangeable search intent/player task. Different games must always be separate decisions. Different mechanics, items, guide goals, or ranking subjects in the same game must also be separate. Never group merely because candidates share an article type, say "tier list", or belong to the same game.
3. Reject a candidate that overlaps EXISTING BLOXODES COVERAGE, including an existing curated queue topic.
4. Do not approve a broad collection merely because the source calls it a guide.
5. A narrow gameplay task guide is allowed. A database-like "all X" reference is not. A real tier ranking is allowed and is not a collection merely because it ranks many choices.
6. Prefer topics with clear player intent, enough source evidence, and a useful angle. Reject thin announcements and topics that cannot support an accurate article.
7. Never invent a source, candidate ID, fact, or existing page.
8. Approved canonical titles must include the Roblox game name and clearly state the useful promise.
9. topic_key must be a stable lowercase hyphenated key describing game plus intent, without dates, update versions, hype, or publisher names.
10. primary_candidate_id must be one of the group's candidate_ids. Choose the clearest and most authoritative source.
11. A decision containing several IDs means those source articles could all support one identical Bloxodes article. For example, never group tier lists for different games, and never group one game's beginner guide with that game's weather-events reference.

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
Return a fully corrected JSON object. Split unrelated candidate IDs into separate decisions and still account for every ID exactly once.` : ""}`;
}

function validateDecisions(
  parsed: z.infer<typeof CurationResponseSchema>,
  candidates: CandidateRow[]
): CurationDecision[] {
  const validIds = new Set(candidates.map((_candidate, index) => `C${index}`));
  const seen = new Set<string>();
  const topicKeys = new Set<string>();

  for (const decision of parsed.decisions) {
    for (const id of decision.candidate_ids) {
      if (!validIds.has(id)) throw new Error(`Groq returned unknown candidate ID ${id}.`);
      if (seen.has(id)) throw new Error(`Groq returned candidate ${id} more than once.`);
      seen.add(id);
    }
    if (decision.candidate_ids.length > 1) {
      for (let leftIndex = 0; leftIndex < decision.candidate_ids.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < decision.candidate_ids.length; rightIndex += 1) {
          const leftAlias = decision.candidate_ids[leftIndex];
          const rightAlias = decision.candidate_ids[rightIndex];
          const left = candidates[Number(leftAlias.slice(1))];
          const right = candidates[Number(rightAlias.slice(1))];
          const similarity = groupingSimilarity(left.source_title, right.source_title);
          if (similarity.shared < 2 || similarity.jaccard < 0.3) {
            throw new Error(
              `Groq grouped unrelated candidates ${leftAlias} and ${rightAlias} (title similarity ${similarity.jaccard.toFixed(2)}).`
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
  if (seen.size !== validIds.size) {
    const missing = [...validIds].filter((id) => !seen.has(id));
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
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: buildPrompt(candidates, inventory, validationFeedback) }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 6000
      }),
      signal: AbortSignal.timeout(90_000)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq curation failed (${response.status}): ${errorText.slice(0, 500)}`);
    }
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
    source_description: candidate.source_description
  };
}

async function findExistingQueueRow(
  supabase: SupabaseClient,
  topicKey: string,
  primaryUrl: string,
  title: string
): Promise<Record<string, unknown> | null> {
  for (const [column, value] of [
    ["topic_key", topicKey],
    ["source_url", primaryUrl],
    ["idempotency_key", `global:${slugify(title)}`]
  ] as const) {
    const { data, error } = await supabase
      .from("article_generation_queue")
      .select("id, source_urls, source_items, source_metadata, status")
      .eq("workflow_mode", "agent_runner")
      .eq(column, value)
      .in("status", ["pending", "processing", "completed"])
      .maybeSingle();
    if (error) throw new Error(`Could not check existing queue ${column}: ${error.message}`);
    if (data) return data as Record<string, unknown>;
  }

  const { data: queueRows, error: queueError } = await supabase
    .from("article_generation_queue")
    .select("id, article_title, topic_key, source_urls, source_items, source_metadata, status")
    .eq("workflow_mode", "agent_runner")
    .in("status", ["pending", "processing", "completed"])
    .limit(1000);
  if (queueError) throw new Error(`Could not check semantically similar queue topics: ${queueError.message}`);
  for (const row of queueRows ?? []) {
    const existingTitle = typeof row.article_title === "string" ? row.article_title : "";
    const existingKey = typeof row.topic_key === "string" ? row.topic_key : "";
    if (existingKey && existingKey === topicKey) return row as Record<string, unknown>;
    const similarity = groupingSimilarity(title, existingTitle);
    if (similarity.jaccard >= 0.8) return row as Record<string, unknown>;
  }
  return null;
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
  supabase: SupabaseClient,
  decision: CurationDecision,
  candidates: CandidateRow[],
  runId: string,
  model: string
): Promise<string> {
  const primaryAlias = decision.primary_candidate_id!;
  const primary = candidates[Number(primaryAlias.slice(1))];
  const sourceItems = decision.candidate_ids.map((id) => queueSourceItem(candidates[Number(id.slice(1))]));
  const sourceUrls = sourceItems.map((item) => item.source_url);
  const existing = await findExistingQueueRow(supabase, decision.topic_key!, primary.source_url, decision.canonical_title!);
  if (existing) {
    const mergedItems = mergeJsonRows(existing.source_items, sourceItems, "source_url");
    const mergedUrls = [...new Set([...(Array.isArray(existing.source_urls) ? existing.source_urls.filter((url): url is string => typeof url === "string") : []), ...sourceUrls])];
    const existingMetadata = existing.source_metadata && typeof existing.source_metadata === "object"
      ? existing.source_metadata as Record<string, unknown>
      : {};
    const mergedCandidateIds = mergedItems.flatMap((item) => typeof item.candidate_id === "string" ? [item.candidate_id] : []);
    const { error } = await supabase
      .from("article_generation_queue")
      .update({
        source_items: mergedItems,
        source_urls: mergedUrls,
        sources: mergedUrls.join("\n"),
        topic_key: decision.topic_key,
        curation_model: model,
        curation_prompt_version: PROMPT_VERSION,
        curation_reason: decision.reason,
        curation_confidence: decision.confidence,
        curation_run_id: runId,
        curated_at: new Date().toISOString(),
        source_metadata: {
          ...existingMetadata,
          candidate_ids: mergedCandidateIds,
          grouped_source_count: mergedItems.length,
          primary_candidate_id: existingMetadata.primary_candidate_id ?? primary.id
        }
      })
      .eq("id", existing.id as string);
    if (error) throw new Error(`Could not merge curated sources into queue item: ${error.message}`);
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("article_generation_queue")
    .insert({
      article_title: decision.canonical_title,
      article_type: decision.article_type,
      status: "pending",
      workflow_mode: "agent_runner",
      sources: sourceUrls.join("\n"),
      source_name: primary.source_name,
      source_url: primary.source_url,
      source_published_at: primary.source_published_at,
      source_discovered_at: primary.source_discovered_at,
      source_urls: sourceUrls,
      source_items: sourceItems,
      topic_key: decision.topic_key,
      curation_model: model,
      curation_prompt_version: PROMPT_VERSION,
      curation_reason: decision.reason,
      curation_confidence: decision.confidence,
      curation_run_id: runId,
      curated_at: new Date().toISOString(),
      source_metadata: {
        candidate_ids: sourceItems.map((item) => item.candidate_id),
        grouped_source_count: sourceItems.length,
        primary_candidate_id: primary.id
      }
    })
    .select("id")
    .single();
  if (!error && data) return data.id;
  if (error?.code === "23505") {
    const raced = await findExistingQueueRow(supabase, decision.topic_key!, primary.source_url, decision.canonical_title!);
    if (raced?.id) return raced.id as string;
  }
  throw new Error(`Could not create curated queue item: ${error?.message ?? "unknown insert failure"}`);
}

async function updateCandidateDecision(
  supabase: SupabaseClient,
  candidateIds: string[],
  runId: string,
  update: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("article_discovery_candidates")
    .update(update)
    .in("id", candidateIds)
    .eq("curation_status", "processing")
    .eq("curation_run_id", runId)
    .select("id");
  if (error) throw new Error(`Could not save candidate curation decision: ${error.message}`);
  if ((data?.length ?? 0) !== candidateIds.length) {
    throw new Error(`Only ${data?.length ?? 0}/${candidateIds.length} candidate decisions were saved.`);
  }
}

async function recoverStaleCurationClaims(supabase: SupabaseClient) {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: staleRows, error: staleError } = await supabase
    .from("article_discovery_candidates")
    .select("id, curation_run_id")
    .eq("curation_status", "processing")
    .lt("updated_at", cutoff);
  if (staleError) throw new Error(`Could not find stale curation candidates: ${staleError.message}`);
  if (!staleRows?.length) return;
  const { data: recoveredRows, error: recoverError } = await supabase
    .from("article_discovery_candidates")
    .update({ curation_status: "pending", curation_run_id: null })
    .in("id", staleRows.map((row) => row.id))
    .eq("curation_status", "processing")
    .select("id");
  if (recoverError) throw new Error(`Could not recover stale curation candidates: ${recoverError.message}`);
  const staleRunIds = [...new Set(staleRows.flatMap((row) => typeof row.curation_run_id === "string" ? [row.curation_run_id] : []))];
  if (!staleRunIds.length) return;
  const { error: runError } = await supabase
    .from("article_curation_runs")
    .update({
      status: "failed",
      error: "Recovered after a curation worker left candidates processing for more than 30 minutes.",
      completed_at: new Date().toISOString()
    })
    .in("id", staleRunIds)
    .eq("status", "running");
  if (runError) throw new Error(`Could not close stale curation runs: ${runError.message}`);
  console.log(`Recovered ${recoveredRows?.length ?? 0} stale curation candidate(s).`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dev = resolveArticleDevCredentials();
  const apiKey = loadGroqApiKey();
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  if (options.apply) await recoverStaleCurationClaims(supabase);

  const { data: pendingData, error: pendingError } = await supabase
    .from("article_discovery_candidates")
    .select(
      "id, source_name, source_url, source_title, source_published_at, source_discovered_at, source_description, source_categories, discovered_from"
    )
    .eq("curation_status", "pending")
    .order("source_published_at", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(options.limit);
  if (pendingError) throw new Error(`Could not load pending discovery candidates: ${pendingError.message}`);
  let candidates = (pendingData ?? []) as CandidateRow[];
  if (!candidates.length) {
    console.log("No pending article discovery candidates to curate.");
    return;
  }

  let runId: string | null = null;
  try {
    if (options.apply) {
      const { data: run, error: runError } = await supabase
        .from("article_curation_runs")
        .insert({ model: options.model, prompt_version: PROMPT_VERSION, candidate_count: candidates.length })
        .select("id")
        .single();
      if (runError || !run) throw new Error(`Could not create curation run: ${runError?.message ?? "missing run"}`);
      runId = run.id;
      const { data: claimed, error: claimError } = await supabase
        .from("article_discovery_candidates")
        .update({ curation_status: "processing", curation_run_id: runId })
        .in("id", candidates.map((candidate) => candidate.id))
        .eq("curation_status", "pending")
        .select(
          "id, source_name, source_url, source_title, source_published_at, source_discovered_at, source_description, source_categories, discovered_from"
        );
      if (claimError) throw new Error(`Could not claim discovery candidates: ${claimError.message}`);
      candidates = (claimed ?? []) as CandidateRow[];
      if (!candidates.length) throw new Error("Every selected discovery candidate was claimed by another curator.");
    }

    const deterministic = candidates.flatMap((candidate, index) => {
      const rejected = deterministicRejection(candidate);
      return rejected
        ? [{
            candidate_ids: [`C${index}`],
            decision: "reject" as const,
            canonical_title: null,
            article_type: null,
            topic_key: null,
            primary_candidate_id: null,
            reason_code: rejected.code,
            reason: rejected.reason,
            confidence: 1
          }]
        : [];
    });
    const deterministicIds = new Set(deterministic.flatMap((decision) => decision.candidate_ids));
    const groqOriginalIndexes = candidates
      .map((_candidate, index) => index)
      .filter((index) => !deterministicIds.has(`C${index}`));
    const groqCandidates = groqOriginalIndexes.map((index) => candidates[index]);
    const productionInventory = groqCandidates.length
      ? (await fetchProductionEditorialInventory()).items
      : [];
    const inventory = loadRelevantInventory(productionInventory, groqCandidates);
    const groqResult = groqCandidates.length
      ? await curateWithGroq(apiKey, options.model, groqCandidates, inventory)
      : { decisions: [] as CurationDecision[], raw: { response: { decisions: [] } } };
    const remappedGroq = groqResult.decisions.map((decision) => ({
      ...decision,
      candidate_ids: decision.candidate_ids.map((id) => `C${groqOriginalIndexes[Number(id.slice(1))]}`),
      primary_candidate_id: decision.primary_candidate_id
        ? `C${groqOriginalIndexes[Number(decision.primary_candidate_id.slice(1))]}`
        : null
    }));
    const decisions = [...deterministic, ...remappedGroq].sort(
      (a, b) => Number(a.candidate_ids[0].slice(1)) - Number(b.candidate_ids[0].slice(1))
    );
    validateDecisions({ decisions }, candidates);

    console.table(
      decisions.map((decision) => ({
        decision: decision.decision,
        type: decision.article_type,
        topic: decision.canonical_title ?? candidates[Number(decision.candidate_ids[0].slice(1))].source_title,
        sources: decision.candidate_ids.length,
        reason: decision.reason_code,
        confidence: decision.confidence
      }))
    );
    if (!options.apply) {
      console.log(`Dry run: ${decisions.filter((decision) => decision.decision === "approve").length} approved topic group(s); no database rows changed.`);
      return;
    }

    let approvedCandidates = 0;
    let rejectedCandidates = 0;
    for (const decision of decisions) {
      const rows = decision.candidate_ids.map((id) => candidates[Number(id.slice(1))]);
      const candidateIds = rows.map((row) => row.id);
      if (decision.decision === "approve") {
        const queueId = await createOrMergeQueueItem(supabase, decision, candidates, runId!, options.model);
        await updateCandidateDecision(supabase, candidateIds, runId!, {
          curation_status: "approved",
          curation_reason_code: "approved",
          curation_reason: decision.reason,
          curation_model: options.model,
          curation_confidence: decision.confidence,
          queue_id: queueId,
          topic_key: decision.topic_key,
          curated_at: new Date().toISOString()
        });
        approvedCandidates += candidateIds.length;
      } else {
        await updateCandidateDecision(supabase, candidateIds, runId!, {
          curation_status: "rejected",
          curation_reason_code: decision.reason_code,
          curation_reason: decision.reason,
          curation_model: deterministicIds.has(decision.candidate_ids[0]) ? "deterministic" : options.model,
          curation_confidence: decision.confidence,
          queue_id: null,
          topic_key: null,
          curated_at: new Date().toISOString()
        });
        rejectedCandidates += candidateIds.length;
      }
    }

    const approvedGroups = decisions.filter((decision) => decision.decision === "approve").length;
    const { error: finishError } = await supabase
      .from("article_curation_runs")
      .update({
        status: "completed",
        candidate_count: candidates.length,
        approved_group_count: approvedGroups,
        approved_candidate_count: approvedCandidates,
        rejected_candidate_count: rejectedCandidates,
        raw_response: { groq: groqResult.raw, decisions },
        completed_at: new Date().toISOString()
      })
      .eq("id", runId!);
    if (finishError) throw new Error(`Could not complete curation run: ${finishError.message}`);
    console.log(`Curation completed: ${approvedGroups} queue topic(s), ${rejectedCandidates} rejected source candidate(s).`);
  } catch (error) {
    if (options.apply && runId) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase
        .from("article_discovery_candidates")
        .update({ curation_status: "pending", curation_run_id: null })
        .eq("curation_status", "processing")
        .eq("curation_run_id", runId);
      await supabase
        .from("article_curation_runs")
        .update({ status: "failed", error: message.slice(0, 2000), completed_at: new Date().toISOString() })
        .eq("id", runId);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
