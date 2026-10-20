import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadBloxodesEnv } from "../shared/env-files";

export type ContentOptions = {
  command: "publish" | "status" | "candidates" | "deployed-sha";
  target: "managed-dev" | "production";
  apply: boolean;
  allowProd: boolean;
  bundle?: string;
  game?: string;
  only?: string[];
};

export function parseContentOptions(argv: string[]): ContentOptions {
  const command = argv[0];
  if (command !== "publish" && command !== "status" && command !== "candidates" && command !== "deployed-sha") {
    throw new Error("Expected publish, status, candidates or deployed-sha.");
  }
  const options: ContentOptions = { command, target: "managed-dev", apply: false, allowProd: false };
  const seen = new Set<string>();
  for (let index = 1; index < argv.length; index += 1) {
    const raw = argv[index];
    const [flag, inline] = raw.split(/=(.*)/s, 2);
    if (!raw.startsWith("--")) {
      if (command !== "publish" || options.bundle) throw new Error(`Unexpected argument: ${raw}`);
      options.bundle = raw;
      continue;
    }
    if (seen.has(flag) && flag !== "--only") throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === "--apply" || flag === "--allow-prod") {
      if (inline !== undefined) throw new Error(`${flag} takes no value.`);
      if (flag === "--apply") options.apply = true;
      else options.allowProd = true;
      continue;
    }
    if (!["--target", "--bundle", "--game", "--only"].includes(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = inline ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value.`);
    if (flag === "--only") {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error("--only must be hub or a collection slug.");
      (options.only ??= []).push(value);
    } else if (flag === "--target") {
      if (value !== "managed-dev" && value !== "production") throw new Error("--target must be managed-dev or production.");
      options.target = value;
    } else if (flag === "--bundle") {
      if (options.bundle) throw new Error("Supply one bundle folder.");
      options.bundle = value;
    } else options.game = value;
  }
  if (command === "publish" && !options.bundle) throw new Error("Supply a bundle folder, for example: npm run content:publish -- /path/to/game-bundle");
  if (command !== "publish" && (options.bundle || options.apply || options.allowProd || options.only)) throw new Error(`${command} is read-only; bundle, --only and apply flags are invalid.`);
  if (command === "deployed-sha" && seen.size) throw new Error("deployed-sha takes no options.");
  if (command === "status" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.game ?? "")) throw new Error("status requires --game <editorial-slug>.");
  if (command !== "status" && options.game) throw new Error("--game is only valid for status. Publish identity belongs in bundle.json.");
  if (options.allowProd && (!options.apply || options.target !== "production")) throw new Error("--allow-prod requires --target production --apply.");
  if (options.apply && options.target === "production" && !options.allowProd) throw new Error("Production apply requires --allow-prod.");
  return options;
}

async function main() {
  if (process.argv.includes("--help")) {
    const { PUBLICATION_RELEVANT_PATHS } = await import("../shared/local-content-publication-guard");
    console.log(`npm run content:publish -- <bundle-folder> [--only hub|<collection-slug>]... [--target managed-dev|production] [--apply [--allow-prod]]
npm run content:publish -- /abs/game-bundle --only pets
npm run content:publish -- /abs/game-bundle --only hub --only pets --target production --apply --allow-prod
npm run content:status -- --game <editorial-slug> [--target managed-dev|production]
npm run content:candidates -- [--target managed-dev|production]
npm run --silent content:deployed-sha
Default target: managed-dev. Publication defaults to a read-only dry run.
Run from the device's normal main checkout of Bloxodes.
Production dry runs and applies fetch origin/production; both HEAD and the healthy deployed SHA must be ancestors of origin/production.
SHA differences are allowed only outside these publish-relevant paths: ${PUBLICATION_RELEVANT_PATHS.join(", ")}.
For relevant differences, wait for the deploy if HEAD is ahead, or pull origin/production if HEAD is behind.
Tracked files must have no modified or staged changes. Untracked files are allowed.
The production migration ledger must be ready. The guard repeats immediately before writes; it never checks out, pulls or resets the checkout.
Record missingImages [{slug, reason}] in each collection's runtime-manifest.json or bundle entry.
Both arrays merge; conflicting reasons fail. --only uses the selected collection's decisions.`);
    return;
  }
  const options = parseContentOptions(process.argv.slice(2));
  if (options.command === "deployed-sha") {
    const { deployedContentSha } = await import("../shared/local-content-publication-guard");
    console.log(await deployedContentSha());
    return;
  }
  if (process.env.BLOXODES_ENV_PROFILE !== "process-only") {
    process.env.BLOXODES_ENV_PROFILE = options.target === "production" ? "production-preview" : "managed-dev";
  }
  if (options.target === "production") {
    const overlays = new Set((process.env.BLOXODES_ENV_OVERLAYS ?? "").split(",").filter(Boolean));
    overlays.add("vps");
    process.env.BLOXODES_ENV_OVERLAYS = [...overlays].join(",");
  }
  loadBloxodesEnv();
  const { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } = await import("../shared/supabase-target");
  const matches = options.target === "production" ? isProductionSupabaseUrl : isManagedDevelopmentSupabaseUrl;
  if (options.target === "production" && process.env.SUPABASE_URL?.replace(/\/$/, "") !== "https://database.bloxodes.com") throw new Error("content:publish production requires https://database.bloxodes.com.");
  if (options.target === "production") process.env.SUPABASE_URL = "https://database.bloxodes.com";
  if (!matches(process.env.SUPABASE_URL)) throw new Error(`Loaded SUPABASE_URL does not match --target ${options.target}. Fix the selected target credentials.`);
  if (!process.env.SUPABASE_SERVICE_ROLE) throw new Error("Missing SUPABASE_SERVICE_ROLE for the selected target.");
  const { publishBundle, contentStatus, contentCandidates } = await import("./roblox-wiki-publish");
  if (options.command === "publish") await publishBundle(options);
  else if (options.command === "status") await contentStatus(options);
  else await contentCandidates();
}

// Importing the parser in GitHub tests must not load credentials or run commands.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main().catch(error => {
  let message = error instanceof Error ? error.message : String(error);
  for (const key of ["SUPABASE_SERVICE_ROLE", "WIKI_R2_ACCESS_KEY_ID", "WIKI_R2_SECRET_ACCESS_KEY", "REVALIDATE_SECRET", "VPS_SUPABASE_STUDIO_PASSWORD"]) {
    const secret = process.env[key];
    if (secret) message = message.split(secret).join("[redacted]");
  }
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
});
