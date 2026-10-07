import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { resolveArticleDevCredentials } from "../articles/article-queue-env";
import { resolveReleaseArtifactPath } from "../articles/release-completed-articles";
import { dispatchContentBundle, folderInputs } from "./dispatch-content-bundle";

export async function dispatchArticle(queueId: string, root: string) {
  if (!/^[0-9a-f-]{36}$/i.test(queueId)) throw new Error("Select an exact article queue ID.");
  const dev = resolveArticleDevCredentials();
  const db = createClient(dev.url, dev.serviceRole, { auth: { persistSession: false } });
  const { data: row, error } = await db.from("article_generation_queue").select("id,status,result_slug,result_path").eq("id", queueId).eq("workflow_mode", "agent_runner").single();
  if (error || row.status !== "completed" || !row.result_slug || !row.result_path || path.isAbsolute(row.result_path)) throw new Error("The selected article is not completed.");
  const final = await resolveReleaseArtifactPath(path.join(root, row.result_path), queueId, row.result_slug, root);
  const relativeRun = row.result_path.startsWith("tmp/article-pipeline/") ? path.dirname(path.dirname(row.result_path)) : path.dirname(row.result_path);
  const sourceRun = row.result_path.startsWith("tmp/article-pipeline/") ? path.dirname(path.dirname(final)) : path.dirname(final);
  const copy = JSON.parse(await fs.readFile(final, "utf8"));
  const inputs = await folderInputs(path.dirname(final), path.dirname(row.result_path));
  if (row.result_path.startsWith("tmp/article-pipeline/")) for (const name of ["state.json", "editorial_review.json"]) inputs.push({source: path.join(sourceRun, name), destination: `${relativeRun}/${name}`});
  return dispatchContentBundle({ version: 1, operations: [{ publisher: "article-queue", queueId, file: row.result_path }], urls: [{ path: `/articles/${row.result_slug}`, contains: copy.title }], events: [{ type: "article", slug: row.result_slug }] }, inputs);
}
