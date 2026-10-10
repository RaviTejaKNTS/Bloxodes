import { existsSync } from "node:fs";
import { parseClaudeEffort } from "../shared/claude-stage-runner";
import { parseCodexReasoningEffort } from "./article-writer-provider";
import { isModelStage, type Stage } from "./article-pipeline";

export type ArticleStageConfig = { provider: "codex" | "claude"; model: string; effort: string };
export function articleClaudeBin(env: NodeJS.ProcessEnv): string {
  return env.ARTICLE_CLAUDE_BIN?.trim() || (existsSync("/home/teja/.local/bin/claude") ? "/home/teja/.local/bin/claude" : "claude");
}
export function articleStageConfig(stage: Stage, env: NodeJS.ProcessEnv, legacyValues?: { model: string; effort: string }): ArticleStageConfig {
  if (!isModelStage(stage)) throw new Error(`${stage} is not a model stage.`);
  const prefix = `ARTICLE_STAGE_${stage.toUpperCase()}`;
  const provider = env[`${prefix}_PROVIDER`]?.trim() || (["research_review", "image_review", "writing"].includes(stage) ? "claude" : "codex");
  if (provider !== "claude" && provider !== "codex") throw new Error(`${prefix}_PROVIDER must be codex or claude.`);
  // Legacy values are opt-in. An old installed 5.6 value must not defeat the stage defaults.
  const legacy = env.ARTICLE_STAGE_USE_LEGACY_CODEX_DEFAULTS === "true" && provider === "codex";
  const model = env[`${prefix}_MODEL`]?.trim() || (legacy ? (legacyValues?.model ?? env.ARTICLE_WRITER_CODEX_MODEL)?.trim() : "") || (provider === "claude" ? "claude-haiku-5-5" : "gpt-6-luna");
  const effort = env[`${prefix}_EFFORT`]?.trim() || (legacy ? (legacyValues?.effort ?? env.ARTICLE_WRITER_CODEX_REASONING_EFFORT)?.trim() : "") || (provider === "claude" ? "xhigh" : "max");
  if (provider === "claude") parseClaudeEffort(effort); else parseCodexReasoningEffort(effort);
  return { provider, model, effort };
}
export function articleStageTimeoutMs(stage: Stage, env: NodeJS.ProcessEnv, legacyDefaultMs = 45 * 60_000): number {
  const raw = env[`ARTICLE_STAGE_${stage.toUpperCase()}_TIMEOUT_MINUTES`];
  const defaultMs = ["writing", "editorial_review"].includes(stage) ? (stage === "writing" ? 90 : 60) * 60_000 : legacyDefaultMs;
  if (!raw?.trim()) return defaultMs;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) throw new Error(`ARTICLE_STAGE_${stage.toUpperCase()}_TIMEOUT_MINUTES must be 1-120.`);
  return minutes * 60_000;
}
