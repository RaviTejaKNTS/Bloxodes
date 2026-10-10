import { parseCodexReasoningEffort } from "../articles/article-writer-provider";
import { parseClaudeEffort } from "../shared/claude-stage-runner";

export const WIKI_STAGES = ["collection_suggestions", "collection_research", "collection_research_review", "collection_data", "collection_data_review", "collection_images", "collection_image_review", "collection_writing", "collection_editorial_review", "hub_research", "hub_research_review", "hub_writing", "hub_editorial_review"] as const;
export type WikiStage = typeof WIKI_STAGES[number];
export type WikiStageConfig = { provider: "codex" | "claude"; model: string; effort: string; timeoutMs: number };
const claudeStages = new Set<WikiStage>(["collection_research_review", "collection_data_review", "collection_image_review", "collection_writing", "hub_research_review", "hub_writing"]);
export const isWikiReview = (stage: WikiStage) => stage.endsWith("_review");
export const wikiClaudeBin = (env: NodeJS.ProcessEnv) => env.WIKI_CLAUDE_BIN?.trim() || "/home/teja/.local/bin/claude";

export function wikiStageConfig(stage: WikiStage, env: NodeJS.ProcessEnv): WikiStageConfig {
  const prefix = `WIKI_STAGE_${stage.toUpperCase()}`;
  const provider = env[`${prefix}_PROVIDER`]?.trim() || (claudeStages.has(stage) ? "claude" : "codex");
  if (provider !== "codex" && provider !== "claude") throw new Error(`${prefix}_PROVIDER must be codex or claude.`);
  // Old installed model values must not silently replace the owner's new split.
  const legacy = provider === "codex" && env.WIKI_STAGE_USE_LEGACY_CODEX_DEFAULTS === "true";
  const model = env[`${prefix}_MODEL`]?.trim() || (legacy ? env.WIKI_AUTOMATION_CODEX_MODEL?.trim() : "") || (provider === "claude" ? "claude-haiku-5-5" : "gpt-6-luna");
  const effort = env[`${prefix}_EFFORT`]?.trim() || (legacy ? env.WIKI_AUTOMATION_CODEX_REASONING?.trim() : "") || (provider === "claude" ? "xhigh" : "max");
  if (provider === "claude") parseClaudeEffort(effort); else parseCodexReasoningEffort(effort);
  const minutes = Number(env[`${prefix}_TIMEOUT_MINUTES`] || (stage.endsWith("writing") ? 90 : isWikiReview(stage) ? 60 : 45));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) throw new Error(`${prefix}_TIMEOUT_MINUTES must be 1-120.`);
  return { provider, model, effort, timeoutMs: minutes * 60_000 };
}
