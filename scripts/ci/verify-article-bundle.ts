import { createClient } from "@supabase/supabase-js";
import { resolveArticleDevCredentials } from "../articles/article-queue-env";
import { readReleaseArtifact } from "../articles/release-completed-articles";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseBatch, ownedPath, batchPath } from "./content-contract.mjs";
import { assertArticleSelection } from "./article-publication-binding.mjs";
async function main() {
const id = process.argv[2];
if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) throw new Error("An exact article queue ID is required.");
const dev = resolveArticleDevCredentials();
const db = createClient(dev.url, dev.serviceRole, { auth: { persistSession: false } });
const { data, error } = await db.from("article_generation_queue").select("id,article_title,workflow_mode,status,result_path,result_slug,production_url").eq("id", id).eq("workflow_mode", "agent_runner").single();
if (error || !["completed", "published"].includes(data.status)) throw new Error("The selected article has no completed queue approval.");
const selectedFile = process.argv[3];
const batch = parseBatch(JSON.parse(await readFile(batchPath(process.argv[4]),"utf8")));
const operation = batch.operations.find((item: any) => item.publisher === "article-queue" && item.queueId === id && item.file === selectedFile);
if (!operation) throw new Error("The exact article operation is missing from the reviewed batch.");
const artifact = await readReleaseArtifact(data, undefined, { SUPABASE_URL: dev.url });
const root = process.env.BLOXODES_ARTIFACT_ROOT || process.cwd();
const selectedPath = await realpath(path.resolve(ownedPath(root,selectedFile)));
const selectedBytes = await readFile(selectedPath);
const approvedBytes = await readFile(artifact.finalPath);
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
assertArticleSelection(data,operation,
  {realPath: selectedPath,hash: hash(selectedBytes),slug: JSON.parse(selectedBytes.toString("utf8")).slug},
  {realPath: artifact.finalPath,hash: hash(approvedBytes),slug: artifact.finalJson.slug},batch);
console.log(`Verified the unchanged article approval for ${id}.`);

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
