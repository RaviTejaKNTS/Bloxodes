// Select the env profile before importing modules that construct database clients.
import { loadBloxodesEnv, readBloxodesEnvFile } from "../shared/env-files";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { codePageFinalSchema } from "./final-contract";

async function main() {
  const args = process.argv.slice(2);
  const get = (key: string) => args[args.indexOf(key) + 1];
  const publish = args[0] === "publish";
  const target = args.includes("--target") ? get("--target") : publish ? "development" : "production";
  if (!["production", "development"].includes(target)) throw new Error("--target must be production or development");
  process.env.BLOXODES_ENV_PROFILE = target === "production" ? "production-preview" : "managed-dev";
  loadBloxodesEnv();
  // Explicit target selection must win over inherited credentials.
  const targetEnv = readBloxodesEnvFile(`targets/${target === "production" ? "production" : "managed-dev"}.env`);
  if (!targetEnv.SUPABASE_URL || !targetEnv.SUPABASE_SERVICE_ROLE) throw new Error("Target env is missing Supabase credentials");
  Object.assign(process.env, targetEnv);
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30_000) }) }
  });
  const { loadCodesContext } = await import("./factory-context");
  if (!publish) {
    const universe = Number(get("--universe"));
    if (!args.includes("--universe") || !Number.isSafeInteger(universe) || universe <= 0) throw new Error("--universe requires a positive ID");
    console.log(JSON.stringify(await loadCodesContext(sb, universe), null, 2));
    return;
  }
  if (!args.includes("--bundle")) throw new Error("--bundle is required");
  const final = codePageFinalSchema.parse(JSON.parse(await readFile(path.resolve(get("--bundle"), "final.json"), "utf8")));
  const { publishCodesBundle } = await import("./factory-publication");
  const { publicCopyFindings } = await import("../content/check-public-copy");
  await publishCodesBundle(sb, final, {
    context: () => loadCodesContext(sb, final.universe_id),
    guard: async () => {
      if (target === "production") {
        const { assertLocalContentPublication } = await import("../shared/local-content-publication-guard");
        await assertLocalContentPublication();
      }
    },
    publicCopyFindings,
    ensureIdentity: async link => {
      const { ensureUniverseForRobloxLink } = await import("@/lib/roblox/universe");
      return ensureUniverseForRobloxLink(sb, link);
    },
    prepare: async (game, fingerprint, linkedIds) => {
      const { publishFactoryCopy } = await import("../shared/code-page-pipeline");
      await publishFactoryCopy(game, final, final.universe_id, final.interlinking_copy_md, fingerprint, linkedIds);
    }
  });
  console.log(`https://bloxodes.com/codes/${final.slug}`);
}
const timeout = setTimeout(() => { console.error("Codes command failed: whole-run deadline exceeded"); process.exit(1); }, 20 * 60_000);
main().catch(error => { console.error(`Codes command failed: ${error.message}`); process.exitCode = 1; }).finally(() => clearTimeout(timeout));
