import "../shared/load-env";

import { createSign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_SITE_URL = "https://bloxodes.com";
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/indexing";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_INDEXING_PUBLISH_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";

type NotificationType = "URL_UPDATED" | "URL_DELETED";

type CliOptions = {
  apply: boolean;
  dryRun: boolean;
  force: boolean;
  help: boolean;
  files: string[];
  urls: string[];
  sitemapUrl: string | null;
  maxUrls: number | null;
  notificationType: NotificationType | null;
};

type GoogleIndexingConfig = {
  siteOrigin: string;
  host: string;
  sitemapUrl: string | null;
  notificationType: NotificationType;
  enabled: boolean;
  apply: boolean;
  dryRun: boolean;
  force: boolean;
  dailyLimit: number;
  maxUrls: number;
  maxSitemaps: number;
  requestDelayMs: number;
  resubmitAfterHours: number;
  stateBackend: "auto" | "file" | "supabase";
  stateFile: string;
  serviceAccountScope: string;
};

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type UrlState = {
  url: string;
  notification_type: NotificationType;
  last_submitted_at: string | null;
  last_status_code: number | null;
  last_error: string | null;
  attempt_count: number | null;
  success_count: number | null;
};

type AttemptResult = {
  url: string;
  notificationType: NotificationType;
  statusCode: number | null;
  responseStatus: string | null;
  errorMessage: string | null;
  success: boolean;
  submittedAt: string;
};

type FileState = {
  daily: Record<string, number>;
  urls: Record<string, UrlState>;
};

type StateStore = {
  backend: "file" | "supabase";
  countSubmittedToday(notificationType: NotificationType): Promise<number>;
  getUrlStates(urls: string[], notificationType: NotificationType): Promise<Map<string, UrlState>>;
  recordAttempt(result: AttemptResult, previous?: UrlState): Promise<void>;
};

function loadIndexingEnv() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const candidates = [
    `.env.indexing.${nodeEnv}.local`,
    ".env.indexing.local",
    ".env.indexing"
  ];

  for (const relativePath of candidates) {
    const envPath = path.join(REPO_ROOT, relativePath);
    if (!fs.existsSync(envPath)) continue;
    loadDotenv({ path: envPath, override: false, quiet: true });
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function clampNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function parseNotificationType(value: string | undefined | null): NotificationType | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "UPDATED" || normalized === "UPDATE" || normalized === "URL_UPDATED") return "URL_UPDATED";
  if (normalized === "DELETED" || normalized === "DELETE" || normalized === "URL_DELETED") return "URL_DELETED";
  throw new Error(`Invalid Google indexing notification type: ${value}`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    dryRun: false,
    force: false,
    help: false,
    files: [],
    urls: [],
    sitemapUrl: null,
    maxUrls: null,
    notificationType: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    const readValue = (name: string) => {
      const next = argv[index + 1];
      if (!next) throw new Error(`Missing value for ${name}`);
      index += 1;
      return next;
    };

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--url") {
      options.urls.push(readValue("--url"));
    } else if (arg.startsWith("--url=")) {
      options.urls.push(arg.slice("--url=".length));
    } else if (arg === "--file") {
      options.files.push(readValue("--file"));
    } else if (arg.startsWith("--file=")) {
      options.files.push(arg.slice("--file=".length));
    } else if (arg === "--sitemap") {
      options.sitemapUrl = readValue("--sitemap");
    } else if (arg.startsWith("--sitemap=")) {
      options.sitemapUrl = arg.slice("--sitemap=".length);
    } else if (arg === "--max-urls" || arg === "--limit") {
      options.maxUrls = Number(readValue(arg));
    } else if (arg.startsWith("--max-urls=")) {
      options.maxUrls = Number(arg.slice("--max-urls=".length));
    } else if (arg.startsWith("--limit=")) {
      options.maxUrls = Number(arg.slice("--limit=".length));
    } else if (arg === "--type") {
      options.notificationType = parseNotificationType(readValue("--type"));
    } else if (arg.startsWith("--type=")) {
      options.notificationType = parseNotificationType(arg.slice("--type=".length));
    } else if (arg === "--updated") {
      options.notificationType = "URL_UPDATED";
    } else if (arg === "--deleted") {
      options.notificationType = "URL_DELETED";
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.maxUrls !== null && (!Number.isFinite(options.maxUrls) || options.maxUrls < 1)) {
    throw new Error("--max-urls must be a positive number.");
  }

  return options;
}

function printHelp() {
  console.log(`
Google Indexing API submitter

Usage:
  npm run indexing:google -- [--apply] [--sitemap <url>] [--max-urls <n>]
  npm run indexing:google -- --dry-run --url https://bloxodes.com/codes/example
  npm run indexing:google -- --apply --deleted --file deleted-urls.txt

Safety:
  --apply is required to call Google.
  GOOGLE_INDEXING_API_ENABLED=true is also required before --apply submits.
  Without --apply, the script only discovers and prints the candidate batch.
`);
}

function normalizeOrigin(raw: string): string {
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Invalid site URL protocol: ${parsed.protocol}`);
  }
  return `${parsed.protocol}//${parsed.host}`;
}

function normalizeAbsoluteUrl(raw: string, base: string): string {
  const parsed = new URL(raw, base);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  parsed.hash = "";
  return parsed.toString();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function extractLocValues(xml: string): string[] {
  const values: string[] = [];
  const regex = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  for (const match of xml.matchAll(regex)) {
    const value = decodeXmlEntities(match[1] ?? "");
    if (value) values.push(value);
  }
  return values;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function resolveConfig(cli: CliOptions): GoogleIndexingConfig {
  const siteOrigin = normalizeOrigin(
    process.env.GOOGLE_INDEXING_SITE_URL?.trim() ||
      process.env.SITE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      DEFAULT_SITE_URL
  );
  const host = new URL(siteOrigin).host;
  const notificationType =
    cli.notificationType ??
    parseNotificationType(process.env.GOOGLE_INDEXING_NOTIFICATION_TYPE) ??
    "URL_UPDATED";
  const envSitemap = process.env.GOOGLE_INDEXING_SITEMAP_URL?.trim();
  const sitemapUrl =
    cli.sitemapUrl === null && notificationType === "URL_DELETED"
      ? null
      : normalizeAbsoluteUrl(cli.sitemapUrl ?? envSitemap ?? `${siteOrigin}/sitemap.xml`, siteOrigin);
  const dailyLimit = clampNumber(process.env.GOOGLE_INDEXING_DAILY_LIMIT, 50, 1, 200);
  const maxUrls = Math.min(
    cli.maxUrls ?? clampNumber(process.env.GOOGLE_INDEXING_BATCH_LIMIT, 10, 1, 200),
    dailyLimit
  );
  const stateBackend = (process.env.GOOGLE_INDEXING_STATE_BACKEND || "auto").trim().toLowerCase();

  if (!["auto", "file", "supabase"].includes(stateBackend)) {
    throw new Error("GOOGLE_INDEXING_STATE_BACKEND must be auto, file, or supabase.");
  }

  return {
    siteOrigin,
    host,
    sitemapUrl,
    notificationType,
    enabled: parseBoolean(process.env.GOOGLE_INDEXING_API_ENABLED, false),
    apply: cli.apply,
    dryRun: cli.dryRun || !cli.apply,
    force: cli.force,
    dailyLimit,
    maxUrls,
    maxSitemaps: clampNumber(process.env.GOOGLE_INDEXING_MAX_SITEMAPS, 200, 1, 10_000),
    requestDelayMs: clampNumber(process.env.GOOGLE_INDEXING_REQUEST_DELAY_MS, 1000, 0, 60_000),
    resubmitAfterHours: clampNumber(process.env.GOOGLE_INDEXING_RESUBMIT_AFTER_HOURS, 168, 0, 8760),
    stateBackend: stateBackend as GoogleIndexingConfig["stateBackend"],
    stateFile: path.resolve(REPO_ROOT, process.env.GOOGLE_INDEXING_STATE_FILE || "tmp/google-indexing-state.json"),
    serviceAccountScope: process.env.GOOGLE_INDEXING_SCOPE?.trim() || DEFAULT_SCOPE
  };
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { accept: "application/xml,text/xml,*/*" }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch sitemap ${url}: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  return res.text();
}

async function collectUrlsFromSitemaps(config: GoogleIndexingConfig): Promise<{ urls: string[]; sitemapCount: number }> {
  if (!config.sitemapUrl) return { urls: [], sitemapCount: 0 };

  const queue: string[] = [config.sitemapUrl];
  const seenSitemaps = new Set<string>();
  const pageUrls = new Set<string>();

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;

    const currentUrl = normalizeAbsoluteUrl(current, config.siteOrigin);
    if (seenSitemaps.has(currentUrl)) continue;
    if (seenSitemaps.size >= config.maxSitemaps) {
      throw new Error(`Sitemap crawl exceeded GOOGLE_INDEXING_MAX_SITEMAPS=${config.maxSitemaps}.`);
    }
    seenSitemaps.add(currentUrl);

    console.log(`Sitemap ${seenSitemaps.size}: ${currentUrl}`);
    const xml = await fetchXml(currentUrl);
    const locValues = extractLocValues(xml);
    if (!locValues.length) continue;

    const isSitemapIndex = /<\s*sitemapindex\b/i.test(xml);
    const isUrlSet = /<\s*urlset\b/i.test(xml);

    if (isSitemapIndex) {
      for (const loc of locValues) {
        let nested: string;
        try {
          nested = normalizeAbsoluteUrl(loc, currentUrl);
        } catch {
          continue;
        }
        if (new URL(nested).host !== config.host) {
          console.warn(`Skipping cross-host sitemap: ${nested}`);
          continue;
        }
        if (!seenSitemaps.has(nested)) queue.push(nested);
      }
      continue;
    }

    if (isUrlSet) {
      for (const loc of locValues) {
        let pageUrl: string;
        try {
          pageUrl = normalizeAbsoluteUrl(loc, currentUrl);
        } catch {
          continue;
        }
        if (new URL(pageUrl).host !== config.host) {
          console.warn(`Skipping cross-host page URL: ${pageUrl}`);
          continue;
        }
        pageUrls.add(pageUrl);
      }
      continue;
    }

    console.warn(`Unknown sitemap format at ${currentUrl}; skipping.`);
  }

  return { urls: Array.from(pageUrls), sitemapCount: seenSitemaps.size };
}

function collectUrlsFromFiles(files: string[], siteOrigin: string, host: string): string[] {
  const urls: string[] = [];
  for (const file of files) {
    const filePath = path.resolve(process.cwd(), file);
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const normalized = normalizeAbsoluteUrl(trimmed, siteOrigin);
      if (new URL(normalized).host !== host) {
        console.warn(`Skipping cross-host URL from file: ${normalized}`);
        continue;
      }
      urls.push(normalized);
    }
  }
  return urls;
}

async function collectCandidateUrls(config: GoogleIndexingConfig, cli: CliOptions): Promise<string[]> {
  const urls = new Set<string>();

  for (const rawUrl of cli.urls) {
    const normalized = normalizeAbsoluteUrl(rawUrl, config.siteOrigin);
    if (new URL(normalized).host !== config.host) {
      console.warn(`Skipping cross-host CLI URL: ${normalized}`);
      continue;
    }
    urls.add(normalized);
  }

  for (const fileUrl of collectUrlsFromFiles(cli.files, config.siteOrigin, config.host)) {
    urls.add(fileUrl);
  }

  const shouldUseSitemap =
    config.notificationType === "URL_UPDATED" &&
    (cli.sitemapUrl !== null || (cli.urls.length === 0 && cli.files.length === 0));
  if (shouldUseSitemap) {
    const { urls: sitemapUrls, sitemapCount } = await collectUrlsFromSitemaps(config);
    console.log(`Discovered ${sitemapUrls.length} URLs from ${sitemapCount} sitemap files.`);
    for (const sitemapUrl of sitemapUrls) urls.add(sitemapUrl);
  }

  if (config.notificationType === "URL_DELETED" && urls.size === 0) {
    throw new Error("URL_DELETED runs require --url or --file. Deleted URLs should not be read from the live sitemap.");
  }

  return Array.from(urls).sort();
}

function readServiceAccountKey(): ServiceAccountKey {
  const rawJson = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON?.trim();
  const rawBase64 = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const rawFile = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_FILE?.trim();

  let payload: string | null = null;
  if (rawJson) {
    payload = rawJson;
  } else if (rawBase64) {
    payload = Buffer.from(rawBase64, "base64").toString("utf8");
  } else if (rawFile) {
    const keyPath = path.isAbsolute(rawFile) ? rawFile : path.join(REPO_ROOT, rawFile);
    payload = fs.readFileSync(keyPath, "utf8");
  }

  if (!payload) {
    throw new Error(
      "Missing Google Indexing service account credentials. Set GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON_BASE64, GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON, or GOOGLE_INDEXING_SERVICE_ACCOUNT_FILE."
    );
  }

  const parsed = JSON.parse(payload) as Partial<ServiceAccountKey>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Google Indexing service account credentials must include client_email and private_key.");
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    token_uri: parsed.token_uri
  };
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function getAccessToken(key: ServiceAccountKey, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: key.client_email,
    scope,
    aud: key.token_uri || GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now
  };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claim)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(key.private_key, "base64url")}`;

  const res = await fetch(key.token_uri || GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const body = (await res.json().catch(async () => ({ raw: await res.text() }))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !body.access_token) {
    throw new Error(`Google token request failed: ${res.status} ${body.error ?? ""} ${body.error_description ?? ""}`.trim());
  }

  return body.access_token;
}

function stateKey(url: string, notificationType: NotificationType): string {
  return `${notificationType} ${url}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readFileState(stateFile: string): FileState {
  if (!fs.existsSync(stateFile)) return { daily: {}, urls: {} };
  return JSON.parse(fs.readFileSync(stateFile, "utf8")) as FileState;
}

function writeFileState(stateFile: string, state: FileState) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

function createFileStateStore(stateFile: string): StateStore {
  return {
    backend: "file",
    async countSubmittedToday() {
      const state = readFileState(stateFile);
      return Number(state.daily[todayKey()] ?? 0);
    },
    async getUrlStates(urls, notificationType) {
      const state = readFileState(stateFile);
      const result = new Map<string, UrlState>();
      for (const url of urls) {
        const entry = state.urls[stateKey(url, notificationType)];
        if (entry) result.set(url, entry);
      }
      return result;
    },
    async recordAttempt(result, previous) {
      const state = readFileState(stateFile);
      const key = stateKey(result.url, result.notificationType);
      const current = previous ?? state.urls[key];
      state.daily[todayKey()] = Number(state.daily[todayKey()] ?? 0) + 1;
      state.urls[key] = {
        url: result.url,
        notification_type: result.notificationType,
        last_submitted_at: result.submittedAt,
        last_status_code: result.statusCode,
        last_error: result.errorMessage,
        attempt_count: Number(current?.attempt_count ?? 0) + 1,
        success_count: Number(current?.success_count ?? 0) + (result.success ? 1 : 0)
      };
      writeFileState(stateFile, state);
    }
  };
}

function shouldUseSupabaseBackend(config: GoogleIndexingConfig): boolean {
  if (config.stateBackend === "file") return false;
  if (config.stateBackend === "supabase") return true;
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE);
}

function createSupabaseStateStore(): StateStore {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required for GOOGLE_INDEXING_STATE_BACKEND=supabase.");
  }

  const sb: SupabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  return {
    backend: "supabase",
    async countSubmittedToday(notificationType) {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const { count, error } = await sb
        .from("google_indexing_attempts")
        .select("id", { count: "exact", head: true })
        .eq("notification_type", notificationType)
        .gte("submitted_at", start.toISOString());
      if (error) throw new Error(`Failed to count today's Google indexing attempts: ${error.message}`);
      return count ?? 0;
    },
    async getUrlStates(urls, notificationType) {
      const result = new Map<string, UrlState>();
      for (const chunk of chunkArray(urls, 200)) {
        const { data, error } = await sb
          .from("google_indexing_url_state")
          .select("url,notification_type,last_submitted_at,last_status_code,last_error,attempt_count,success_count")
          .eq("notification_type", notificationType)
          .in("url", chunk);
        if (error) throw new Error(`Failed to load Google indexing URL state: ${error.message}`);
        for (const row of (data ?? []) as UrlState[]) {
          result.set(row.url, row);
        }
      }
      return result;
    },
    async recordAttempt(result, previous) {
      const { error: attemptError } = await sb.from("google_indexing_attempts").insert({
        url: result.url,
        notification_type: result.notificationType,
        submitted_at: result.submittedAt,
        status_code: result.statusCode,
        response_status: result.responseStatus,
        error_message: result.errorMessage,
        success: result.success
      });
      if (attemptError) throw new Error(`Failed to record Google indexing attempt: ${attemptError.message}`);

      const { error: stateError } = await sb.from("google_indexing_url_state").upsert(
        {
          url: result.url,
          notification_type: result.notificationType,
          last_submitted_at: result.submittedAt,
          last_status_code: result.statusCode,
          last_error: result.errorMessage,
          attempt_count: Number(previous?.attempt_count ?? 0) + 1,
          success_count: Number(previous?.success_count ?? 0) + (result.success ? 1 : 0)
        },
        { onConflict: "url,notification_type" }
      );
      if (stateError) throw new Error(`Failed to update Google indexing URL state: ${stateError.message}`);
    }
  };
}

function createStateStore(config: GoogleIndexingConfig): StateStore {
  if (shouldUseSupabaseBackend(config)) {
    return createSupabaseStateStore();
  }
  return createFileStateStore(config.stateFile);
}

function sortAndFilterUrls(
  urls: string[],
  states: Map<string, UrlState>,
  config: GoogleIndexingConfig,
  remainingToday: number
): string[] {
  const cutoffMs = Date.now() - config.resubmitAfterHours * 60 * 60 * 1000;
  const candidates = urls
    .map((url) => ({ url, state: states.get(url) }))
    .filter((item) => {
      if (config.force || config.resubmitAfterHours === 0) return true;
      if (!item.state?.last_submitted_at) return true;
      const submittedAt = Date.parse(item.state.last_submitted_at);
      return !Number.isFinite(submittedAt) || submittedAt <= cutoffMs;
    })
    .sort((a, b) => {
      const aTime = a.state?.last_submitted_at ? Date.parse(a.state.last_submitted_at) : 0;
      const bTime = b.state?.last_submitted_at ? Date.parse(b.state.last_submitted_at) : 0;
      return aTime - bTime || a.url.localeCompare(b.url);
    });

  return candidates.slice(0, Math.min(config.maxUrls, remainingToday)).map((item) => item.url);
}

async function publishUrl(accessToken: string, url: string, notificationType: NotificationType): Promise<AttemptResult> {
  const submittedAt = new Date().toISOString();
  const res = await fetch(GOOGLE_INDEXING_PUBLISH_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ url, type: notificationType })
  });
  const rawBody = await res.text();
  let parsed: {
    error?: { status?: string; message?: string };
    urlNotificationMetadata?: unknown;
  } = {};
  try {
    parsed = JSON.parse(rawBody) as typeof parsed;
  } catch {
    parsed = {};
  }

  return {
    url,
    notificationType,
    statusCode: res.status,
    responseStatus: parsed.error?.status ?? (res.ok ? "OK" : null),
    errorMessage: res.ok ? null : parsed.error?.message ?? rawBody.slice(0, 500),
    success: res.ok,
    submittedAt
  };
}

async function main() {
  loadIndexingEnv();
  const cli = parseArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    return;
  }

  const config = resolveConfig(cli);

  console.log("Google Indexing API submitter starting...");
  console.log(`Site origin: ${config.siteOrigin}`);
  console.log(`Notification type: ${config.notificationType}`);
  console.log(`State backend: ${shouldUseSupabaseBackend(config) ? "supabase" : "file"}`);
  console.log(`Daily limit: ${config.dailyLimit}`);
  console.log(`Batch limit: ${config.maxUrls}`);
  console.log(`Apply: ${config.apply ? "yes" : "no"}`);
  console.log(`Dry run: ${config.dryRun ? "yes" : "no"}`);

  if (config.apply && !config.enabled) {
    console.log("GOOGLE_INDEXING_API_ENABLED is not true. Skipping live Google submission.");
    return;
  }

  const urls = await collectCandidateUrls(config, cli);
  if (!urls.length) {
    console.log("No candidate URLs found. Nothing to do.");
    return;
  }

  const store = createStateStore(config);
  const submittedToday = await store.countSubmittedToday(config.notificationType);
  const remainingToday = Math.max(0, config.dailyLimit - submittedToday);
  console.log(`Already submitted today: ${submittedToday}`);
  console.log(`Remaining today: ${remainingToday}`);

  if (remainingToday <= 0) {
    console.log("Daily limit already reached. Nothing to submit.");
    return;
  }

  const states = await store.getUrlStates(urls, config.notificationType);
  const batch = sortAndFilterUrls(urls, states, config, remainingToday);
  if (!batch.length) {
    console.log(`No URLs are due yet. Use --force or lower GOOGLE_INDEXING_RESUBMIT_AFTER_HOURS to resubmit sooner.`);
    return;
  }

  console.log(`Prepared ${batch.length} URL(s) out of ${urls.length} candidate(s).`);
  for (const url of batch.slice(0, 10)) {
    console.log(`- ${url}`);
  }
  if (batch.length > 10) {
    console.log(`...and ${batch.length - 10} more.`);
  }

  if (config.dryRun) {
    console.log("Dry run complete. No Google calls were made.");
    return;
  }

  const key = readServiceAccountKey();
  console.log(`Using service account: ${key.client_email}`);
  const accessToken = await getAccessToken(key, config.serviceAccountScope);

  let succeeded = 0;
  let failed = 0;
  for (const url of batch) {
    const previous = states.get(url);
    const result = await publishUrl(accessToken, url, config.notificationType);
    await store.recordAttempt(result, previous);
    states.set(url, {
      url,
      notification_type: config.notificationType,
      last_submitted_at: result.submittedAt,
      last_status_code: result.statusCode,
      last_error: result.errorMessage,
      attempt_count: Number(previous?.attempt_count ?? 0) + 1,
      success_count: Number(previous?.success_count ?? 0) + (result.success ? 1 : 0)
    });

    if (result.success) {
      succeeded += 1;
      console.log(`Submitted ${config.notificationType}: ${url}`);
    } else {
      failed += 1;
      console.warn(`Failed ${config.notificationType}: ${url} (${result.statusCode} ${result.responseStatus ?? ""}) ${result.errorMessage ?? ""}`.trim());
    }

    await sleep(config.requestDelayMs);
  }

  console.log(`Google Indexing API run complete. Success=${succeeded}, failed=${failed}, backend=${store.backend}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Google Indexing API submitter failed: ${message}`);
  process.exitCode = 1;
});
