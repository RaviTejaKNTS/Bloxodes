export const CODEX_REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;

export type CodexReasoningEffort = (typeof CODEX_REASONING_EFFORTS)[number];

type CodexArgs = {
  worktree: string;
  model: string;
  reasoningEffort: CodexReasoningEffort;
  prompt: string;
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
