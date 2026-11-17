import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse as parseDotenv } from "dotenv";
import { CodesQueue, makeRequest } from "../codes/discovery-io";
import { articleQueueIdempotencyKey } from "./article-queue-dedupe";
import { compareArticleTopics } from "./article-topic-similarity";
import { ARTICLE_QUEUE_STATUSES, ARTICLE_TOPIC_DEDUPE_STATUSES, type ArticleQueueStatus } from "./article-queue-status";

export const ARTICLE_QUEUE_DATABASE = "4197bc97c44381f9acb8e00d51ed7a12";
export const ARTICLE_QUEUE_SOURCE = "4197bc97-c443-8125-977a-000b7ede5751";
export type ArticleQueueRow = {
  id: string;
  article_title: string;
  article_type: string | null;
  status: ArticleQueueStatus;
  workflow_mode: string;
  created_at: string;
  updated_at: string;
  attempts: number;
  result_slug: string | null;
  result_path: string | null;
  production_url: string | null;
  source_url: string | null;
  source_urls: string[];
  source_items: any[];
  source_metadata: Record<string, any>;
  topic_key: string | null;
  idempotency_key: string | null;
  dev_queue_id: string | null;
  [key: string]: any;
};

const textFields: Record<string, string> = {
  topic_key: "Topic key", idempotency_key: "Idempotency key", event_id: "Event ID",
  source_name: "Source name", source_urls: "Source URLs", curation_model: "Curation model",
  curation_reason: "Curation reason", locked_by: "Worker", outcome_reason: "Run report",
  result_slug: "Result slug", result_path: "Result path", dev_queue_id: "Dev queue ID",
  // Generation id of the committed body snapshot. A snapshot counts only once this property names it.
  body_generation: "Snapshot"
};
const numberFields: Record<string, string> = { universe_id: "Universe ID", curation_confidence: "Curation confidence", attempts: "Attempts" };
const dateFields: Record<string, string> = {
  source_published_at: "Source published", source_discovered_at: "Discovered", curated_at: "Curated",
  locked_at: "Claimed", next_attempt_at: "Retry after", completed_at: "Completed", published_at: "Published"
};
const urlFields: Record<string, string> = { source_url: "Source URL", production_url: "Live page" };
export type ArticleQueueConfig = {
  source: string; database: string; name: string; bodyMarker: string;
  textFields: Record<string, string>; numberFields: Record<string, string>;
  dateFields: Record<string, string>; urlFields: Record<string, string>; selectFields: Record<string, string>;
  statuses: readonly string[]; types: readonly string[]; ownerRows?: boolean;
};
export const ROBLOX_ARTICLE_QUEUE: ArticleQueueConfig = {
  source: ARTICLE_QUEUE_SOURCE, database: ARTICLE_QUEUE_DATABASE, name: "Article Queue",
  bodyMarker: "bloxodes-article-queue@1", textFields, numberFields, dateFields, urlFields, selectFields: {},
  statuses: ARTICLE_QUEUE_STATUSES, types: ["guide", "tier_list", "explainer", "how_to", "listicle", "news", "opinion"],
};
const { event_id: _event, dev_queue_id: _dev, ...gameTextFields } = textFields;
const { source_published_at: _published, source_discovered_at: _discovered, ...gameDateFields } = dateFields;
export const GAME_ARTICLE_QUEUE: ArticleQueueConfig = {
  source: "41a7bc97-c443-81fa-9567-000b9788bcfc", database: "41a7bc97c443814ea0c8d2a90c611f76",
  name: "Game Article Queue", bodyMarker: "bloxodes-game-article-queue@1", ownerRows: true,
  textFields: { ...gameTextFields, game: "Game", namespace: "Namespace", game_slug: "Game slug" },
  numberFields: { attempts: "Attempts" }, dateFields: gameDateFields, urlFields,
  selectFields: { added_by: "Added by", game_kind: "Game kind" },
  statuses: ["pending", "processing", "blocked", "completed", "published", "skipped"],
  types: ["guide", "tier_list", "explainer", "news"],
};
const statusName = (value: string) => value[0].toUpperCase() + value.slice(1);
const plain = (value: any) => (value ?? []).map((part: any) => part.plain_text ?? part.text?.content ?? "").join("");

export function notionRichText(value: string) {
  // Split Unicode code points so a boundary never leaves an unpaired surrogate.
  const chars = Array.from(value);
  const parts = [];
  let chunk = "";
  for (const char of chars) {
    if (chunk.length + char.length > 2000) { parts.push({ type: "text", text: { content: chunk } }); chunk = ""; }
    chunk += char;
  }
  if (chunk) parts.push({ type: "text", text: { content: chunk } });
  if (parts.length > 100) throw new Error("Notion property exceeds 100 text objects; move this field to the queue body.");
  return parts;
}

// Notion stores date properties to the minute, even when the API accepts seconds.
export function notionQueueDate(value: string) {
  const date=new Date(value);if(!Number.isFinite(date.getTime()))throw new Error("Invalid queue date.");
  date.setUTCSeconds(0,0);return date.toISOString();
}

export function articleQueueProperties(row: Record<string, any>, config = ROBLOX_ARTICLE_QUEUE) {
  const { textFields, numberFields, dateFields, urlFields } = config;
  if (row.status != null && !config.statuses.includes(row.status))throw new Error(`Unsupported ${config.name} status: ${row.status}`);
  if (row.article_type != null && !config.types.includes(row.article_type))throw new Error(`Unsupported ${config.name} type: ${row.article_type}`);
  const properties: Record<string, any> = {};
  if ("article_title" in row) properties.Title = { title: notionRichText(row.article_title ?? "") };
  if ("status" in row) properties.Status = { select: { name: statusName(row.status) } };
  if ("article_type" in row) properties.Type = { select: row.article_type ? { name: row.article_type } : null };
  for (const [field, name] of Object.entries(textFields)) if (field in row) {
    const value = field === "source_urls" ? JSON.stringify(row[field] ?? []) : String(field === "outcome_reason" ? row.outcome_reason ?? row.last_error ?? "" : row[field] ?? "");
    properties[name] = { rich_text: notionRichText(value) };
  }
  if (!("outcome_reason" in row) && "last_error" in row) properties["Run report"] = { rich_text: notionRichText(row.last_error ?? "") };
  for (const [field, name] of Object.entries(numberFields)) if (field in row) properties[name] = { number: row[field] ?? null };
  for (const [field, name] of Object.entries(urlFields)) if (field in row) properties[name] = { url: row[field] || null };
  for (const [field, name] of Object.entries(dateFields)) if (field in row) properties[name] = { date: row[field] ? { start: notionQueueDate(row[field]) } : null };
  for (const [field, name] of Object.entries(config.selectFields)) if (field in row) {
    properties[name] = { select: row[field] ? { name: field === "added_by" ? statusName(row[field]) : row[field] } : null };
  }
  return properties;
}

// Full snapshots keep source evidence and legacy fields out of 2,000-char properties.
// Each snapshot is one API request. Incomplete snapshots are ignored on readback.
export function articleQueueBody(row: Record<string, any>, generation = randomUUID(), config = ROBLOX_ARTICLE_QUEUE) {
  const { body_generation: _ignored, ...evidence } = row;
  const serialized = JSON.stringify(evidence);
  if (Buffer.byteLength(serialized) > 200_000) throw new Error("Article queue evidence exceeds the 200 KB page snapshot limit.");
  const chunks: string[] = [];
  let chunk = "";
  for (const char of serialized) {
    if (chunk.length + char.length > 16000) { chunks.push(chunk); chunk = ""; }
    chunk += char;
  }
  chunks.push(chunk);
  return chunks.map((content, index) => ({ object: "block", type: "code", code: {
    language: "json", rich_text: notionRichText(content),
    caption: notionRichText(`${config.bodyMarker}/${generation}/${index}/${chunks.length}`)
  } }));
}

// With a committed generation, only that snapshot is read, so a snapshot appended
// before a failed property write never shows. Rows without one use the newest complete snapshot.
export function articleQueueBodyData(blocks: any[], committed: string | null = null, config = ROBLOX_ARTICLE_QUEUE): Record<string, any> {
  if (committed === "empty") return {};
  const groups = new Map<string, { total: number; parts: Map<number, string> }>();
  for (const block of blocks) {
    const caption = plain(block.code?.caption);
    if (!caption.startsWith(`${config.bodyMarker}/`)) continue;
    const [, generation, index, total] = caption.split("/");
    const group = groups.get(generation) ?? { total: Number(total), parts: new Map() };
    group.parts.set(Number(index), plain(block.code.rich_text));
    groups.set(generation, group);
  }
  let result = {};
  for (const [generation, group] of groups) if (group.parts.size === group.total) {
    if (committed && generation !== committed) continue;
    const parts = Array.from({ length: group.total }, (_, index) => group.parts.get(index));
    if (parts.every(part => typeof part === "string")) result = JSON.parse(parts.join(""));
  }
  if (committed && !Object.keys(result).length) throw new Error(`Article Queue snapshot ${committed} is missing or incomplete.`);
  return result;
}

/** The newest complete snapshot generation in a page body, or null. */
export function articleQueueNewestGeneration(blocks: any[], config = ROBLOX_ARTICLE_QUEUE): string | null {
  const groups = new Map<string, { total: number; parts: Set<number> }>();
  for (const block of blocks) {
    const caption = plain(block.code?.caption);
    if (!caption.startsWith(`${config.bodyMarker}/`)) continue;
    const [, generation, index, total] = caption.split("/");
    const group = groups.get(generation) ?? { total: Number(total), parts: new Set() };
    group.parts.add(Number(index));
    groups.set(generation, group);
  }
  let newest: string | null = null;
  for (const [generation, group] of groups) if (group.parts.size === group.total) newest = generation;
  return newest;
}

export function articleQueueFromPage(page: any, body: Record<string, any> = {}, config = ROBLOX_ARTICLE_QUEUE): ArticleQueueRow {
  const { textFields, numberFields, dateFields, urlFields } = config;
  const p = page.properties;
  const row: Record<string, any> = { ...body, id: page.id, workflow_mode: body.workflow_mode ?? "agent_runner",
    article_title: plain(p.Title?.title), article_type: p.Type?.select?.name ?? null,
    status: (p.Status?.select?.name ?? (config.ownerRows ? "Pending" : "")).toLowerCase(), created_at: body.created_at ?? page.created_time,
    updated_at: page.last_edited_time, source_items: body.source_items ?? [], source_metadata: body.source_metadata ?? {} };
  if (!config.statuses.includes(row.status)) throw new Error(`Article Queue has an invalid status on ${page.id}.`);
  for (const [field, name] of Object.entries(textFields)) row[field] = plain(p[name]?.rich_text) || null;
  const urls = row.source_urls ?? "";
  try { row.source_urls = JSON.parse(urls || "[]"); } catch { row.source_urls = urls.split(/\n/).map((s: string) => s.trim()).filter(Boolean); }
  if (!Array.isArray(row.source_urls) || row.source_urls.some((url: unknown) => typeof url !== "string")) throw new Error(`Invalid Source URLs on ${page.id}.`);
  for (const [field, name] of Object.entries(numberFields)) row[field] = p[name]?.number ?? null;
  for (const [field, name] of Object.entries(urlFields)) row[field] = p[name]?.url ?? null;
  for (const [field, name] of Object.entries(dateFields)) row[field] = (p[name]?.date?.start ? new Date(p[name].date.start).toISOString() : null);
  for (const [field, name] of Object.entries(config.selectFields)) row[field] = p[name]?.select?.name?.toLowerCase() ?? (field === "added_by" ? "owner" : null);
  if(config.ownerRows && row.source_url && !row.source_urls.includes(row.source_url))row.source_urls.push(row.source_url);
  row.sources = body.sources ?? row.source_urls.join("\n");
  if(config.ownerRows)row.type=row.article_type;
  row.attempts ??= 0;
  row.last_error = body.last_error ?? (row.status === "blocked" || row.status === "failed" ? row.outcome_reason : null);
  return row as ArticleQueueRow;
}

export function duplicateQueueRow(rows: ArticleQueueRow[], incoming: Record<string, any>) {
  // A matching topic or idempotency key is a duplicate on its own; the meaning check only adds matches.
  const active = rows.filter(row => ARTICLE_TOPIC_DEDUPE_STATUSES.includes(row.status));
  const keyMatch = active.find(row => incoming.topic_key && row.topic_key === incoming.topic_key)
    ?? active.find(row => incoming.idempotency_key && row.idempotency_key === incoming.idempotency_key);
  if (keyMatch) return keyMatch;
  const eligible = active.filter(row =>
    (incoming.namespace ? (row.namespace === incoming.namespace && row.game_slug === incoming.game_slug || !row.namespace && row.game?.toLowerCase() === incoming.game?.toLowerCase()) && (!row.game_kind || !incoming.game_kind || row.game_kind === incoming.game_kind) :
      !row.namespace && (!incoming.universe_id || !row.universe_id || incoming.universe_id === row.universe_id)))
    .filter(row => compareArticleTopics(incoming.article_title, row.article_title, incoming.game ?? incoming.game_slug?.replaceAll("-", " ") ?? "").duplicate);
  return eligible[0] ?? null;
}
export const queueRowOrder = (a: ArticleQueueRow, b: ArticleQueueRow) =>
  String(a.notion_created_at ?? a.created_at).localeCompare(String(b.notion_created_at ?? b.created_at)) || a.id.localeCompare(b.id);
export const articleQueueFinished = (row: ArticleQueueRow) => ["completed", "published"].includes(row.status);
export const queueWinnerOrder = (a: ArticleQueueRow, b: ArticleQueueRow) =>
  Number(articleQueueFinished(b)) - Number(articleQueueFinished(a)) || queueRowOrder(a, b);

export const ARTICLE_QUEUE_CLAIM_TTL_MS = 6 * 3600_000;
export function articleQueueClaimExpired(row: ArticleQueueRow, now = Date.now()) {
  if (row.status === "blocked") return Boolean(row.next_attempt_at) && Date.parse(row.next_attempt_at) <= now;
  return row.status === "processing" && Date.parse(row.locked_at || row.created_at) < now - ARTICLE_QUEUE_CLAIM_TTL_MS;
}

export class NotionArticleQueue {
  constructor(readonly api: Pick<CodesQueue, "call" | "callCreate">, readonly source = ARTICLE_QUEUE_SOURCE, readonly database = ARTICLE_QUEUE_DATABASE,
    readonly config = ROBLOX_ARTICLE_QUEUE) {}
  async validate() {
    const { textFields, numberFields, dateFields, urlFields } = this.config;
    const schema = await this.api.call(`data_sources/${this.source}`);
    if (schema.parent?.database_id?.replaceAll("-", "") !== this.database.replaceAll("-", "")) throw new Error("Article Queue belongs to a different database.");
    const expected = { Title: "title", Status: "select", Type: "select",
      ...Object.fromEntries(Object.values(this.config.selectFields).map(name => [name, "select"])),
      ...Object.fromEntries(Object.values(textFields).map(name => [name, "rich_text"])),
      ...Object.fromEntries(Object.values(numberFields).map(name => [name, "number"])),
      ...Object.fromEntries(Object.values(dateFields).map(name => [name, "date"])),
      ...Object.fromEntries(Object.values(urlFields).map(name => [name, "url"])) };
    for (const [name, type] of Object.entries(expected)) if (schema.properties?.[name]?.type !== type) throw new Error(`Article Queue schema mismatch: ${name} must be ${type}.`);
    for (const status of this.config.statuses) if (!schema.properties.Status.select.options.some((option: any) => option.name === statusName(status))) throw new Error(`Article Queue is missing ${statusName(status)}.`);
    for (const name of this.config.types) if (!schema.properties.Type.select.options.some((option: any) => option.name === name)) throw new Error(`Article Queue is missing type ${name}.`);
  }
  private assertPage(page: any) {
    if (page.in_trash || page.parent?.data_source_id?.replaceAll("-", "") !== this.source.replaceAll("-", "")) throw new Error("Page is not an active Article Queue row.");
  }
  async list(filter?: unknown): Promise<ArticleQueueRow[]> {
    const rows: ArticleQueueRow[] = [];
    let cursor: string | undefined;
    do {
      const response = await this.api.call(`data_sources/${this.source}/query`, "POST", { page_size: 100, sorts: [{ timestamp: "created_time", direction: "ascending" }], ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) });
      for (const page of response.results) {
        this.assertPage(page);
        rows.push({ ...articleQueueFromPage(page, {}, this.config), notion_created_at: page.created_time });
      }
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
    return [...new Map(rows.map(row => [row.id, row])).values()].sort(queueRowOrder);
  }
  async get(id: string, withBody = true): Promise<ArticleQueueRow> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Article Queue ID must be a Notion page UUID.");
    const page = await this.api.call(`pages/${id}`);
    this.assertPage(page);
    const committed = plain(page.properties?.Snapshot?.rich_text) || null;
    const blocks = withBody ? await this.blocks(id) : [];
    const body = withBody ? articleQueueBodyData(blocks, committed, this.config) : {};
    return { ...articleQueueFromPage(page, body, this.config), ...(this.config.ownerRows ? { notes: queueBodyNotes(blocks, this.config) } : {}), notion_created_at: page.created_time };
  }
  private async blocks(id: string) {
    const blocks: any[] = [];
    let cursor: string | undefined;
    do {
      const result = await this.api.call(`blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""}`);
      for(const block of result.results) {
        blocks.push(block);
        if(this.config.ownerRows && block.has_children && !plain(block.code?.caption).startsWith(`${this.config.bodyMarker}/`))blocks.push(...await this.blocks(block.id));
      }
      cursor = result.has_more ? result.next_cursor : undefined;
    } while (cursor);
    return blocks;
  }
  async update(id: string, patch: Record<string, any>, expected?: Record<string, any>) {
    const config = this.config;
    const { textFields, numberFields, dateFields, urlFields, selectFields } = config;
    const current = await this.get(id);
    if (expected && Object.entries(expected).some(([key, value]) => current[key] !== value)) throw new Error("Article queue changed before update; inspect and rerun.");
    const propertyFields = new Set(["article_title", "article_type", "status", ...Object.keys(textFields), ...Object.keys(numberFields), ...Object.keys(dateFields), ...Object.keys(urlFields), ...Object.keys(selectFields), "updated_at"]);
    const bodyChanged = Object.keys(patch).some(field => !propertyFields.has(field));
    const generation = randomUUID();
    if (bodyChanged && !current.body_generation) {
      // A row without a committed pointer reads its newest complete snapshot. Pin the
      // current one first, so a snapshot appended below can't show if the update fails.
      const existing = articleQueueNewestGeneration(await this.blocks(id), config) ?? "empty";
      if (existing) {
        await this.api.call(`pages/${id}`, "PATCH", { properties: articleQueueProperties({ body_generation: existing }, config) });
        const pinned = await this.api.call(`pages/${id}`);
        if (plain(pinned.properties?.Snapshot?.rich_text) !== existing) throw new Error("Article Queue snapshot pointer did not save; inspect and rerun.");
      }
    }
    if (bodyChanged) {
      // Append the snapshot first. It only counts once the property write below names it.
      await this.api.call(`blocks/${id}/children`, "PATCH", { children: articleQueueBody({ ...current, ...patch }, generation, config) });
      patch = { ...patch, body_generation: generation };
    }
    await this.api.call(`pages/${id}`, "PATCH", { properties: articleQueueProperties(patch, config) });
    const saved = await this.get(id);
    for (const [key, value] of Object.entries(articleQueueProperties(patch, config))) {
      // Read the actual API representation through the same serializer.
      if (JSON.stringify(articleQueueProperties(saved, config)[key]) !== JSON.stringify(value)) throw new Error(`Article Queue update readback differs for ${key}.`);
    }
    if (bodyChanged) {
      const blocks = await this.blocks(id);
      const snapshots = blocks.filter(block => plain(block.code?.caption).startsWith(`${config.bodyMarker}/`));
      for (const block of snapshots) if (plain(block.code.caption).split("/")[1] !== generation) {
        await this.api.call(`blocks/${block.id}`, "PATCH", { in_trash: true });
      }
    }
    return saved;
  }
  async create(row: Record<string, any>) {
    const payload = { workflow_mode: "agent_runner", ...row,
      idempotency_key: "idempotency_key" in row ? row.idempotency_key : articleQueueIdempotencyKey(String(row.article_title ?? ""), row.universe_id ?? null) };
    const generation = randomUUID();
    const page = await this.api.callCreate({ parent: { type: "data_source_id", data_source_id: this.source }, properties: articleQueueProperties({ ...payload, body_generation: generation }, this.config), children: articleQueueBody(payload, generation, this.config) });
    // Never retry an uncertain create. A subsequent invocation re-queries first.
    return this.get(page.id);
  }
  async reconcileDuplicates(rows: ArticleQueueRow[], now = Date.now()) {
    // Build whole duplicate groups before writing. A later finished row may
    // supersede an older pending row, or reveal conflicting finished work.
    const groups: ArticleQueueRow[][] = [];
    for (const row of [...rows].sort(queueRowOrder)) {
      if (!ARTICLE_TOPIC_DEDUPE_STATUSES.includes(row.status)) continue;
      const matches = groups.filter(group => group.some(candidate => duplicateQueueRow([candidate], row)));
      const group = [row, ...matches.flat()];
      for (const match of matches) groups.splice(groups.indexOf(match), 1);
      groups.push(group);
    }
    let skipped = 0;
    for (const group of groups) {
      const finished = group.filter(articleQueueFinished).sort(queueRowOrder);
      if (finished.length > 1 && finished.some(row => !row.result_path || !row.result_slug || row.result_path !== finished[0].result_path || row.result_slug !== finished[0].result_slug)) {
        console.error(`Article queue has conflicting finished duplicates: ${finished.map(row => row.id).join(", ")}. No rows in this group changed; inspect the results manually.`);
        continue;
      }
      const active = group.filter(row => row.status === "processing" && !articleQueueClaimExpired(row, now)).sort(queueRowOrder);
      const winners = [...finished, ...active, ...group.filter(row => row.status === "rejected")];
      for (const row of group.sort(queueRowOrder)) {
        if (winners.some(winner => winner.id === row.id)) continue;
        // Similarity is not transitive. Keep a row unless a retained row
        // directly matches it, even if both belong to one duplicate group.
        if (!duplicateQueueRow(winners, row)) { winners.push(row); continue; }
        const saved = await this.update(row.id, { status: "skipped", outcome_reason: "duplicate", locked_at: null, locked_by: null },
          { status: row.status, updated_at: row.updated_at, result_path: row.result_path, result_slug: row.result_slug });
        Object.assign(row, saved);
        skipped++;
      }
    }
    return skipped;
  }
  async recoverClaims(rows: ArticleQueueRow[], now = Date.now()) {
    let recovered = 0;
    for (const row of rows.filter(item => articleQueueClaimExpired(item, now))) {
      const current = await this.get(row.id);
      if (current.workflow_mode !== "agent_runner" || !articleQueueClaimExpired(current, now)) continue;
      const saved = await this.update(current.id, { status: "pending", locked_at: null, locked_by: null, next_attempt_at: null },
        { status: current.status, locked_at: current.locked_at, locked_by: current.locked_by, updated_at: current.updated_at });
      Object.assign(row, saved);
      recovered++;
    }
    return recovered;
  }
  async put(row: Record<string, any>): Promise<{ row: ArticleQueueRow; created: boolean }> {
    const payload = { ...row, idempotency_key: row.idempotency_key ?? articleQueueIdempotencyKey(row.article_title, row.universe_id ?? null) };
    const before = await this.list();
    await this.reconcileDuplicates(before);
    const existing = duplicateQueueRow(before.sort(queueWinnerOrder), payload);
    if (existing) return { row: await this.get(existing.id), created: false };
    const created = await this.create(payload);
    const all = await this.list();
    await this.reconcileDuplicates(all);
    const matches = all.filter(candidate => duplicateQueueRow([candidate], payload));
    const winner = matches.sort(queueWinnerOrder)[0] ?? created;
    return { row: await this.get(winner.id), created: winner.id === created.id };
  }
}

export function createNotionArticleQueue(options: { envFile?: string | null; config?: ArticleQueueConfig } = {}) {
  const config = options.config ?? ROBLOX_ARTICLE_QUEUE;
  // Keep --dev-env-file as a deprecated file flag without using database creds.
  const configured = options.envFile ? parseDotenv(readFileSync(options.envFile, "utf8")) : {};
  const token = configured.NOTION_ARTICLE_QUEUE_TOKEN || process.env.NOTION_ARTICLE_QUEUE_TOKEN;
  if (!token?.trim()) throw new Error("NOTION_ARTICLE_QUEUE_TOKEN is required. Load BLOXODES_ENV_OVERLAYS=articles.");
  return new NotionArticleQueue(new CodesQueue(makeRequest(AbortSignal.timeout(20 * 60_000)), token.trim(),
    (config === ROBLOX_ARTICLE_QUEUE && process.env.NOTION_ARTICLE_QUEUE_DATA_SOURCE_ID) || config.source,
    (config === ROBLOX_ARTICLE_QUEUE && process.env.NOTION_ARTICLE_QUEUE_DATABASE_ID) || config.database),
    (config === ROBLOX_ARTICLE_QUEUE && process.env.NOTION_ARTICLE_QUEUE_DATA_SOURCE_ID) || config.source,
    (config === ROBLOX_ARTICLE_QUEUE && process.env.NOTION_ARTICLE_QUEUE_DATABASE_ID) || config.database, config);
}

export function createNotionGameArticleQueue(options: { envFile?: string | null } = {}) {
  return createNotionArticleQueue({ ...options, config: GAME_ARTICLE_QUEUE });
}

export function queueBodyNotes(blocks: any[], config = GAME_ARTICLE_QUEUE): string {
  return blocks.filter(block => !plain(block.code?.caption).startsWith(`${config.bodyMarker}/`))
    .map(block => plain(block[block.type]?.rich_text ?? (block.child_page?.title ? [{ text: { content: block.child_page.title } }] : [])))
    .filter(Boolean).join("\n");
}
