import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { decodeBundle, extractBundle } from "./content-bundle.mjs";
import { parseBatch } from "./content-contract.mjs";

async function main() {
const hash = process.env.BUNDLE_HASH;
if (!/^[0-9a-f]{64}$/.test(hash ?? "")) throw new Error("An exact content bundle hash is required.");
if (process.env.ARTICLE_DEV_SUPABASE_URL !== "https://bbtcaurrtyoukvjbxbbj.supabase.co") throw new Error("Unexpected bundle source project.");
const sb = createClient(process.env.ARTICLE_DEV_SUPABASE_URL, process.env.ARTICLE_DEV_SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false } });
const { data, error } = await sb.storage.from("ci-release-bundles").download(`${hash}.json`);
if (error || !data) throw new Error("The selected private content bundle is unavailable.");
const bundle = decodeBundle(Buffer.from(await data.arrayBuffer()), hash);
parseBatch(bundle.batch);
const base = `content/releases/${hash}`;
if (fs.existsSync(base)) throw new Error("Frozen bundle destination already exists.");
fs.mkdirSync(path.dirname(base), { recursive: true });
await extractBundle(bundle, base);
fs.appendFileSync(process.env.GITHUB_ENV!, `BATCH=${base}/batch.json\nBLOXODES_VERIFIED_BUNDLE=${hash}\n`);
console.log(`Loaded exact private content bundle ${hash}.`);

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
