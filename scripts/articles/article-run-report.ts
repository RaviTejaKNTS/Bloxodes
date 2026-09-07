import { createReadStream } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { saveJson, type PipelineState } from "./article-pipeline";

export async function writeArticleRunReport(runDir: string, model: string, reasoning: string) {
  const state: PipelineState = JSON.parse(await readFile(path.join(runDir, "state.json"), "utf8"));
  const attempts: any[] = [];
  for (const name of await readdir(path.join(runDir, "attempts")).catch(() => [])) {
    const dir = path.join(runDir, "attempts", name);
    let timing;
    try { timing = JSON.parse(await readFile(path.join(dir, "timing.json"), "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    const usage: Record<string, number> = {};
    try {
      for await (const line of createInterface({ input: createReadStream(path.join(dir, "codex-events.jsonl")), crlfDelay: Infinity })) {
        try {
          const event = JSON.parse(line);
          if (event.type === "turn.completed" && event.usage) for (const [key, value] of Object.entries(event.usage)) if (typeof value === "number") usage[key] = (usage[key] ?? 0) + value;
        } catch { /* Runtime or CLI text, not a usage event. */ }
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    attempts.push({ attempt: name, ...timing, usage });
  }
  attempts.sort((a, b) => a.started_at.localeCompare(b.started_at));
  await saveJson(path.join(runDir, "run-report.json"), {
    job_id: state.job.id, slug: state.job.slug, status: state.status, stage: state.stage,
    model, reasoning, origin: state.origin ?? null, feedback: state.feedback,
    started_at: attempts[0]?.started_at ?? null, finished_at: attempts.at(-1)?.finished_at ?? null,
    wall_ms: attempts.length ? Date.parse(attempts.at(-1).finished_at) - Date.parse(attempts[0].started_at) : 0,
    active_ms: attempts.reduce((sum, attempt) => sum + attempt.elapsed_ms, 0), attempts,
    timing_note: "Includes every recorded attempt and failed attempt; wall time includes gaps between attempts. Earlier legacy attempts without timing.json are excluded. Token usage is CLI-reported, not a dollar estimate."
  });
}
