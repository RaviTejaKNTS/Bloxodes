import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const envRoot = path.join(repoRoot, ".envs");

const sources = {
  production: ".env",
  local: ".env.local",
  analytics: ".env.analytics",
  indexing: ".env.indexing",
  homelab: ".env.homelab",
  northflank: ".env.northflank",
  northflankStats: ".env.stats",
  operator: ".env.codex"
} as const;

const missingSources = Object.values(sources).filter(
  (relativePath) => !fs.existsSync(path.join(repoRoot, relativePath))
);
if (missingSources.length) {
  throw new Error(
    `Legacy env migration sources are missing: ${missingSources.join(", ")}. ` +
      "This one-time command must not be run after legacy cleanup."
  );
}

const targetKeys = new Set([
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
  "SUPABASE_DB_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_MEDIA_BUCKET",
  "SUPABASE_MEDIA_PUBLIC_URL"
]);
const applicationKeys = new Set([
  "NEXT_PUBLIC_GOOGLE_ANALYTICS_ID",
  "ROBLOX_OAUTH_CLIENT_ID",
  "ROBLOX_OAUTH_CLIENT_SECRET",
  "ROBLOX_OAUTH_LOGIN_REDIRECT_URI"
]);
const contentKeys = new Set([
  "OPENAI_API_KEY",
  "TAVILY_API_KEY",
  "FIRECRAWL_API_KEY",
  "GOOGLE_SEARCH_KEY",
  "GOOGLE_SEARCH_CX",
  "ROBLOX_OPEN_CLOUD_API_KEY"
]);
const distributionKeys = new Set([
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHANNEL_ID",
  "TWITTER_API_KEY",
  "TWITTER_API_SECRET",
  "TWITTER_ACCESS_TOKEN",
  "TWITTER_ACCESS_SECRET",
  "LINKEDIN_LI_AT"
]);
const articlePipelineKeys = new Set([
  "ARTICLE_DEV_SUPABASE_URL",
  "ARTICLE_DEV_SUPABASE_SERVICE_ROLE",
  "SUPABASE_MEDIA_BUCKET",
  "SUPABASE_MEDIA_PUBLIC_URL",
  "ARTICLE_PRODUCTION_INVENTORY_URL",
  "GROQ_API_KEY",
  "ARTICLE_CURATION_MODEL",
  "ARTICLE_WRITER_GROK_BIN",
  "ARTICLE_WRITER_GROK_MODEL",
  "ARTICLE_WRITER_BATCH_SIZE",
  "ARTICLE_WRITER_MAX_ATTEMPTS",
  "ARTICLE_WRITER_TIMEOUT_MINUTES"
]);
const homelabKeys = new Set([
  "HOMELAB_SSH_HOST",
  "HOMELAB_SSH_USER",
  "HOMELAB_SSH_TARGET",
  "HOMELAB_REPO_ROOT",
  "HOMELAB_ARTICLE_ENV_PATH",
  "HOMELAB_SUDO_PASSWORD"
]);
const cloudflareKeys = new Set([
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_BLOXODES_API",
  "CLOUDFLARE_ZONE_ID"
]);
const dokployKeys = new Set([
  "DEPLOY_BRANCH",
  "DEPLOY_REPO_URL",
  "DOKPLOY_ADMIN_EMAIL",
  "DOKPLOY_ADMIN_PASSWORD",
  "DOKPLOY_API_CLI_KEY",
  "DOKPLOY_API_DEPLOY_TOKEN",
  "DOKPLOY_APPLICATION_ID",
  "DOKPLOY_LOCAL_URL",
  "DOKPLOY_PUBLIC_URL",
  "GHCR_DOKPLOY_TOKEN"
]);
const vpsKeys = new Set([
  "HOSTINGER_Token",
  "VPS_ADMIN_PASSWORD",
  "VPS_ADMIN_PASSWORD1",
  "VPS_ADMIN_USER",
  "VPS_HOST",
  "VPS_ROOT_PASSWORD",
  "VPS_ROOT_USER",
  "VPS_SUPABASE_STUDIO_PASSWORD",
  "VPS_SUPABASE_STUDIO_URL",
  "VPS_SUPABASE_STUDIO_USERNAME"
]);

function read(relativePath: string): Record<string, string> {
  const filePath = path.join(repoRoot, relativePath);
  return fs.existsSync(filePath) ? parse(fs.readFileSync(filePath)) : {};
}

function pick(values: Record<string, string>, keys: Set<string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => keys.has(key)));
}

function omit(values: Record<string, string>, keys: Set<string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !keys.has(key)));
}

function encode(value: string): string {
  return JSON.stringify(value);
}

function write(relativePath: string, values: Record<string, string>): void {
  const filePath = path.join(envRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const body = Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encode(value)}`)
    .join("\n");
  fs.writeFileSync(filePath, `${body}\n`, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

const production = read(sources.production);
const local = read(sources.local);
const analytics = read(sources.analytics);
const indexing = read(sources.indexing);
if (indexing.GOOGLE_INDEXING_SERVICE_ACCOUNT_FILE === ".env.secrets/google-indexing-service-account.json") {
  indexing.GOOGLE_INDEXING_SERVICE_ACCOUNT_FILE =
    ".envs/secrets/google-indexing-service-account.json";
}
const homelab = read(sources.homelab);
const northflank = read(sources.northflank);
const northflankStats = read(sources.northflankStats);
const operator = read(sources.operator);

const classifiedProductionKeys = new Set([
  ...targetKeys,
  ...applicationKeys,
  ...contentKeys,
  ...distributionKeys
]);
const unexpectedProduction = Object.keys(omit(production, classifiedProductionKeys));
if (unexpectedProduction.length) {
  throw new Error(`Unclassified keys in .env: ${unexpectedProduction.join(", ")}`);
}

write("targets/production.env", pick(production, targetKeys));
write("targets/managed-dev.env", pick(local, targetKeys));
write("shared/application.env", pick(production, applicationKeys));
write("integrations/content.env", pick(production, contentKeys));
write("integrations/distribution.env", pick(production, distributionKeys));
write("operations/analytics.env", analytics);
write("pipelines/indexing.env", indexing);
write("pipelines/articles.env", pick(homelab, articlePipelineKeys));
write("infrastructure/homelab.env", pick(homelab, homelabKeys));
write("infrastructure/northflank.env", northflank);
write("infrastructure/northflank-stats.env", northflankStats);
write("infrastructure/cloudflare.env", pick(operator, cloudflareKeys));
write("infrastructure/dokploy.env", pick(operator, dokployKeys));
write("infrastructure/vps.env", pick(operator, vpsKeys));
write("operations/umami.env", pick(operator, new Set(["Umami_website_id"])));

const classifiedOperatorKeys = new Set([
  ...cloudflareKeys,
  ...dokployKeys,
  ...vpsKeys,
  "Umami_website_id"
]);
const unexpectedOperator = Object.keys(omit(operator, classifiedOperatorKeys));
if (unexpectedOperator.length) {
  throw new Error(`Unclassified keys in .env.codex: ${unexpectedOperator.join(", ")}`);
}
const unexpectedHomelab = Object.keys(omit(homelab, new Set([...articlePipelineKeys, ...homelabKeys])));
if (unexpectedHomelab.length) {
  throw new Error(`Unclassified keys in .env.homelab: ${unexpectedHomelab.join(", ")}`);
}

const legacySecretDirectory = path.join(repoRoot, ".env.secrets");
const newSecretDirectory = path.join(envRoot, "secrets");
if (fs.existsSync(legacySecretDirectory)) {
  if (fs.existsSync(newSecretDirectory) && fs.lstatSync(newSecretDirectory).isSymbolicLink()) {
    fs.unlinkSync(newSecretDirectory);
  }
  fs.mkdirSync(newSecretDirectory, { recursive: true, mode: 0o700 });
  fs.cpSync(fs.realpathSync(legacySecretDirectory), newSecretDirectory, {
    recursive: true,
    force: true,
    dereference: true
  });
}

console.log("Migrated every configured legacy env value into .envs/.");
console.log("Legacy files were not removed. Run npm run env:verify before cleanup.");
