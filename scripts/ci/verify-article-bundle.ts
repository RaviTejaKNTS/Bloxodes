import { createClient } from "@supabase/supabase-js";
import { resolveArticleDevCredentials } from "../articles/article-queue-env";
import { readReleaseArtifact } from "../articles/release-completed-articles";
async function main() {
const id = process.argv[2];
if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) throw new Error("An exact article queue ID is required.");
const dev = resolveArticleDevCredentials();
const db = createClient(dev.url, dev.serviceRole, { auth: { persistSession: false } });
const { data, error } = await db.from("article_generation_queue").select("id,article_title,workflow_mode,status,result_path,result_slug,production_url").eq("id", id).eq("workflow_mode", "agent_runner").single();
if (error || !["completed", "published"].includes(data.status)) throw new Error("The selected article has no completed queue approval.");
await readReleaseArtifact(data);
console.log(`Verified the unchanged article approval for ${id}.`);

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
