export const CODEX_REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;

export type CodexReasoningEffort = (typeof CODEX_REASONING_EFFORTS)[number];

export type CodexFallbackReason =
  | "authentication"
  | "model_unavailable"
  | "provider_unavailable"
  | "quota_or_rate_limit";

type CodexArgs = {
  worktree: string;
  model: string;
  reasoningEffort: CodexReasoningEffort;
  prompt: string;
};

type GrokArgs = {
  worktree: string;
  model: string;
  prompt: string;
  maxTurns: number;
};

export function parseCodexReasoningEffort(value: string): CodexReasoningEffort {
  if (CODEX_REASONING_EFFORTS.includes(value as CodexReasoningEffort)) {
    return value as CodexReasoningEffort;
  }
  throw new Error(
    `Codex reasoning effort must be one of: ${CODEX_REASONING_EFFORTS.join(", ")}.`
  );
}

export function buildCodexExecArgs(options: CodexArgs): string[] {
  return [
    "exec",
    "--cd",
    options.worktree,
    "--model",
    options.model,
    "--config",
    `model_reasoning_effort=${JSON.stringify(options.reasoningEffort)}`,
    "--approve-for-me",
    "--json",
    "--ephemeral",
    options.prompt
  ];
}

export function buildGrokExecArgs(options: GrokArgs): string[] {
  return [
    "--cwd",
    options.worktree,
    "--model",
    options.model,
    "--always-approve",
    "--single",
    options.prompt,
    "--max-turns",
    String(options.maxTurns),
    "--no-memory",
    "--no-alt-screen"
  ];
}

function flattenedCodexOutput(output: string): string {
  return output
    .split(/\r?\n/)
    .map((line) => {
      try {
        return JSON.stringify(JSON.parse(line));
      } catch {
        return line;
      }
    })
    .join("\n")
    .toLowerCase();
}

export function classifyCodexFallbackReason(output: string): CodexFallbackReason | null {
  const normalized = flattenedCodexOutput(output);
  if (
    /\b(401|authentication|unauthorized|not logged in|login required|invalid api key|token (?:has )?expired)\b/.test(
      normalized
    )
  ) {
    return "authentication";
  }
  if (
    /\b(model[_ -]not[_ -]found|model unavailable|does not have access to model|unsupported model|unknown model)\b/.test(
      normalized
    )
  ) {
    return "model_unavailable";
  }
  if (
    /\b(402|429|insufficient[_ -]quota|quota|rate[_ -]?limit|too many requests|usage limit|out of credits|billing limit)\b/.test(
      normalized
    )
  ) {
    return "quota_or_rate_limit";
  }
  if (
    /\b(502|503|504|enoent|no such file or directory|service unavailable|temporarily unavailable|provider unavailable|overloaded|capacity|connection reset|connection refused|dns|network unreachable)\b/.test(
      normalized
    )
  ) {
    return "provider_unavailable";
  }
  return null;
}

export function fallbackTargetCount(batchTarget: number, activityCount: number): number {
  return Math.max(0, batchTarget - Math.max(0, activityCount));
}
