import "../shared/load-env";

import { randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, open, readFile, realpath, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { load } from "cheerio";
import { parse as parseDotenv } from "dotenv";

import { classifyArticleImageSrc, findMarkdownImages } from "@/lib/article-media";
import {
  assertArticleImageReadiness,
  checkArticleImageReadiness,
  readArticleImageManifest,
  type ArticleImageEntry,
  type ArticleImageManifest,
} from "../content/article-image-readiness";
import { CANONICAL_MEDIA_ORIGIN } from "../shared/storage-public-url";
import {
  ARTICLE_DEV_ENV_KEYS,
  ARTICLE_QUEUE_ENV_KEYS,
  resolveArticleDevCredentials,
} from "./article-queue-env";

const PRODUCTION_DATABASE_HOST = "database.bloxodes.com";
const DEFAULT_PRODUCTION_ENV_FILE = ".envs/targets/production.env";
const DEFAULT_VERIFY_ATTEMPTS = 24;
const DEFAULT_VERIFY_DELAY_MS = 5_000;
const MAX_QUEUE_IDS = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReleaseOptions = {
  queueIds: string[];
  apply: boolean;
  allowProd: boolean;
  devEnvFile: string | null;
  productionEnvFile: string;
  baseUrl: string;
  verifyAttempts: number;
  verifyDelayMs: number;
};

type QueueRow = {
  id: string;
  article_title: string | null;
  workflow_mode: string;
  status: string;
  result_path: string | null;
  result_slug: string | null;
  production_url: string | null;
};

type ArticleFinal = {
  title: string;
  slug: string;
  content_md: string;
};

type ReleaseArtifact = {
  row: QueueRow;
  finalPath: string;
  mediaPath: string;
  finalJson: ArticleFinal;
  manifest: ArticleImageManifest;
};

export type ProductionCredentials = {
  url: string;
  serviceRole: string;
  mediaBucket: string;
  mediaPublicUrl: string;
};

type ProductionArticleRow = {
  id: string;
  slug: string | null;
  title: string | null;
  cover_image: string | null;
  content_md: string | null;
  is_published: boolean | null;
};

type ProductionProvenanceRow = {
  public_url: string | null;
  uploaded_path: string | null;
  original_url: string | null;
};

type ReleaseReceipt = {
  queueId: string;
  slug: string;
  productionUrl: string;
  status: "published" | "already-published";
};

const TARGET_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
  "SUPABASE_DB_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_MEDIA_BUCKET",
  "SUPABASE_MEDIA_PUBLIC_URL",
] as const;

function printUsage() {
  console.log(`Usage: npm run articles:release -- [options]

Options:
  --queue-id UUID               Exact completed managed-dev queue ID; repeatable
  --dev-env-file PATH           Managed-development queue credentials file
  --production-env-file PATH    Production target file (default: ${DEFAULT_PRODUCTION_ENV_FILE})
  --base-url URL                Public origin (default: https://bloxodes.com)
  --verify-attempts N           Live verification attempts, 1-60 (default: ${DEFAULT_VERIFY_ATTEMPTS})
  --verify-delay-ms N           Delay between attempts, 1000-30000 (default: ${DEFAULT_VERIFY_DELAY_MS})
  --apply                       Perform the release; dry-run by default
  --allow-prod                  Required with --apply
  --help                        Show this help

The command never scans all completed rows. It releases only explicit --queue-id values.`);
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1]?.trim();
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function parseInteger(value: string, flag: string, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${flag} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["bloxodes.com", "www.bloxodes.com"].includes(url.hostname)) {
    throw new Error("--base-url must use https://bloxodes.com.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("--base-url must be an origin without a path, query, or hash.");
  }
  return url.origin;
}

export function parseReleaseOptions(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): ReleaseOptions {
  const options: ReleaseOptions = {
    queueIds: [],
    apply: false,
    allowProd: false,
    devEnvFile: null,
    productionEnvFile: path.resolve(
      env.ARTICLE_RELEASE_PRODUCTION_ENV_FILE?.trim() || DEFAULT_PRODUCTION_ENV_FILE,
    ),
    baseUrl: normalizeBaseUrl(env.ARTICLE_RELEASE_BASE_URL?.trim() || "https://bloxodes.com"),
    verifyAttempts: parseInteger(
      env.ARTICLE_RELEASE_VERIFY_ATTEMPTS?.trim() || String(DEFAULT_VERIFY_ATTEMPTS),
      "ARTICLE_RELEASE_VERIFY_ATTEMPTS",
      1,
      60,
    ),
    verifyDelayMs: parseInteger(
      env.ARTICLE_RELEASE_VERIFY_DELAY_MS?.trim() || String(DEFAULT_VERIFY_DELAY_MS),
      "ARTICLE_RELEASE_VERIFY_DELAY_MS",
      1_000,
      30_000,
    ),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--queue-id") {
      options.queueIds.push(requireValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--queue-id=")) {
      options.queueIds.push(arg.slice("--queue-id=".length).trim());
    } else if (arg === "--dev-env-file") {
      options.devEnvFile = path.resolve(requireValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--dev-env-file=")) {
      options.devEnvFile = path.resolve(arg.slice("--dev-env-file=".length).trim());
    } else if (arg === "--production-env-file") {
      options.productionEnvFile = path.resolve(requireValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--production-env-file=")) {
      options.productionEnvFile = path.resolve(arg.slice("--production-env-file=".length).trim());
    } else if (arg === "--base-url") {
      options.baseUrl = normalizeBaseUrl(requireValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      options.baseUrl = normalizeBaseUrl(arg.slice("--base-url=".length).trim());
    } else if (arg === "--verify-attempts") {
      options.verifyAttempts = parseInteger(requireValue(argv, index, arg), arg, 1, 60);
      index += 1;
    } else if (arg.startsWith("--verify-attempts=")) {
      options.verifyAttempts = parseInteger(arg.slice("--verify-attempts=".length), "--verify-attempts", 1, 60);
    } else if (arg === "--verify-delay-ms") {
      options.verifyDelayMs = parseInteger(requireValue(argv, index, arg), arg, 1_000, 30_000);
      index += 1;
    } else if (arg.startsWith("--verify-delay-ms=")) {
      options.verifyDelayMs = parseInteger(arg.slice("--verify-delay-ms=".length), "--verify-delay-ms", 1_000, 30_000);
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--allow-prod") {
      options.allowProd = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.queueIds.length) throw new Error("At least one --queue-id is required.");
  if (options.queueIds.length > MAX_QUEUE_IDS) {
    throw new Error(`At most ${MAX_QUEUE_IDS} queue IDs may be released together.`);
  }
  for (const queueId of options.queueIds) {
    if (!UUID_PATTERN.test(queueId)) throw new Error(`Invalid --queue-id: ${queueId}`);
  }
  if (new Set(options.queueIds).size !== options.queueIds.length) {
    throw new Error("Duplicate --queue-id values are not allowed.");
  }
  if (options.apply && !options.allowProd) {
    throw new Error("Production release requires both --apply and --allow-prod.");
  }
  return options;
}

export async function readProductionCredentials(filePath: string): Promise<ProductionCredentials> {
  const parsed = parseDotenv(await readFile(filePath, "utf8"));
  const url = parsed.SUPABASE_URL?.trim();
  const serviceRole = parsed.SUPABASE_SERVICE_ROLE?.trim();
  const mediaBucket = parsed.SUPABASE_MEDIA_BUCKET?.trim();
  const mediaPublicUrl = parsed.SUPABASE_MEDIA_PUBLIC_URL?.trim();
  if (!url || !serviceRole || !mediaBucket || !mediaPublicUrl) {
    throw new Error(
      `${filePath} must define SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_MEDIA_BUCKET, and SUPABASE_MEDIA_PUBLIC_URL.`,
    );
  }
  if (new URL(url).hostname.toLowerCase() !== PRODUCTION_DATABASE_HOST) {
    throw new Error(`${filePath} does not target the Bloxodes production database.`);
  }
  if (new URL(mediaPublicUrl).origin !== CANONICAL_MEDIA_ORIGIN) {
    throw new Error(`${filePath} must use ${CANONICAL_MEDIA_ORIGIN} for SUPABASE_MEDIA_PUBLIC_URL.`);
  }
  return { url, serviceRole, mediaBucket, mediaPublicUrl };
}

function clearTargetEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean = { ...env };
  for (const key of TARGET_ENV_KEYS) delete clean[key];
  for (const key of ARTICLE_QUEUE_ENV_KEYS) delete clean[key];
  for (const key of ARTICLE_DEV_ENV_KEYS) delete clean[key];
  delete clean.ARTICLE_WRITER_REGENERATE_COVERS;
  delete clean.BLOXODES_ENV_OVERLAYS;
  return clean;
}

export function productionChildEnvironment(
  credentials: ProductionCredentials,
  parent: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = clearTargetEnvironment(parent);
  return {
    ...env,
    BLOXODES_ENV_PROFILE: "process-only",
    NODE_ENV: "production",
    SUPABASE_URL: credentials.url,
    SUPABASE_SERVICE_ROLE: credentials.serviceRole,
    SUPABASE_MEDIA_BUCKET: credentials.mediaBucket,
    SUPABASE_MEDIA_PUBLIC_URL: credentials.mediaPublicUrl,
  };
}

function managedDevChildEnvironment(
  credentials: { url: string; serviceRole: string },
): NodeJS.ProcessEnv {
  const env = clearTargetEnvironment(process.env);
  return {
    ...env,
    BLOXODES_ENV_PROFILE: "process-only",
    NODE_ENV: "development",
    ARTICLE_DEV_SUPABASE_URL: credentials.url,
    ARTICLE_DEV_SUPABASE_SERVICE_ROLE: credentials.serviceRole,
  };
}

function runNpmScript(
  script: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", script, "--", ...args], {
      cwd: process.cwd(),
      env,
      shell: false,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm run ${script} exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function acquireReleaseLock(): Promise<() => Promise<void>> {
  const lockDir = path.join(process.cwd(), "tmp", "article-writer");
  const lockPath = path.join(lockDir, "release.lock");
  const token = randomUUID();
  await mkdir(lockDir, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, token, started_at: new Date().toISOString() }));
      await handle.close();
      return async () => {
        try {
          const current = JSON.parse(await readFile(lockPath, "utf8")) as { token?: unknown };
          if (current.token === token) await unlink(lockPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let current: { pid?: unknown } = {};
      try {
        current = JSON.parse(await readFile(lockPath, "utf8")) as { pid?: unknown };
      } catch {
        // A malformed or incomplete lock can be replaced after the owner check below.
      }
      if (typeof current.pid === "number") {
        try {
          process.kill(current.pid, 0);
          throw new Error(`Another article production release is active with PID ${current.pid}.`);
        } catch (processError) {
          if (
            processError instanceof Error &&
            processError.message.startsWith("Another article production release")
          ) {
            throw processError;
          }
          if ((processError as NodeJS.ErrnoException).code !== "ESRCH") throw processError;
        }
      }
      await unlink(lockPath).catch((unlinkError) => {
        if ((unlinkError as NodeJS.ErrnoException).code !== "ENOENT") throw unlinkError;
      });
    }
  }
  throw new Error(`Could not acquire article release lock at ${lockPath}.`);
}

async function loadQueueRows(
  queueIds: string[],
  dev: { url: string; serviceRole: string },
): Promise<QueueRow[]> {
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select("id,article_title,workflow_mode,status,result_path,result_slug,production_url")
    .in("id", queueIds);
  if (error) throw new Error(`Could not load selected article queue rows: ${error.message}`);

  const byId = new Map((data ?? []).map((row) => [row.id as string, row as QueueRow]));
  return queueIds.map((queueId) => {
    const row = byId.get(queueId);
    if (!row) throw new Error(`Selected queue row was not found: ${queueId}`);
    if (row.workflow_mode !== "agent_runner") {
      throw new Error(`Queue row ${queueId} belongs to ${row.workflow_mode}, not agent_runner.`);
    }
    if (!row.result_path || !row.result_slug) {
      throw new Error(`Queue row ${queueId} has no completed result_path/result_slug.`);
    }
    if (!["completed", "published"].includes(row.status)) {
      throw new Error(`Queue row ${queueId} must be completed or published, not ${row.status}.`);
    }
    return row;
  });
}

function isArticleFinal(value: unknown): value is ArticleFinal {
  const candidate = value as Partial<ArticleFinal>;
  return Boolean(
    candidate &&
      typeof candidate.title === "string" && candidate.title.trim() &&
      typeof candidate.slug === "string" && candidate.slug.trim() &&
      typeof candidate.content_md === "string" && candidate.content_md.trim(),
  );
}

async function assertInsideContentWorkspace(filePath: string): Promise<string> {
  const workspace = await realpath(path.join(process.cwd(), "tmp", "content-workspace"));
  const actual = await realpath(filePath);
  if (!actual.startsWith(`${workspace}${path.sep}`)) {
    throw new Error(`${filePath} resolves outside tmp/content-workspace.`);
  }
  return actual;
}

async function readReleaseArtifact(row: QueueRow): Promise<ReleaseArtifact> {
  if (!row.result_path || path.isAbsolute(row.result_path) || path.basename(row.result_path) !== "final.json") {
    throw new Error(`Queue row ${row.id} has an unsafe result_path.`);
  }
  const finalPath = await assertInsideContentWorkspace(path.resolve(process.cwd(), row.result_path));
  const mediaPath = await assertInsideContentWorkspace(path.join(path.dirname(finalPath), "media.json"));
  await access(finalPath);
  await access(mediaPath);

  const parsed = JSON.parse(await readFile(finalPath, "utf8")) as unknown;
  if (!isArticleFinal(parsed)) throw new Error(`${row.result_path} is not a valid article final.json.`);
  const finalJson = { ...parsed, title: parsed.title.trim(), slug: parsed.slug.trim(), content_md: parsed.content_md };
  if (finalJson.slug !== row.result_slug) {
    throw new Error(`Queue row ${row.id} result_slug does not match final.json.`);
  }
  const manifest = await readArticleImageManifest(mediaPath);
  const readiness = checkArticleImageReadiness({ manifest, finalJson });
  assertArticleImageReadiness(readiness, mediaPath);
  return { row, finalPath, mediaPath, finalJson, manifest };
}

export function pickCoverSourceEntry(manifest: ArticleImageManifest): ArticleImageEntry | null {
  return manifest.entries.find((entry) => entry.status === "verified" && Boolean(entry.public_url)) ?? null;
}

function normalizedSet(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function assertSameValues(actual: string[], expected: string[], label: string): void {
  const normalizedActual = normalizedSet(actual);
  const normalizedExpected = normalizedSet(expected);
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    throw new Error(
      `${label} mismatch. Expected ${JSON.stringify(normalizedExpected)}, got ${JSON.stringify(normalizedActual)}.`,
    );
  }
}

export function assertProductionSnapshot(params: {
  finalJson: ArticleFinal;
  manifest: ArticleImageManifest;
  article: ProductionArticleRow;
  provenance: ProductionProvenanceRow[];
}): void {
  const { finalJson, manifest, article, provenance } = params;
  if (article.slug !== finalJson.slug || article.title !== finalJson.title || article.is_published !== true) {
    throw new Error(`${finalJson.slug}: production article identity or publication state does not match final.json.`);
  }
  if (article.content_md !== finalJson.content_md) {
    throw new Error(`${finalJson.slug}: production content_md does not exactly match the promoted final.json.`);
  }
  if (!article.cover_image || new URL(article.cover_image).origin !== CANONICAL_MEDIA_ORIGIN) {
    throw new Error(`${finalJson.slug}: production cover_image is missing or not hosted on ${CANONICAL_MEDIA_ORIGIN}.`);
  }

  const verifiedEntries = manifest.entries.filter((entry) => entry.status === "verified");
  const expectedBodyUrls = verifiedEntries.map((entry) => entry.public_url?.trim() || "");
  if (expectedBodyUrls.some((value) => !value)) {
    throw new Error(`${finalJson.slug}: verified manifest entry is missing public_url after promotion.`);
  }
  for (const publicUrl of expectedBodyUrls) {
    if (publicUrl.startsWith("/")) continue;
    if (new URL(publicUrl).origin !== CANONICAL_MEDIA_ORIGIN) {
      throw new Error(`${finalJson.slug}: promoted body image is not hosted on ${CANONICAL_MEDIA_ORIGIN}.`);
    }
  }
  assertSameValues(
    findMarkdownImages(article.content_md ?? "").map((image) => image.src),
    expectedBodyUrls,
    `${finalJson.slug} body image URLs`,
  );

  const expectedProvenance = verifiedEntries
    .filter((entry) => !entry.public_url?.startsWith("/") || !classifyArticleImageSrc(entry.public_url, finalJson.slug).ok)
    .map((entry) => `${entry.public_url}|${entry.uploaded_path}|${entry.original_image_url}`);
  const actualProvenance = provenance.map(
    (entry) => `${entry.public_url}|${entry.uploaded_path}|${entry.original_url}`,
  );
  assertSameValues(actualProvenance, expectedProvenance, `${finalJson.slug} provenance rows`);
}

async function verifyProductionReadback(
  artifact: ReleaseArtifact,
  production: SupabaseClient,
): Promise<void> {
  const { data: article, error: articleError } = await production
    .from("articles")
    .select("id,slug,title,cover_image,content_md,is_published")
    .eq("slug", artifact.finalJson.slug)
    .maybeSingle();
  if (articleError || !article) {
    throw new Error(
      `${artifact.finalJson.slug}: production article readback failed: ${articleError?.message ?? "not found"}`,
    );
  }
  const { data: provenance, error: provenanceError } = await production
    .from("article_source_images")
    .select("public_url,uploaded_path,original_url")
    .eq("article_id", article.id);
  if (provenanceError) {
    throw new Error(`${artifact.finalJson.slug}: provenance readback failed: ${provenanceError.message}`);
  }
  assertProductionSnapshot({
    finalJson: artifact.finalJson,
    manifest: artifact.manifest,
    article: article as ProductionArticleRow,
    provenance: (provenance ?? []) as ProductionProvenanceRow[],
  });
}

async function downloadCoverSource(
  artifact: ReleaseArtifact,
  targetDir: string,
): Promise<string | null> {
  const entry = pickCoverSourceEntry(artifact.manifest);
  if (!entry?.public_url) return null;
  const response = await fetch(entry.public_url, {
    redirect: "follow",
    headers: { "user-agent": "Bloxodes automated article release" },
  });
  if (!response.ok) throw new Error(`${entry.label}: cover source returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`${entry.label}: cover source returned ${contentType || "an unknown content type"}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`${entry.label}: cover source returned an empty body.`);
  const filePath = path.join(targetDir, `${artifact.finalJson.slug}.webp`);
  await writeFile(filePath, bytes);
  return filePath;
}

async function verifyExpectedLiveTitle(
  artifact: ReleaseArtifact,
  options: ReleaseOptions,
): Promise<void> {
  const url = `${options.baseUrl}/articles/${artifact.finalJson.slug}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.verifyAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "user-agent": "Bloxodes automated article release" },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      const document = load(await response.text());
      const h1 = document("h1").first().text().replace(/\s+/g, " ").trim();
      if (h1 !== artifact.finalJson.title) {
        throw new Error(`expected h1 ${JSON.stringify(artifact.finalJson.title)}, got ${JSON.stringify(h1)}`);
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < options.verifyAttempts) {
        await new Promise((resolve) => setTimeout(resolve, options.verifyDelayMs));
      }
    }
  }
  throw new Error(
    `${artifact.finalJson.slug}: live title verification failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function promoteAndImport(
  artifact: ReleaseArtifact,
  productionEnv: NodeJS.ProcessEnv,
  coverDir: string,
): Promise<ReleaseArtifact> {
  await runNpmScript(
    "collect:article-images",
    ["--manifest", artifact.mediaPath, "--file", artifact.finalPath, "--apply", "--allow-prod"],
    productionEnv,
  );
  const promoted = await readReleaseArtifact(artifact.row);
  const coverSource = await downloadCoverSource(promoted, coverDir);
  const importArgs = ["--file", promoted.finalPath];
  if (coverSource) importArgs.push("--cover-source-file", coverSource);
  await runNpmScript("import:content-final", [...importArgs, "--dry-run", "--allow-prod"], productionEnv);
  await runNpmScript("import:content-final", [...importArgs, "--allow-prod"], productionEnv);
  await runNpmScript(
    "sync:article-image-provenance",
    ["--manifest", promoted.mediaPath, "--allow-prod"],
    productionEnv,
  );
  await runNpmScript(
    "sync:article-image-provenance",
    ["--manifest", promoted.mediaPath, "--apply", "--allow-prod"],
    productionEnv,
  );
  return promoted;
}

async function verifyLiveRelease(
  artifact: ReleaseArtifact,
  options: ReleaseOptions,
  productionEnv: NodeJS.ProcessEnv,
): Promise<void> {
  await runNpmScript(
    "verify:published-url",
    [
      "--path", `/articles/${artifact.finalJson.slug}`,
      "--base-url", options.baseUrl,
      "--attempts", String(options.verifyAttempts),
      "--delay-ms", String(options.verifyDelayMs),
    ],
    productionEnv,
  );
  await verifyExpectedLiveTitle(artifact, options);
}

async function closeQueueRow(
  artifact: ReleaseArtifact,
  productionUrl: string,
  dev: { url: string; serviceRole: string },
): Promise<void> {
  await runNpmScript(
    "articles:queue:update",
    [
      "--queue-id", artifact.row.id,
      "--status", "published",
      "--production-url", productionUrl,
      "--apply",
    ],
    managedDevChildEnvironment(dev),
  );
}

async function releaseOne(params: {
  artifact: ReleaseArtifact;
  options: ReleaseOptions;
  production: SupabaseClient;
  productionEnv: NodeJS.ProcessEnv;
  dev: { url: string; serviceRole: string };
  coverDir: string;
}): Promise<ReleaseReceipt> {
  const productionUrl = `${params.options.baseUrl}/articles/${params.artifact.finalJson.slug}`;
  if (params.artifact.row.status === "published") {
    if (params.artifact.row.production_url !== productionUrl) {
      throw new Error(`${params.artifact.row.id}: published queue URL does not match ${productionUrl}.`);
    }
    await verifyProductionReadback(params.artifact, params.production);
    await verifyLiveRelease(params.artifact, params.options, params.productionEnv);
    return {
      queueId: params.artifact.row.id,
      slug: params.artifact.finalJson.slug,
      productionUrl,
      status: "already-published",
    };
  }

  const promoted = await promoteAndImport(params.artifact, params.productionEnv, params.coverDir);
  await verifyProductionReadback(promoted, params.production);
  await verifyLiveRelease(promoted, params.options, params.productionEnv);
  await closeQueueRow(promoted, productionUrl, params.dev);
  return {
    queueId: promoted.row.id,
    slug: promoted.finalJson.slug,
    productionUrl,
    status: "published",
  };
}

async function main() {
  const options = parseReleaseOptions(process.argv.slice(2));
  const dev = resolveArticleDevCredentials({ envFile: options.devEnvFile });
  const productionCredentials = await readProductionCredentials(options.productionEnvFile);
  const rows = await loadQueueRows(options.queueIds, dev);
  const artifacts = await Promise.all(rows.map(readReleaseArtifact));

  console.log(`Article release allowlist: ${artifacts.length} exact queue row(s).`);
  for (const artifact of artifacts) {
    console.log(`- ${artifact.row.id} ${artifact.finalJson.slug} status=${artifact.row.status}`);
  }
  if (!options.apply) {
    console.log("Dry run only. Add --apply --allow-prod to publish this exact allowlist.");
    return;
  }

  const releaseLock = await acquireReleaseLock();
  const coverDir = await mkdtemp(path.join(os.tmpdir(), "bloxodes-article-release-covers-"));
  const production = createClient(productionCredentials.url, productionCredentials.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const productionEnv = productionChildEnvironment(productionCredentials);
  const receipts: ReleaseReceipt[] = [];
  const failures: Array<{ queueId: string; slug: string; error: string }> = [];

  try {
    for (const artifact of artifacts) {
      try {
        receipts.push(await releaseOne({
          artifact,
          options,
          production,
          productionEnv,
          dev,
          coverDir,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ queueId: artifact.row.id, slug: artifact.finalJson.slug, error: message });
        console.error(`Release failed for ${artifact.finalJson.slug}: ${message}`);
      }
    }
  } finally {
    await rm(coverDir, { recursive: true, force: true });
    await releaseLock();
  }

  console.log(JSON.stringify({ receipts, failures }, null, 2));
  if (failures.length) {
    throw new Error(`${failures.length} article release(s) failed; their queue rows remain completed.`);
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
