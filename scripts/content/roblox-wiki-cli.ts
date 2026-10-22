import { formatPublishError } from "../shared/publish-network.mjs";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadBloxodesEnv } from "../shared/env-files";
import { assertApprovedHubCoverScope, parseContentOptions, type ContentOptions } from "./wiki-content-options";

export { parseContentOptions, type ContentOptions };

async function main() {
  if (process.argv.includes("--help")) {
    const { PUBLICATION_RELEVANT_PATHS } = await import("../shared/local-content-publication-guard");
    console.log(`npm run content:publish -- <bundle-folder> [--only hub|<collection-slug>]... [--approved-hub-cover-sha256 <64-hex>] [--target managed-dev|production] [--apply [--allow-prod]]
npm run content:publish -- /abs/game-bundle --only pets
npm run content:publish -- /abs/game-bundle --only hub --only pets --target production --apply --allow-prod
npm run content:status -- [--namespace <namespace> [--kind game|franchise]] --game <editorial-slug> [--target managed-dev|production]
npm run content:candidates -- [--target managed-dev|production]
npm run --silent content:deployed-sha
Supported contracts: roblox-wiki@1 and game-wiki@1. See contracts/<contract>/v1/.
Default target: managed-dev. Publication defaults to a read-only dry run.
Run from the device's normal main checkout of Bloxodes.
Production dry runs and applies fetch origin/production; both HEAD and the healthy deployed SHA must be ancestors of origin/production.
SHA differences are allowed only outside these publish-relevant paths: ${PUBLICATION_RELEVANT_PATHS.join(", ")}.
For relevant differences, wait for the deploy if HEAD is ahead, or pull origin/production if HEAD is behind.
Tracked files must have no modified or staged changes. Untracked files are allowed.
The production migration ledger must be ready. The guard repeats immediately before writes; it never checks out, pulls or resets the checkout.
Record missingImages [{slug, reason}] in each collection's runtime-manifest.json or bundle entry.
Both arrays merge; conflicting reasons fail. --only uses the selected collection's decisions.
--approved-hub-cover-sha256 approves only the exact local hub.coverImage bytes for this invocation.
It requires a selected Roblox hub; franchise bundles, collections-only runs and read-only commands reject it.
Without it, a local cover must match the current official thumbnail bytes. All image and production checks remain.`);
    return;
  }
  const options = parseContentOptions(process.argv.slice(2));
  if (options.command === "deployed-sha") {
    const { deployedContentSha } = await import("../shared/local-content-publication-guard");
    console.log(await deployedContentSha());
    return;
  }
  let contract: "roblox-wiki@1" | "game-wiki@1" | undefined;
  if (options.command === "publish") {
    const { readWikiContract } = await import("../shared/wiki-publish-contract");
    contract = await readWikiContract(options.bundle!);
    if (contract === "game-wiki@1") assertApprovedHubCoverScope(options, contract);
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
  if (options.command === "publish") {
    if (contract === "game-wiki@1") {
      const { publishGameBundle } = await import("./game-wiki-publish");
      await publishGameBundle(options);
    } else await publishBundle(options);
  } else if (options.command === "status" && options.namespace) {
    const { gameContentStatus } = await import("./game-wiki-publish");
    await gameContentStatus(options);
  } else if (options.command === "status") await contentStatus(options);
  else await contentCandidates();
}

// Importing the parser in GitHub tests must not load credentials or run commands.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main().catch(error => {
  console.error(`FAIL: ${formatPublishError(error)}`);
  process.exitCode = 1;
});
