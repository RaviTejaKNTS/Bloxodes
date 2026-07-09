import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

type CliOptions = {
  game: string;
  collection: string;
  finalJsonRoot: string;
  promptOut: string | null;
  run: boolean;
  checkOutput: boolean;
  claudeCommand: string;
  claudeArgs: string[];
};

type CollectionFinal = {
  universe_id?: unknown;
  wiki_slug?: unknown;
  collection_slug?: unknown;
  code?: unknown;
  display_name?: unknown;
  title?: unknown;
  seo_title?: unknown;
  meta_description?: unknown;
  intro_md?: unknown;
  description_md?: unknown;
  how_it_works_md?: unknown;
  description_json?: unknown;
  faq_json?: unknown;
  wiki_md?: unknown;
  is_published?: unknown;
};

const PUBLIC_COPY_KEYS = [
  "meta_description",
  "intro_md",
  "description_md",
  "how_it_works_md",
  "description_json",
  "faq_json",
  "wiki_md",
];

function printUsage() {
  console.log(`Usage:
  npm run write:game-collection:claude -- --game <game-slug> --collection <collection-slug> [options]

Options:
  --final-json-root <dir>   Defaults to tmp/content-workspace/<game-slug>/collections.
  --prompt-out <file>       Defaults to <final-json-root>/<collection-slug>/claude-writing-prompt.md.
  --run                     Invoke Claude after writing the handoff prompt.
  --check-output            Validate an existing final.json without invoking Claude.
  --claude-command <cmd>    Defaults to CLAUDE_COMMAND or claude.
  --claude-arg <arg>        Repeat to override Claude args. Defaults to -p.

Default behavior writes the Claude handoff prompt only. Use --run when the Claude CLI is available.`);
}

function parseArgs(argv: string[]): CliOptions {
  let game: string | null = null;
  let collection: string | null = null;
  let finalJsonRoot: string | null = null;
  let promptOut: string | null = null;
  let run = false;
  let checkOutput = false;
  let claudeCommand = process.env.CLAUDE_COMMAND || "claude";
  const claudeArgs: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--game":
      case "--game-slug":
      case "--wiki-slug":
        game = requireValue(argv, ++i, arg);
        break;
      case "--collection":
      case "--collection-slug":
        collection = requireValue(argv, ++i, arg);
        break;
      case "--final-json-root":
      case "--final-json-dir":
        finalJsonRoot = requireValue(argv, ++i, arg);
        break;
      case "--prompt-out":
        promptOut = requireValue(argv, ++i, arg);
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
        claudeArgs.push(requireValue(argv, ++i, arg));
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!game) throw new Error("--game is required");
  if (!collection) throw new Error("--collection is required");

  const normalizedGame = slugifyInput(game, "--game");
  const normalizedCollection = slugifyInput(collection, "--collection");

  return {
    game: normalizedGame,
    collection: normalizedCollection,
    finalJsonRoot: finalJsonRoot ?? path.join("tmp", "content-workspace", normalizedGame, "collections"),
    promptOut,
    run,
    checkOutput,
    claudeCommand,
    claudeArgs: claudeArgs.length ? claudeArgs : ["-p"],
  };
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${option}`);
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

  return `You are Claude writing one approved Bloxodes game collection final.json.

Use the Bloxodes collection writing skill exactly:
- Skill: ${relativeSkill}
- Game slug: ${options.game}
- Collection slug: ${options.collection}
- Approved brief: ${relativeBrief}
- Output file: ${relativeFinalJson}

Boundaries:
- Do not run the workflow runner.
- Do not spawn or call subagents.
- Do not redo research, data collection, or image collection.
- Read the approved brief first, then write only the final.json for this collection.
- Keep the existing dataset and image readiness decisions. If the brief is not approved or readiness is missing, stop and report that blocker.

Writing requirements:
- Write like a Roblox player explaining the system to another player.
- Keep the copy simple, warm, concrete, and human friendly.
- Avoid generic page filler, AI-ish contrast phrases, hype words, and textbook voice.
- Do not mention sources, dataset, workflow, Bloxodes, or page usage in public copy.
- Do not state item counts or section counts in prose. Only use the automated {count} token in title and seo_title.
- Use q/a keys for faq_json entries, not question/answer.
- Use ${options.game}-${options.collection} for code, ${options.game} for wiki_slug, and ${options.collection} for collection_slug.

Required second pass before you stop:
1. Reopen the final.json you wrote.
2. Check that JSON parses.
3. Revise once for human-friendly voice: specific, easy to read, not generic, and useful beyond the cards.
4. Check again for no prose counts, no source/dataset/workflow/page wording, no em dashes, correct faq_json keys, useful wiki_md, and valid slugs.
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

async function readFinalJson(file: string): Promise<CollectionFinal> {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as CollectionFinal;
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

function validateFinalJson(file: string, options: CliOptions, finalJson: CollectionFinal) {
  const errors: string[] = [];
  const expectedCode = `${options.game}-${options.collection}`;

  if (typeof finalJson.universe_id !== "number") errors.push("universe_id must be a number");
  if (finalJson.wiki_slug !== options.game) errors.push(`wiki_slug must be ${options.game}`);
  if (finalJson.collection_slug !== options.collection) errors.push(`collection_slug must be ${options.collection}`);
  if (finalJson.code !== expectedCode) errors.push(`code must be ${expectedCode}`);
  if (typeof finalJson.display_name !== "string" || !finalJson.display_name.trim()) errors.push("display_name is required");
  if (typeof finalJson.title !== "string" || !/\{\s*(count|item_count)\s*\}/i.test(finalJson.title)) {
    errors.push("title must use the automated {count} token");
  }
  if (typeof finalJson.seo_title === "string" && /\b(all|over|around|about|more than|less than)\s+\d/i.test(finalJson.seo_title)) {
    errors.push("seo_title must not hardcode an item count");
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
    if (/\b(dataset|workflow|sources|Bloxodes)\b/i.test(copy)) errors.push("public copy mentions dataset, workflow, sources, or Bloxodes");
    if (/\bthis\s+(page|guide|collection|dataset)\b/i.test(copy)) errors.push("public copy is self-referential");
    if (/\b(all|over|around|about|more than|less than)\s+\d+\s+(items?|entries|rows?|weapons?|units?|pets?|skins?|cards?|vehicles?)\b/i.test(copy)) {
      errors.push("public copy appears to hardcode an item or section count");
    }
  }

  const uniqueErrors = Array.from(new Set(errors));
  if (uniqueErrors.length) {
    throw new Error(`Claude final.json sanity check failed for ${file}:\n- ${uniqueErrors.join("\n- ")}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = resolveRepoPath(options.finalJsonRoot);
  const collectionDir = path.join(root, options.collection);
  const brief = path.join(collectionDir, "brief.md");
  const finalJson = path.join(collectionDir, "final.json");
  const promptOut = resolveRepoPath(options.promptOut ?? path.join(collectionDir, "claude-writing-prompt.md"));
  const skill = resolveRepoPath(path.join(".claude", "skills", "bloxodes-game-collection-writing", "SKILL.md"));

  if (!(await pathExists(brief))) throw new Error(`Missing approved brief: ${brief}`);
  if (!(await pathExists(skill))) throw new Error(`Missing Claude writing skill: ${skill}`);

  const prompt = buildPrompt(options, { brief, finalJson, skill });
  await writePrompt(promptOut, prompt);
  console.log(`Wrote Claude collection-writing prompt: ${path.relative(process.cwd(), promptOut)}`);

  if (options.run) {
    await runClaude(options.claudeCommand, options.claudeArgs, prompt);
  }

  if (options.run || options.checkOutput) {
    if (!(await pathExists(finalJson))) throw new Error(`Claude did not create final.json: ${finalJson}`);
    validateFinalJson(finalJson, options, await readFinalJson(finalJson));
    console.log(`Claude final.json sanity check passed: ${path.relative(process.cwd(), finalJson)}`);
  } else {
    console.log("Prompt-only mode complete. Run with --run to invoke Claude, or paste the prompt into Claude manually.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
