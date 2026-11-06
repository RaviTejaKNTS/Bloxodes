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
  const context = await loadCodesContext(sb, final.universe_id);
  const allowed = new Set(context.related_pages.map(row => `/codes/${row.slug}`));
  const links = [...final.interlinking_copy_md.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
  if (links.some(link => !allowed.has(link))) throw new Error("Interlink copy contains a link absent from codes:context");
  if (context.related_pages.length && !links.length) throw new Error("Interlink copy must link a related page from codes:context");
  const { data: overlaps, error } = await sb.from("code_pages").select("*").or(`universe_id.eq.${final.universe_id},slug.eq.${final.slug}`);
  if (error) throw new Error(`Overlap lookup failed: ${error.message}`);
  if ((overlaps ?? []).some(row => row.universe_id !== final.universe_id || row.slug !== final.slug) || (overlaps ?? []).length > 1) throw new Error("Slug or universe overlaps a different code page; review it first");
  let game = overlaps?.[0];
  if (target === "production") {
    const { assertLocalContentPublication } = await import("../shared/local-content-publication-guard");
    await assertLocalContentPublication();
  }
  const { publicCopyFindings } = await import("../content/check-public-copy");
  const findings = ["intro_md", "redeem_md", "troubleshoot_md", "rewards_md", "find_codes_md", "meta_description", "interlinking_copy_md"].flatMap(field =>
    publicCopyFindings({ description_md: final[field as keyof typeof final] }, field));
  if (findings.length) throw new Error(`Public copy check failed: ${JSON.stringify(findings)}`);
  const { ensureUniverseForRobloxLink } = await import("@/lib/roblox/universe");
  const identityResult = await ensureUniverseForRobloxLink(sb, final.roblox_link);
  if (identityResult.universeId !== final.universe_id) throw new Error("Roblox link did not resolve to the bundle universe");
  // Save identity and sources while unpublished. A killed publish can safely resume.
  const identity = { name: final.name, slug: final.slug, universe_id: final.universe_id, roblox_link: final.roblox_link,
    source_url: final.source_url, source_url_2: final.source_url_2, is_published: false };
  const result = game ? await sb.from("code_pages").update(identity).eq("id", game.id).select("*").single()
    : await sb.from("code_pages").insert(identity).select("*").single();
  if (result.error) throw new Error(`Draft write failed: ${result.error.message}`);
  game = result.data;
  const { publishFactoryCopy } = await import("../shared/code-page-pipeline");
  await publishFactoryCopy(game, final, final.universe_id, final.interlinking_copy_md);
  const verified = await sb.from("code_pages").select("is_published,universe_id").eq("id", game.id).single();
  if (verified.error || !verified.data?.is_published || verified.data.universe_id !== final.universe_id) throw new Error("Published row readback failed");
  console.log(`https://bloxodes.com/codes/${final.slug}`);
}
const timeout = setTimeout(() => { console.error("Codes command failed: whole-run deadline exceeded"); process.exit(1); }, 20 * 60_000);
main().catch(error => { console.error(`Codes command failed: ${error.message}`); process.exitCode = 1; }).finally(() => clearTimeout(timeout));
