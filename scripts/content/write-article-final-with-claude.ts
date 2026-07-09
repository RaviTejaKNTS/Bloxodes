import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

type CliOptions = {
  topic: string;
  article: string;
  articlesRoot: string;
  promptOut: string | null;
  run: boolean;
  checkOutput: boolean;
  tech: boolean;
  claudeCommand: string;
  claudeArgs: string[];
};

type ArticleFinal = {
  title?: unknown;
  slug?: unknown;
  meta_description?: unknown;
  content_md?: unknown;
  faq_json?: unknown;
  cover_image?: unknown;
  author_id?: unknown;
  universe_id?: unknown;
  tags?: unknown;
  sources?: unknown;
  is_published?: unknown;
  seo_title?: unknown;
};

const PUBLIC_COPY_KEYS = ["title", "meta_description", "content_md", "faq_json"];
const HYPE_WORDS = /\b(ultimate|insane|amazing|epic|must-have|game-changer)\b/i;
const DEFAULT_CLAUDE_ARGS = ["--model", "opus", "--effort", "high", "--permission-mode", "acceptEdits", "-p"];

function printUsage() {
  console.log(`Usage:
  npm run write:article:claude -- --topic <game-or-topic-slug> --article <article-slug> [options]

Options:
  --articles-root <dir>     Defaults to tmp/content-workspace/<topic>/articles.
  --prompt-out <file>       Defaults to <articles-root>/<article-slug>/claude-writing-prompt.md.
  --tech                    Use the Claude tech article writing skill.
  --run                     Invoke Claude after writing the handoff prompt.
  --check-output            Validate an existing final.json without invoking Claude.
  --claude-command <cmd>    Defaults to CLAUDE_COMMAND or claude.
  --claude-arg <arg>        Repeat to override Claude args. Defaults to --model opus --effort high --permission-mode acceptEdits -p.

Default behavior writes the Claude handoff prompt only. Use --run when the Claude CLI is available.`);
}

function parseArgs(argv: string[]): CliOptions {
  let topic: string | null = null;
  let article: string | null = null;
  let articlesRoot: string | null = null;
  let promptOut: string | null = null;
  let run = false;
  let checkOutput = false;
  let tech = false;
  let claudeCommand = process.env.CLAUDE_COMMAND || "claude";
  const claudeArgs: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--topic":
      case "--topic-slug":
      case "--game":
      case "--game-slug":
        topic = requireValue(argv, ++i, arg);
        break;
      case "--article":
      case "--article-slug":
      case "--slug":
        article = requireValue(argv, ++i, arg);
        break;
      case "--articles-root":
      case "--article-root":
      case "--final-json-root":
      case "--final-json-dir":
        articlesRoot = requireValue(argv, ++i, arg);
        break;
      case "--prompt-out":
        promptOut = requireValue(argv, ++i, arg);
        break;
      case "--tech":
      case "--tech-article":
        tech = true;
        break;
      case "--run":
        run = true;
        break;
      case "--check-output":
        checkOutput = true;
        break;
      case "--claude-command":
        claudeCommand = requireValue(argv, ++i, arg);
        break;
      case "--claude-arg":
        claudeArgs.push(requireRawValue(argv, ++i, arg));
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!topic) throw new Error("--topic is required");
  if (!article) throw new Error("--article is required");

  const normalizedTopic = slugifyInput(topic, "--topic");
  const normalizedArticle = slugifyInput(article, "--article");

  return {
    topic: normalizedTopic,
    article: normalizedArticle,
    articlesRoot: articlesRoot ?? path.join("tmp", "content-workspace", normalizedTopic, "articles"),
    promptOut,
    run,
    checkOutput,
    tech,
    claudeCommand,
    claudeArgs: claudeArgs.length ? claudeArgs : DEFAULT_CLAUDE_ARGS,
  };
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${option}`);
  return value;
}

function requireRawValue(argv: string[], index: number, option: string): string {
  const value = argv[index];
  if (!value) throw new Error(`Missing value for ${option}`);
  return value;
}

function slugifyInput(value: string, option: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(`${option} must be a slug, got ${value}`);
  }
  return normalized;
}

function resolveRepoPath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

async function pathExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function buildPrompt(options: CliOptions, paths: { brief: string; finalJson: string; skill: string }): string {
  const relativeBrief = path.relative(process.cwd(), paths.brief);
  const relativeFinalJson = path.relative(process.cwd(), paths.finalJson);
  const relativeSkill = path.relative(process.cwd(), paths.skill);
  const articleType = options.tech ? "tech / platform / troubleshooting article" : "article";

  return `You are Claude writing one approved Bloxodes ${articleType} final.json.

Use the Bloxodes article writing skill exactly:
- Skill: ${relativeSkill}
- Topic slug: ${options.topic}
- Article slug: ${options.article}
- Approved brief: ${relativeBrief}
- Output file: ${relativeFinalJson}

Boundaries:
- Do not run the workflow runner.
- Do not spawn or call subagents.
- Do not redo first-pass research unless the approved brief itself has an unresolved gap that blocks writing.
- Read the approved brief first, then write only the final.json for this article.
- If the brief is not approved, weak, or has unresolved source gaps, stop and report that blocker instead of writing around it.
- After you write final.json, Codex may review and directly fix tiny non-content metadata or JSON issues such as slug/source URL/tag/schema/ID/null-field mistakes. Codex should not rewrite your body copy, FAQ copy, structure, tone, or substantive claims; those changes should come back to you as feedback.

Writing requirements:
- Write like a Roblox player or platform helper explaining the topic to another player.
- Keep the copy simple, warm, concrete, and human friendly.
- Avoid generic page filler, AI-ish contrast phrases, hype words, and textbook voice.
- Open on the real topic, action, problem, or answer. No warm-up lines.
- Every sentence must add value. Cut repetition.
- Keep paragraphs short and easy to scan.
- Do not mention sources, competitors, research, databases, internal notes, Bloxodes, or page usage in public copy.
- Do not use self-referential phrases like "this article", "this guide", or "this page".
- Do not use em dashes.
- Use q/a keys for faq_json entries, not question/answer.
- Do not include seo_title. The articles table does not use it.
- Keep sources as the URLs that support important facts. Do not pad them.
- For game-linked articles, include the game name in the title and slug, set universe_id when the brief or existing data supports it, and never use roblox_universes.slug as the article slug.
${options.tech ? "- For tech/troubleshooting topics, follow the tech skill: easiest fixes first, numbered H3 fixes when useful, no browser-player advice, no invented menu paths, no dated freshness claims." : ""}

Required second pass before you stop:
1. Reopen the final.json you wrote.
2. Check that JSON parses.
3. Revise once for human-friendly voice: specific, easy to read, not generic, and genuinely useful.
4. Check again for no source/research/database/internal/page wording, no self-referential article/page/guide phrasing, no em dashes, no hype words, correct faq_json keys, useful links, and valid slugs.
5. Return a short note with the final.json path and any remaining risk.`;
}

async function writePrompt(promptFile: string, prompt: string) {
  await fs.mkdir(path.dirname(promptFile), { recursive: true });
  await fs.writeFile(promptFile, `${prompt}\n`, "utf8");
}

function runClaude(command: string, args: string[], prompt: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args, prompt], {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function readFinalJson(file: string): Promise<ArticleFinal> {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as ArticleFinal;
}

function collectPublicCopy(value: unknown): string[] {
  const strings: string[] = [];

  function visit(entry: unknown, keyPath: string[]) {
    if (typeof entry === "string") {
      if (keyPath.some((key) => PUBLIC_COPY_KEYS.includes(key))) strings.push(entry);
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => visit(item, [...keyPath, String(index)]));
      return;
    }
    if (entry && typeof entry === "object") {
      for (const [key, child] of Object.entries(entry as Record<string, unknown>)) {
        visit(child, [...keyPath, key]);
      }
    }
  }

  visit(value, []);
  return strings;
}

function validateFinalJson(file: string, options: CliOptions, finalJson: ArticleFinal) {
  const errors: string[] = [];

  if (typeof finalJson.title !== "string" || !finalJson.title.trim()) errors.push("title is required");
  if (finalJson.slug !== options.article) errors.push(`slug must be ${options.article}`);
  if (typeof finalJson.meta_description !== "string" || !finalJson.meta_description.trim()) {
    errors.push("meta_description is required");
  }
  if (typeof finalJson.content_md !== "string" || !finalJson.content_md.trim()) errors.push("content_md is required");
  if ("seo_title" in finalJson) errors.push("seo_title must not be present");
  if (!Array.isArray(finalJson.tags)) errors.push("tags must be an array");
  if (!Array.isArray(finalJson.sources)) errors.push("sources must be an array");
  if (finalJson.universe_id !== null && typeof finalJson.universe_id !== "number") {
    errors.push("universe_id must be a number or null");
  }
  if (!Array.isArray(finalJson.faq_json)) errors.push("faq_json must be an array");
  if (Array.isArray(finalJson.faq_json)) {
    finalJson.faq_json.forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`faq_json[${index}] must be an object`);
        return;
      }
      const faq = entry as Record<string, unknown>;
      if (typeof faq.q !== "string" || typeof faq.a !== "string") errors.push(`faq_json[${index}] must use q/a string keys`);
      if ("question" in faq || "answer" in faq) errors.push(`faq_json[${index}] must not use question/answer keys`);
    });
  }

  for (const copy of collectPublicCopy(finalJson)) {
    if (/[\u2013\u2014]/.test(copy)) errors.push("public copy contains an en dash or em dash");
    if (/\b(research|source gathering|sources|competitors?|database|internal notes?|Bloxodes)\b/i.test(copy)) {
      errors.push("public copy mentions research, source gathering, sources, competitors, database, internal notes, or Bloxodes");
    }
    if (/\bthis\s+(article|guide|page|catalog|dataset|database)\b/i.test(copy)) {
      errors.push("public copy is self-referential");
    }
    if (/\bnot\s+(just|only)\b/i.test(copy)) errors.push("public copy contains AI-ish contrast filler");
    if (HYPE_WORDS.test(copy)) errors.push("public copy contains banned hype wording");
  }

  const uniqueErrors = Array.from(new Set(errors));
  if (uniqueErrors.length) {
    throw new Error(`Claude article final.json sanity check failed for ${file}:\n- ${uniqueErrors.join("\n- ")}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = resolveRepoPath(options.articlesRoot);
  const articleDir = path.join(root, options.article);
  const brief = path.join(articleDir, "brief.md");
  const finalJson = path.join(articleDir, "final.json");
  const promptOut = resolveRepoPath(options.promptOut ?? path.join(articleDir, "claude-writing-prompt.md"));
  const skillName = options.tech ? "bloxodes-tech-article-writing" : "bloxodes-article-writing";
  const skill = resolveRepoPath(path.join(".claude", "skills", skillName, "SKILL.md"));

  if (!(await pathExists(brief))) throw new Error(`Missing approved brief: ${brief}`);
  if (!(await pathExists(skill))) throw new Error(`Missing Claude writing skill: ${skill}`);

  const prompt = buildPrompt(options, { brief, finalJson, skill });
  await writePrompt(promptOut, prompt);
  console.log(`Wrote Claude article-writing prompt: ${path.relative(process.cwd(), promptOut)}`);

  if (options.run) {
    await runClaude(options.claudeCommand, options.claudeArgs, prompt);
  }

  if (options.run || options.checkOutput) {
    if (!(await pathExists(finalJson))) throw new Error(`Claude did not create final.json: ${finalJson}`);
    validateFinalJson(finalJson, options, await readFinalJson(finalJson));
    console.log(`Claude article final.json sanity check passed: ${path.relative(process.cwd(), finalJson)}`);
  } else {
    console.log("Prompt-only mode complete. Run with --run to invoke Claude, or paste the prompt into Claude manually.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
