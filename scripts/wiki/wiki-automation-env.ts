import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import { assertManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

export type WikiDevCredentials = { url: string; serviceRole: string; source: string };
const DEFAULT_ENV_FILE = "/etc/bloxodes/wiki-automation.env";

export const MODEL_FORBIDDEN_ENV_KEYS = [
  "SUPABASE_DB_PASSWORD",
  "ARTICLE_RELEASE_PRODUCTION_ENV_FILE",
  "WIKI_RELEASE_PRODUCTION_ENV_FILE",
  "DOKPLOY_API_KEY",
  "CLOUDFLARE_API_TOKEN"
] as const;

export function resolveWikiDevCredentials(envFile?: string | null): WikiDevCredentials {
  const directUrl = process.env.WIKI_DEV_SUPABASE_URL?.trim();
  const directRole = process.env.WIKI_DEV_SUPABASE_SERVICE_ROLE?.trim();
  if (directUrl || directRole) {
    if (!directUrl || !directRole) throw new Error("WIKI_DEV_SUPABASE_URL and WIKI_DEV_SUPABASE_SERVICE_ROLE must be set together.");
    assertManagedDevelopmentSupabaseUrl(directUrl, "wiki automation");
    return { url: directUrl, serviceRole: directRole, source: "wiki environment" };
  }

  const configured = envFile?.trim() || process.env.WIKI_AUTOMATION_ENV_FILE?.trim() || (() => {
    try { return statSync(DEFAULT_ENV_FILE).isFile() ? DEFAULT_ENV_FILE : null; } catch { return null; }
  })();
  if (configured) {
    const absolute = path.resolve(configured);
    const parsed = parseDotenv(readFileSync(absolute, "utf8"));
    const url = (parsed.WIKI_DEV_SUPABASE_URL ?? parsed.SUPABASE_URL)?.trim();
    const serviceRole = (parsed.WIKI_DEV_SUPABASE_SERVICE_ROLE ?? parsed.SUPABASE_SERVICE_ROLE)?.trim();
    if (!url || !serviceRole) throw new Error(`${absolute} is missing managed-development wiki credentials.`);
    assertManagedDevelopmentSupabaseUrl(url, "wiki automation");
    return { url, serviceRole, source: absolute };
  }

  const url = process.env.SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (!url || !serviceRole) throw new Error("Managed-development wiki credentials are required.");
  assertManagedDevelopmentSupabaseUrl(url, "wiki automation");
  return { url, serviceRole, source: "managed development environment" };
}
