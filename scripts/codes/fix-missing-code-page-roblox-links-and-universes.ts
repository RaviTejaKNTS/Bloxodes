import "../shared/load-env";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readBloxodesEnvFile } from "../shared/env-files";
import { JSDOM } from "jsdom";

import { extractPlaceId, scrapeRobloxGameMetadata } from "@/lib/roblox/game-metadata";
import { ensureUniverseForRobloxLink } from "@/lib/roblox/universe";
import {
  scrapeSocialLinksFromSources,
  type SocialLinks as ScrapedSocialLinks
} from "@/lib/social-links";

type CodePageRow = {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
  roblox_link: string | null;
  community_link: string | null;
  discord_link: string | null;
  youtube_link: string | null;
  universe_id: number | null;
  intro_md: string | null;
};

type LinkColumn = "roblox_link" | "community_link" | "discord_link" | "youtube_link";

type LinkInfo = {
  url: string;
  source: string;
};

type RepairLinks = Partial<Record<LinkColumn, LinkInfo>>;

type CliOptions = {
  apply: boolean;
  concurrency: number;
  limit: number;
  overwrite: boolean;
  prod: boolean;
  publishedOnly: boolean;
  slug: string | null;
};

type RepairStats = {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  fields: Record<LinkColumn | "universe_id", number>;
};

type UpdatePayload = Partial<Record<LinkColumn | "universe_id", string | number>>;

const DEFAULT_CONCURRENCY = 8;
const PAGE_SIZE = 1000;
const LINK_COLUMNS: LinkColumn[] = ["roblox_link", "community_link", "discord_link", "youtube_link"];
const GENERIC_LINK_COLUMNS: LinkColumn[] = ["roblox_link", "community_link"];
const FIELD_LABELS: Record<LinkColumn | "universe_id", string> = {
  roblox_link: "Roblox link",
  community_link: "community link",
  discord_link: "Discord link",
  youtube_link: "YouTube link",
  universe_id: "universe ID"
};

const RUNS_WITH_PROD_ENV = process.argv.slice(2).includes("--prod");

function loadProdEnvIfRequested() {
  if (!RUNS_WITH_PROD_ENV) return;

  const values = readBloxodesEnvFile("targets/production.env");
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

loadProdEnvIfRequested();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
  { auth: { persistSession: false } }
);

const ROBLOX_USER_AGENT =
  process.env.ROBLOX_SCRAPER_UA ??
  "BloxodesGameLinkRepair/1.0 (+https://bloxodes.com; contact@bloxodes.com)";

function printUsage() {
  console.log(`Usage: npm run fix:code-page-links -- [options]

Repairs code pages that have intro_md but are missing both roblox_link and universe_id.
Community, Discord, and YouTube links are filled only for those same targeted rows.
Twitter/X is intentionally ignored and never updated by this script.

Options:
  --apply                  Write changes to Supabase. Defaults to dry run.
  --slug <slug>            Process one game.
  --limit <count>          Max matching code pages to process. Defaults to all matches.
  --concurrency <count>    Number of code pages to process at once. Defaults to ${DEFAULT_CONCURRENCY}.
  --prod                   Use the explicit production target instead of local development.
  --published-only         Only process published code pages.
  --overwrite              Replace existing non-empty links/IDs when a new value is found.
  -h, --help               Show this help message.
`);
}

function requireValue(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number.`);
  }
  return Math.floor(parsed);
}

function parseConcurrency(value: string): number {
  return Math.min(24, parsePositiveInteger(value, "--concurrency"));
}

function readFlagValue(args: string[], index: number, flag: string): { value: string; consumed: number } {
  const arg = args[index] ?? "";
  const prefix = `${flag}=`;
  if (arg.startsWith(prefix)) {
    return { value: arg.slice(prefix.length), consumed: 0 };
  }
  return { value: requireValue(args[index + 1], flag), consumed: 1 };
}

function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    concurrency: DEFAULT_CONCURRENCY,
    limit: Number.POSITIVE_INFINITY,
    overwrite: false,
    prod: RUNS_WITH_PROD_ENV,
    publishedOnly: false,
    slug: null
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? "";
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.apply = false;
      continue;
    }
    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (arg === "--prod") {
      options.prod = true;
      continue;
    }
    if (arg === "--published-only") {
      options.publishedOnly = true;
      continue;
    }
    if (arg === "--slug" || arg.startsWith("--slug=")) {
      const { value, consumed } = readFlagValue(args, i, "--slug");
      options.slug = value.trim() || null;
      i += consumed;
      continue;
    }
    if (arg === "--limit" || arg.startsWith("--limit=")) {
      const { value, consumed } = readFlagValue(args, i, "--limit");
      options.limit = parsePositiveInteger(value, "--limit");
      i += consumed;
      continue;
    }
    if (arg === "--concurrency" || arg.startsWith("--concurrency=")) {
      const { value, consumed } = readFlagValue(args, i, "--concurrency");
      options.concurrency = parseConcurrency(value);
      i += consumed;
      continue;
    }
    throw new Error(`Unknown flag: ${arg}`);
  }

  return options;
}

function normalizeExternalLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const resolved = new URL(trimmed);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

function splitSourceUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((url) => normalizeExternalLink(url))
    .filter((url): url is string => Boolean(url));
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

function collectSourceUrls(game: CodePageRow): string[] {
  return uniqueUrls([
    ...splitSourceUrls(game.source_url),
    ...splitSourceUrls(game.source_url_2),
    ...splitSourceUrls(game.source_url_3)
  ]);
}

function toLinkInfo(value: string | null | undefined, source: string): LinkInfo | undefined {
  const url = normalizeExternalLink(value);
  return url ? { url, source } : undefined;
}

function convertScrapedSocialLinks(links: ScrapedSocialLinks): RepairLinks {
  return {
    roblox_link: toLinkInfo(links.roblox, "provider scrape"),
    community_link: toLinkInfo(links.community, "provider scrape"),
    discord_link: toLinkInfo(links.discord, "provider scrape"),
    youtube_link: toLinkInfo(links.youtube, "provider scrape")
  };
}

function classifyKnownLink(rawUrl: string): LinkColumn | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const pathname = url.pathname.toLowerCase();

    if (host.endsWith("roblox.com")) {
      if (
        /^\/(games|game|game-details|experiences)(\/|$)/.test(pathname) ||
        url.searchParams.has("placeId") ||
        url.searchParams.has("universeId")
      ) {
        return "roblox_link";
      }
      if (/^\/(communities|groups|users)(\/|$)/.test(pathname)) {
        return "community_link";
      }
      return null;
    }

    if (host === "discord.gg" || host.endsWith("discord.com")) return "discord_link";
    if (host.endsWith("youtube.com") || host === "youtu.be" || host === "m.youtube.com") return "youtube_link";
    return null;
  } catch {
    return null;
  }
}

function normalizeHref(href: string | null | undefined, baseUrl: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeDiscoveredUrl(raw: string): string | null {
  const cleaned = raw
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/[)"'<>\\]+$/g, "")
    .trim();
  if (!cleaned) return null;
  const withProtocol = /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned.replace(/^\/\//, "")}`;
  return normalizeExternalLink(withProtocol);
}

function collectKnownLinksFromText(html: string): RepairLinks {
  const found: RepairLinks = {};
  const patterns = [
    /(?:https?:\\?\/\\?\/)?(?:www\.)?roblox\.com\\?\/(?:games|game|game-details|experiences)\\?\/[0-9][^"'<> )\\]{}]*/gi,
    /(?:https?:\\?\/\\?\/)?(?:www\.)?roblox\.com\\?\/(?:communities|groups|users)\\?\/[0-9][^"'<> )\\]{}]*/gi
  ];

  for (const pattern of patterns) {
    const matches = html.match(pattern) ?? [];
    for (const match of matches) {
      const normalized = normalizeDiscoveredUrl(match);
      if (!normalized) continue;
      const type = classifyKnownLink(normalized);
      if (!type || found[type]) continue;
      found[type] = { url: normalized, source: "generic page text scrape" };
    }
  }

  return found;
}

async function scrapeGenericLinksFromSources(urls: string[], slug: string): Promise<RepairLinks> {
  const found: RepairLinks = {};
  for (const sourceUrl of urls) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BloxodesGameLinkRepair/1.0)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      if (!response.ok) continue;

      const html = await response.text();
      Object.assign(found, {
        ...collectKnownLinksFromText(html),
        ...found
      });

      const dom = new JSDOM(html, { url: sourceUrl });
      const anchors = Array.from(dom.window.document.querySelectorAll<HTMLAnchorElement>("a[href]"));

      for (const anchor of anchors) {
        const resolved = normalizeHref(anchor.getAttribute("href"), sourceUrl);
        if (!resolved) continue;
        const type = classifyKnownLink(resolved);
        if (!type || !GENERIC_LINK_COLUMNS.includes(type) || found[type]) continue;
        found[type] = { url: resolved, source: "generic anchor scrape" };
      }

      if (GENERIC_LINK_COLUMNS.every((column) => found[column])) {
        break;
      }
    } catch (error) {
      console.warn(`  ⚠️ Generic link scrape failed for ${slug}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return found;
}

function mergeMissingLinks(primary: RepairLinks, fallback: RepairLinks): RepairLinks {
  const merged: RepairLinks = { ...primary };
  for (const column of LINK_COLUMNS) {
    if (!merged[column] && fallback[column]) {
      merged[column] = fallback[column];
    }
  }
  return merged;
}

async function collectSocialLinksFromExistingSources(game: CodePageRow): Promise<RepairLinks> {
  const sources = collectSourceUrls(game);
  if (!sources.length) return {};

  const providerResult = await scrapeSocialLinksFromSources(sources);
  for (const errorMessage of providerResult.errors) {
    console.warn(`  ⚠️ Social scrape error for ${game.slug}: ${errorMessage}`);
  }

  const providerLinks = convertScrapedSocialLinks(providerResult.links);
  const genericLinks = await scrapeGenericLinksFromSources(sources, game.slug);
  return mergeMissingLinks(providerLinks, genericLinks);
}

async function collectRobloxCommunityLink(robloxLink: string | null): Promise<LinkInfo | undefined> {
  if (!robloxLink) return undefined;
  try {
    const metadata = await scrapeRobloxGameMetadata(robloxLink);
    return toLinkInfo(metadata.communityLink, "Roblox game metadata");
  } catch (error) {
    console.warn(`  ⚠️ Failed to scrape Roblox metadata: ${error instanceof Error ? error.message : error}`);
    return undefined;
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": ROBLOX_USER_AGENT,
        accept: "application/json"
      }
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function resolveUniverseIdReadOnly(robloxLink: string): Promise<number | null> {
  let placeId = extractPlaceId(robloxLink);
  let scrapedUniverseId: number | null = null;

  if (!placeId) {
    try {
      const metadata = await scrapeRobloxGameMetadata(robloxLink);
      placeId = metadata.placeId;
      scrapedUniverseId = numberValue(metadata.universeId);
    } catch {
      // The place-detail API below may still work if the URL contains placeId.
    }
  }

  if (placeId) {
    const placeDetails = await fetchJson<Array<{ universeId?: number | string | null }>>(
      `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`
    );
    const universeId = numberValue(placeDetails?.[0]?.universeId);
    if (universeId) return universeId;
  }

  if (scrapedUniverseId) return scrapedUniverseId;

  try {
    const metadata = await scrapeRobloxGameMetadata(robloxLink);
    return numberValue(metadata.universeId);
  } catch {
    return null;
  }
}

async function ensureUniverseId(
  client: SupabaseClient,
  game: CodePageRow,
  robloxLink: string | null,
  options: CliOptions
): Promise<number | null> {
  if (!robloxLink) return null;
  if (game.universe_id && !options.overwrite) return null;

  try {
    if (!options.apply) {
      return await resolveUniverseIdReadOnly(robloxLink);
    }
    const ensured = await ensureUniverseForRobloxLink(client, robloxLink);
    return ensured.universeId;
  } catch (error) {
    console.warn(`  ⚠️ Failed to ensure Roblox universe: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function shouldSetLink(game: CodePageRow, column: LinkColumn, options: CliOptions): boolean {
  return options.overwrite || !game[column];
}

async function buildUpdatePayload(
  game: CodePageRow,
  discovered: RepairLinks,
  options: CliOptions
): Promise<{ payload: UpdatePayload; reasons: string[] }> {
  const payload: UpdatePayload = {};
  const reasons: string[] = [];
  const discoveredRobloxLink = discovered.roblox_link?.url ?? null;
  const robloxLink = discoveredRobloxLink ?? game.roblox_link ?? null;

  for (const column of LINK_COLUMNS) {
    const link = discovered[column];
    if (!link?.url) continue;
    if (!shouldSetLink(game, column, options)) continue;
    payload[column] = link.url;
    reasons.push(`${FIELD_LABELS[column]} from ${link.source}`);
  }

  if (!payload.community_link && shouldSetLink(game, "community_link", options)) {
    const communityFromRoblox = await collectRobloxCommunityLink(robloxLink);
    if (communityFromRoblox?.url) {
      payload.community_link = communityFromRoblox.url;
      reasons.push(`${FIELD_LABELS.community_link} from ${communityFromRoblox.source}`);
    }
  }

  const universeId = await ensureUniverseId(supabase, game, robloxLink, options);
  if (universeId && (options.overwrite || !game.universe_id)) {
    payload.universe_id = universeId;
    reasons.push(`${FIELD_LABELS.universe_id} from Roblox APIs`);
  }

  return { payload, reasons };
}

async function loadCodePages(options: CliOptions): Promise<CodePageRow[]> {
  const selectFields =
    "id, name, slug, is_published, source_url, source_url_2, source_url_3, roblox_link, community_link, discord_link, youtube_link, universe_id, intro_md";

  if (options.slug) {
    const { data, error } = await supabase
      .from("code_pages")
      .select(selectFields)
      .eq("slug", options.slug)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`Failed to load code page: ${error.message}`);
    return (data ?? []) as CodePageRow[];
  }

  const rows: CodePageRow[] = [];
  let offset = 0;

  while (rows.length < options.limit) {
    const remaining = options.limit - rows.length;
    const pageSize = Math.min(PAGE_SIZE, remaining);
    let query = supabase
      .from("code_pages")
      .select(selectFields)
      .not("intro_md", "is", null)
      .neq("intro_md", "")
      .is("roblox_link", null)
      .is("universe_id", null)
      .order("updated_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (options.publishedOnly) {
      query = query.eq("is_published", true);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load code pages: ${error.message}`);

    const page = (data ?? []) as CodePageRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function processCodePage(game: CodePageRow, options: CliOptions, stats: RepairStats): Promise<void> {
  stats.processed += 1;
  console.log(`\n🔎 ${stats.processed}. ${game.name} (${game.slug})`);

  const sources = collectSourceUrls(game);
  if (!sources.length && !game.roblox_link) {
    stats.skipped += 1;
    console.log("  skipped: no source URLs or existing Roblox link");
    return;
  }

  const discovered = await collectSocialLinksFromExistingSources(game);
  const { payload, reasons } = await buildUpdatePayload(game, discovered, options);
  const payloadEntries = Object.entries(payload) as Array<[LinkColumn | "universe_id", string | number]>;

  if (!payloadEntries.length) {
    stats.skipped += 1;
    console.log("  skipped: no missing fields could be repaired");
    return;
  }

  for (const [field, value] of payloadEntries) {
    console.log(`  ${options.apply ? "update" : "would update"} ${field}: ${value}`);
    stats.fields[field] += 1;
  }
  for (const reason of reasons) {
    console.log(`  source: ${reason}`);
  }

  if (options.apply) {
    const { error } = await supabase.from("code_pages").update(payload).eq("id", game.id);
    if (error) throw new Error(`Failed to update ${game.slug}: ${error.message}`);
  }

  stats.updated += 1;
}

async function promisePool<T>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      if (!item) continue;
      await handler(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const codePages = await loadCodePages(options);

  if (!codePages.length) {
    console.log(options.slug ? `No code page found for slug "${options.slug}".` : "No matching code pages found.");
    return;
  }

  console.log(
    `${options.apply ? "Applying" : "Dry run for"} ${codePages.length} code page${codePages.length === 1 ? "" : "s"} against ${
      options.prod ? ".envs/targets/production.env" : "managed-development environment"
    }${
      options.overwrite ? " with overwrite enabled" : ""
    } with concurrency ${options.concurrency}. Target: intro_md present, roblox_link missing, universe_id missing. Twitter/X links are ignored.`
  );

  const stats: RepairStats = {
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    fields: {
      roblox_link: 0,
      community_link: 0,
      discord_link: 0,
      youtube_link: 0,
      universe_id: 0
    }
  };

  await promisePool(codePages, options.concurrency, async (game) => {
    try {
      await processCodePage(game, options, stats);
    } catch (error) {
      stats.failed += 1;
      console.error(`  ❌ Failed ${game.slug}: ${error instanceof Error ? error.message : error}`);
    }
  });

  console.log("\nDone.");
  console.log(JSON.stringify(stats, null, 2));
  if (!options.apply) {
    console.log("Dry run only. Re-run with --apply to write these changes.");
  }
}

main().catch((error) => {
  console.error("❌ Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
