import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { parse as parseDotenv } from "dotenv";

export type ArticleQueueCredentials = {
  url: string;
  serviceRole: string;
  source: string;
};

export type ArticleDevCredentials = ArticleQueueCredentials;

const PRODUCTION_SUPABASE_HOSTS = new Set([
  "database.bloxodes.com",
  "bloxodesdb.ravitejaknts.com"
]);
const HOMELAB_ARTICLE_ENV_PATH = "/etc/bloxodes/article-automation.env";

export const ARTICLE_QUEUE_ENV_KEYS = [
  "ARTICLE_QUEUE_ENV_FILE",
  "ARTICLE_QUEUE_SUPABASE_URL",
  "ARTICLE_QUEUE_SUPABASE_SERVICE_ROLE"
] as const;

export const ARTICLE_DEV_ENV_KEYS = [
  "ARTICLE_DEV_ENV_FILE",
  "ARTICLE_DEV_SUPABASE_URL",
  "ARTICLE_DEV_SUPABASE_SERVICE_ROLE"
] as const;

export function isLocalSupabaseUrl(value: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function supabaseTarget(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "invalid-url";
  }
}

export function assertNonProductionArticleTarget(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("ARTICLE_DEV_SUPABASE_URL must be a valid URL.");
  }
  const host = url.hostname;
  if (PRODUCTION_SUPABASE_HOSTS.has(host)) {
    throw new Error(`Refusing article automation writes to the production Supabase host (${host}).`);
  }
  if (isLocalSupabaseUrl(value)) return;
  if (url.protocol !== "https:" || !host.endsWith(".supabase.co")) {
    throw new Error(
      `Refusing article automation writes to ${host}; managed dev must use an HTTPS *.supabase.co project URL.`
    );
  }
}

export function resolveArticleDevCredentials(options: { envFile?: string | null } = {}): ArticleDevCredentials {
  const directUrl = process.env.ARTICLE_DEV_SUPABASE_URL?.trim();
  const directRole = process.env.ARTICLE_DEV_SUPABASE_SERVICE_ROLE?.trim();
  if (directUrl || directRole) {
    if (!directUrl || !directRole) {
      throw new Error("ARTICLE_DEV_SUPABASE_URL and ARTICLE_DEV_SUPABASE_SERVICE_ROLE must be set together.");
    }
    assertNonProductionArticleTarget(directUrl);
    return { url: directUrl, serviceRole: directRole, source: "article dev environment" };
  }

  const configuredFile =
    options.envFile?.trim() ||
    process.env.ARTICLE_DEV_ENV_FILE?.trim() ||
    (() => {
      try {
        return statSync(HOMELAB_ARTICLE_ENV_PATH).isFile() ? HOMELAB_ARTICLE_ENV_PATH : null;
      } catch {
        return null;
      }
    })();
  if (configuredFile) {
    const absolutePath = path.resolve(configuredFile);
    if (!statSync(absolutePath).isFile()) throw new Error(`Article dev env path is not a file: ${absolutePath}`);
    const parsed = parseDotenv(readFileSync(absolutePath, "utf8"));
    const url = (parsed.ARTICLE_DEV_SUPABASE_URL ?? parsed.SUPABASE_URL)?.trim();
    const serviceRole = (parsed.ARTICLE_DEV_SUPABASE_SERVICE_ROLE ?? parsed.SUPABASE_SERVICE_ROLE)?.trim();
    if (!url || !serviceRole) {
      throw new Error(
        `${absolutePath} must contain ARTICLE_DEV_SUPABASE_URL and ARTICLE_DEV_SUPABASE_SERVICE_ROLE.`
      );
    }
    assertNonProductionArticleTarget(url);
    return { url, serviceRole, source: absolutePath };
  }

  const fallbackUrl = process.env.SUPABASE_URL?.trim();
  const fallbackRole = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (fallbackUrl && fallbackRole && isLocalSupabaseUrl(fallbackUrl)) {
    return { url: fallbackUrl, serviceRole: fallbackRole, source: "legacy localhost environment" };
  }
  throw new Error(
    "Article dev credentials are required through ARTICLE_DEV_SUPABASE_URL and ARTICLE_DEV_SUPABASE_SERVICE_ROLE. " +
      "Standard SUPABASE_* credentials are accepted only for localhost compatibility."
  );
}

export function resolveArticleQueueCredentials(options: { envFile?: string | null } = {}): ArticleQueueCredentials {
  if (
    process.env.ARTICLE_DEV_SUPABASE_URL?.trim() ||
    process.env.ARTICLE_DEV_SUPABASE_SERVICE_ROLE?.trim() ||
    process.env.ARTICLE_DEV_ENV_FILE?.trim()
  ) {
    return resolveArticleDevCredentials({ envFile: options.envFile });
  }
  const directUrl = process.env.ARTICLE_QUEUE_SUPABASE_URL?.trim();
  const directRole = process.env.ARTICLE_QUEUE_SUPABASE_SERVICE_ROLE?.trim();
  if (directUrl || directRole) {
    if (!directUrl || !directRole) {
      throw new Error("ARTICLE_QUEUE_SUPABASE_URL and ARTICLE_QUEUE_SUPABASE_SERVICE_ROLE must be set together.");
    }
    return { url: directUrl, serviceRole: directRole, source: "prefixed environment" };
  }

  const configuredFile = options.envFile?.trim() || process.env.ARTICLE_QUEUE_ENV_FILE?.trim();
  if (configuredFile) {
    const absolutePath = path.resolve(configuredFile);
    if (!statSync(absolutePath).isFile()) throw new Error(`Article queue env path is not a file: ${absolutePath}`);
    const parsed = parseDotenv(readFileSync(absolutePath, "utf8"));
    const url = (parsed.ARTICLE_QUEUE_SUPABASE_URL ?? parsed.SUPABASE_URL)?.trim();
    const serviceRole = (parsed.ARTICLE_QUEUE_SUPABASE_SERVICE_ROLE ?? parsed.SUPABASE_SERVICE_ROLE)?.trim();
    if (!url || !serviceRole) {
      throw new Error(`${absolutePath} must contain SUPABASE_URL and SUPABASE_SERVICE_ROLE (or their ARTICLE_QUEUE_ aliases).`);
    }
    return { url, serviceRole, source: absolutePath };
  }

  const fallbackUrl = process.env.SUPABASE_URL?.trim();
  const fallbackRole = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (!fallbackUrl || !fallbackRole) {
    throw new Error(
      "Article queue credentials are required through ARTICLE_QUEUE_ENV_FILE, ARTICLE_QUEUE_SUPABASE_*, or SUPABASE_*."
    );
  }
  return { url: fallbackUrl, serviceRole: fallbackRole, source: "standard environment" };
}
