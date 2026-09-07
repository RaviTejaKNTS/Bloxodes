import "../shared/load-env";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { resolveArticleDevCredentials } from "./article-queue-env";
import { saveJson } from "./article-pipeline";
async function main() {
const dev = resolveArticleDevCredentials();
const db = createClient(dev.url, dev.serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.from("article_generation_queue").select("id,status,last_error,next_attempt_at,locked_at,last_attempted_at")
  .eq("workflow_mode", "agent_runner").in("status", ["blocked", "failed", "processing"])
  .order("last_attempted_at", { ascending: false }).limit(100);
if (error) throw new Error(`Article health query failed: ${error.message}`);
const recent = Date.now() - 24 * 3600_000;
const issues = (data ?? []).filter(row => row.status === "processing" ? Date.parse(row.locked_at) < Date.now() - 6 * 3600_000 : Date.parse(row.last_attempted_at) >= recent)
  .map(row => ({ id: row.id, status: row.status, reason: row.last_error, retryAt: row.next_attempt_at }));
let scheduleIssue: string | null = null;
try {
  const timers = JSON.parse(execFileSync("systemctl", ["list-timers", "bloxodes-article-discovery.timer", "--all", "--output=json"], { encoding: "utf8" }));
  const last = Number(timers.find((timer: any) => timer.unit === "bloxodes-article-discovery.timer")?.last) / 1000;
  if (!Number.isFinite(last) || Date.now() - last > 7 * 3600_000) scheduleIssue = "Discovery timer has no trigger within seven hours.";
} catch { scheduleIssue = "Cannot inspect the installed discovery timer."; }
await saveJson(path.join(process.cwd(), "tmp/article-publication/automation-health.json"), { checkedAt: new Date().toISOString(), scheduleIssue, issues });
if (issues.length || scheduleIssue) { console.error(JSON.stringify({ alert: "Article automation needs attention", scheduleIssue, issues })); process.exitCode = 1; }
else console.log("Article automation audit: no recent blocked work or missed timer trigger.");

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
