import path from "node:path";

export const PI_WRITER_PROVIDER = "openai-codex";
export const PI_WRITER_MODEL = "gpt-5.6-luna";
export const PI_WRITER_REASONING = "max";
export const PI_WRITER_PACKAGE = "@earendil-works/pi-coding-agent";
export const PI_WRITER_MIN_VERSION = "0.84.3";

export const PI_WRITER_SYSTEM_PROMPT =
  "You are a Roblox gamer writing for other Roblox players in clear, simple Indian English. Share practical player experience where appropriate, but never invent first-hand experience.\n" +
  "Follow the provided Bloxodes writing skill exactly, use tools only inside the current article workspace, and write only final.json. Never mention sources, research, competitors, or the writing process in public copy.";

export const PI_WRITER_SKILLS = [
  ".agents/skills/bloxodes-article-writing/SKILL.md",
  ".agents/skills/bloxodes-tech-article-writing/SKILL.md",
  ".agents/skills/bloxodes-tier-list-writing/SKILL.md"
] as const;

export type PiWriterSkill = (typeof PI_WRITER_SKILLS)[number];

export function parsePiWriterSkill(value: string): PiWriterSkill {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  if (PI_WRITER_SKILLS.includes(normalized as PiWriterSkill)) return normalized as PiWriterSkill;
  throw new Error(`Pi writer skill must be one of: ${PI_WRITER_SKILLS.join(", ")}.`);
}

export function assertLunaMaxConfiguration(model: string, reasoning: string, label: string): void {
  if (model !== PI_WRITER_MODEL || reasoning !== PI_WRITER_REASONING) {
    throw new Error(
      `${label} must use ${PI_WRITER_MODEL} at ${PI_WRITER_REASONING} reasoning; received ${model} at ${reasoning}.`
    );
  }
}

export function assertPiVersion(output: string): string {
  const match = output.match(/\b(\d+)\.(\d+)\.(\d+)\b/);
  if (!match) throw new Error(`Could not parse Pi version from ${JSON.stringify(output.trim())}.`);
  const actual = match.slice(1).map(Number);
  const minimum = PI_WRITER_MIN_VERSION.split(".").map(Number);
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) return match[0];
    if (actual[index] < minimum[index]) {
      throw new Error(`Pi ${PI_WRITER_MIN_VERSION} or newer is required for max reasoning; found ${match[0]}.`);
    }
  }
  return match[0];
}

export function assertArticleWorkspace(repoRoot: string, workspace: string): string {
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedWorkspace = path.resolve(workspace);
  const contentRoot = path.join(resolvedRoot, "tmp", "content-workspace");
  const relative = path.relative(contentRoot, resolvedWorkspace);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Article workspace must be below ${contentRoot}.`);
  }
  return resolvedWorkspace;
}

export function buildPiWriterPrompt(input: {
  skill: PiWriterSkill;
  title: string;
  slug: string;
  type: string;
  workspace: string;
}): string {
  return `Skill: ${input.skill}\nArticle: ${JSON.stringify({
    title: input.title,
    slug: input.slug,
    type: input.type,
    workspace: input.workspace
  })}`;
}

export function buildPiWriterArgs(input: {
  repoRoot: string;
  skill: PiWriterSkill;
  prompt: string;
  provider?: string;
  model?: string;
  reasoning?: string;
}): string[] {
  const provider = input.provider ?? PI_WRITER_PROVIDER;
  const model = input.model ?? PI_WRITER_MODEL;
  const reasoning = input.reasoning ?? PI_WRITER_REASONING;
  assertLunaMaxConfiguration(model, reasoning, "Pi article writing");

  const explicitSkills = input.skill === PI_WRITER_SKILLS[0]
    ? [input.skill]
    : [PI_WRITER_SKILLS[0], input.skill];
  const skillArgs = explicitSkills.flatMap((skill) => ["--skill", path.join(input.repoRoot, skill)]);

  return [
    "-p",
    "--provider",
    provider,
    "--model",
    model,
    "--thinking",
    reasoning,
    "--system-prompt",
    PI_WRITER_SYSTEM_PROMPT,
    "--no-context-files",
    "--no-extensions",
    "--no-skills",
    ...skillArgs,
    "--no-prompt-templates",
    "--no-themes",
    "--no-session",
    "--no-approve",
    "--tools",
    "read,write,edit,grep,find,ls",
    "--",
    input.prompt
  ];
}
