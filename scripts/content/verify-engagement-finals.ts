import "../shared/load-env";

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseQuizData, type QuizData } from "@/lib/quiz-types";

type ChecklistFinal = {
  page: {
    universe_id: number;
    slug: string;
    title: string;
    seo_description?: string | null;
    is_public?: boolean;
  };
  items: Array<{ section_code: string; title: string; description?: string | null; is_required?: boolean }>;
};

type QuizFinal = {
  page: {
    universe_id?: number | null;
    code: string;
    title: string;
    seo_description?: string | null;
    is_published?: boolean;
  };
  quizData?: unknown;
};

type FinalEntry =
  | { kind: "checklist"; file: string; slug: string; title: string; universeId: number; itemCount: number }
  | { kind: "quiz"; file: string; code: string; title: string; universeId: number | null; quizData: QuizData };

type CliOptions = {
  baseUrl: string;
  files: string[];
};

function printUsage() {
  console.log(
    "Usage: npm run verify:engagement-finals -- --base-url http://localhost:3000 --file <checklist-or-quiz-final.json> [...]"
  );
}

function parseArgs(argv: string[]): CliOptions {
  let baseUrl: string | null = null;
  const files: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--base-url":
        baseUrl = argv[++i] ?? null;
        if (!baseUrl) throw new Error("Missing value for --base-url");
        break;
      case "--file":
        files.push(argv[++i] ?? "");
        if (!files.at(-1)) throw new Error("Missing value for --file");
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!baseUrl) throw new Error("--base-url is required");
  if (!files.length) throw new Error("At least one --file is required");
  return { baseUrl: normalizeBaseUrl(baseUrl), files };
}

function normalizeBaseUrl(value: string): string {
  return new URL(value).toString().replace(/\/$/, "");
}

function isChecklistFinal(value: unknown): value is ChecklistFinal {
  const candidate = value as Partial<ChecklistFinal>;
  return Boolean(candidate?.page?.slug && candidate.page.title && Array.isArray(candidate.items));
}

function isQuizFinal(value: unknown): value is QuizFinal {
  const candidate = value as Partial<QuizFinal>;
  return Boolean(candidate?.page?.code && candidate.page.title && "quizData" in candidate);
}

async function readFinal(file: string): Promise<FinalEntry> {
  const raw = await readFile(path.resolve(process.cwd(), file), "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (isChecklistFinal(parsed)) {
    return {
      kind: "checklist",
      file,
      slug: parsed.page.slug.trim().toLowerCase(),
      title: parsed.page.title.trim(),
      universeId: Number(parsed.page.universe_id),
      itemCount: parsed.items.length,
    };
  }

  if (isQuizFinal(parsed)) {
    return {
      kind: "quiz",
      file,
      code: parsed.page.code.trim().toLowerCase(),
      title: parsed.page.title.trim(),
      universeId: typeof parsed.page.universe_id === "number" ? parsed.page.universe_id : null,
      quizData: parseQuizData(parsed.quizData, `${file}.quizData`),
    };
  }

  throw new Error(`${file} is not a checklist or quiz final.json`);
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
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

async function verifyReadback(entries: FinalEntry[]) {
  const sb = supabaseAdmin();

  for (const entry of entries) {
    if (entry.kind === "checklist") {
      const { data, error } = await sb
        .from("checklist_pages")
        .select("id, slug, title, universe_id, is_public")
        .eq("slug", entry.slug)
        .eq("universe_id", entry.universeId)
        .maybeSingle();
      if (error) throw new Error(`Failed to read checklist ${entry.slug}: ${error.message}`);
      if (!data) throw new Error(`No checklist_pages row found for ${entry.slug}`);
      if ((data as { title?: string }).title !== entry.title) throw new Error(`Checklist title mismatch for ${entry.slug}`);
      if (!(data as { is_public?: boolean }).is_public) throw new Error(`Checklist ${entry.slug} is not public`);

      const { count, error: countError } = await sb
        .from("checklist_items")
        .select("id", { count: "exact", head: true })
        .eq("page_id", (data as { id: string }).id);
      if (countError) throw new Error(`Failed to count checklist items for ${entry.slug}: ${countError.message}`);
      if ((count ?? 0) !== entry.itemCount) throw new Error(`Checklist item count mismatch for ${entry.slug}`);
    } else {
      const { data, error } = await sb
        .from("quiz_pages")
        .select("code, title, universe_id, is_published, quiz_data")
        .eq("code", entry.code)
        .maybeSingle();
      if (error) throw new Error(`Failed to read quiz ${entry.code}: ${error.message}`);
      if (!data) throw new Error(`No quiz_pages row found for ${entry.code}`);
      if ((data as { title?: string }).title !== entry.title) throw new Error(`Quiz title mismatch for ${entry.code}`);
      if (!(data as { is_published?: boolean }).is_published) throw new Error(`Quiz ${entry.code} is not published`);
      const savedQuizData = parseQuizData((data as { quiz_data?: unknown }).quiz_data, `quiz_pages.${entry.code}.quiz_data`);
      if (stableJson(savedQuizData) !== stableJson(entry.quizData)) {
        throw new Error(`Quiz data mismatch for ${entry.code}`);
      }
    }
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function fetchWithTimeout(url: string, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyRoute(url: string, title: string) {
  const response = await fetchWithTimeout(url);
  const body = await response.text();
  if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
  if (!body.includes(title) && !body.includes(title.replace(/&/g, "&amp;"))) {
    throw new Error(`${url} returned 200 but did not include the page title`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = await Promise.all(options.files.map(readFinal));
  console.log(`Parsed ${entries.length} engagement final file${entries.length === 1 ? "" : "s"}.`);

  await runCommand("npm", ["run", "content:check-copy", "--", ...options.files]);
  await runCommand("npm", ["run", "import:content-final", "--", ...options.files.flatMap((file) => ["--file", file])]);
  await verifyReadback(entries);

  const urls = entries.map((entry) =>
    entry.kind === "checklist"
      ? `${options.baseUrl}/checklists/${entry.slug}`
      : `${options.baseUrl}/quizzes/${entry.code}`
  );

  for (let index = 0; index < entries.length; index += 1) {
    await verifyRoute(urls[index], entries[index].title);
    console.log(`Route passed: ${urls[index]}`);
  }

  console.log("\nVerified localhost links:");
  urls.forEach((url) => console.log(`- ${url}`));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
