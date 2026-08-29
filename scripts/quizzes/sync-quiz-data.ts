import "../shared/load-env";

import fs from "node:fs/promises";
import path from "node:path";

import { GAME_COLLECTION_GROUPS } from "@/lib/game-collections";
import { repoPath } from "@/lib/paths";
import { parseQuizData, type QuizData } from "@/lib/quiz-types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isManagedDevelopmentSupabaseUrl,
  isProductionSupabaseUrl
} from "../shared/supabase-target";

type QuizPagePayload = {
  universe_id: number | null;
  code: string;
  title: string;
  description_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_published: boolean;
  published_at: string | null;
  quiz_data: QuizData;
};

type UniversePayload = {
  universe_id: number;
  root_place_id: number;
  name: string;
  display_name: string | null;
  slug: string | null;
  icon_url: string | null;
  thumbnail_urls: unknown;
};

type QuizDataManifest = {
  schemaVersion: 1;
  generatedAt: string;
  universes: UniversePayload[];
  quizzes: QuizPagePayload[];
};

type CliOptions = {
  apply: boolean;
  allowProd: boolean;
  allowRemoteRead: boolean;
  exportPath: string | null;
  inputPath: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    allowProd: false,
    allowRemoteRead: false,
    exportPath: null,
    inputPath: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--allow-prod") options.allowProd = true;
    else if (arg === "--allow-remote-read") options.allowRemoteRead = true;
    else if (arg === "--export") options.exportPath = argv[++index] ?? null;
    else if (arg === "--input") options.inputPath = argv[++index] ?? null;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run sync:quiz-data -- --export <manifest.json> [--allow-remote-read]");
      console.log("   or: npm run sync:quiz-data -- --input <manifest.json> [--apply] [--allow-prod]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }

  if (Boolean(options.exportPath) === Boolean(options.inputPath)) {
    throw new Error("Choose exactly one of --export or --input.");
  }
  if (options.exportPath && options.apply) throw new Error("--apply cannot be used with --export.");
  return options;
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

async function discoverLocalQuizData(): Promise<Map<string, QuizData>> {
  const quizzes = new Map<string, QuizData>();
  for (const group of GAME_COLLECTION_GROUPS) {
    const quizPath = repoPath("data", group.dataDir, "quiz.json");
    try {
      const raw = await fs.readFile(quizPath, "utf8");
      quizzes.set(group.gameSlug, parseQuizData(JSON.parse(raw), quizPath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (!quizzes.size) throw new Error("No registered local quiz.json files were found.");
  return quizzes;
}

function parseManifest(value: unknown, label: string): QuizDataManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const manifest = value as Partial<QuizDataManifest>;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.quizzes) || !Array.isArray(manifest.universes)) {
    throw new Error(`${label} must be a schemaVersion 1 quiz manifest.`);
  }

  const codes = new Set<string>();
  const quizzes = manifest.quizzes.map((entry, index) => {
    const code = String(entry?.code ?? "").trim().toLowerCase();
    const title = String(entry?.title ?? "").trim();
    if (!code || !title || codes.has(code)) throw new Error(`${label}.quizzes[${index}] has an invalid or duplicate code.`);
    codes.add(code);
    return {
      universe_id: Number.isSafeInteger(entry.universe_id) ? entry.universe_id : null,
      code,
      title,
      description_md: typeof entry.description_md === "string" ? entry.description_md : null,
      seo_title: typeof entry.seo_title === "string" ? entry.seo_title : null,
      seo_description: typeof entry.seo_description === "string" ? entry.seo_description : null,
      is_published: entry.is_published === true,
      published_at: typeof entry.published_at === "string" ? entry.published_at : null,
      quiz_data: parseQuizData(entry.quiz_data, `${label}.quizzes[${index}].quiz_data`)
    };
  });
  if (quizzes.some((quiz) => quiz.is_published && !quiz.quiz_data)) {
    throw new Error(`${label} contains a published quiz without quiz data.`);
  }

  const universes = manifest.universes.map((entry, index) => {
    const universeId = Number(entry?.universe_id);
    const rootPlaceId = Number(entry?.root_place_id);
    const name = String(entry?.name ?? "").trim();
    if (!Number.isSafeInteger(universeId) || !Number.isSafeInteger(rootPlaceId) || !name) {
      throw new Error(`${label}.universes[${index}] is invalid.`);
    }
    return {
      universe_id: universeId,
      root_place_id: rootPlaceId,
      name,
      display_name: typeof entry.display_name === "string" ? entry.display_name : null,
      slug: typeof entry.slug === "string" ? entry.slug : null,
      icon_url: typeof entry.icon_url === "string" ? entry.icon_url : null,
      thumbnail_urls: Array.isArray(entry.thumbnail_urls) ? entry.thumbnail_urls : []
    };
  });

  return {
    schemaVersion: 1,
    generatedAt: typeof manifest.generatedAt === "string" ? manifest.generatedAt : new Date().toISOString(),
    universes,
    quizzes
  };
}

async function exportManifest(outputPath: string, allowRemoteRead: boolean) {
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (production && !allowRemoteRead) {
    throw new Error("Production export requires --allow-remote-read.");
  }

  const localQuizzes = await discoverLocalQuizData();
  const codes = [...localQuizzes.keys()].sort();
  const sb = supabaseAdmin();
  const pageResult = await sb
    .from("quiz_pages")
    .select("universe_id,code,title,description_md,seo_title,seo_description,is_published,published_at")
    .in("code", codes);
  if (pageResult.error) throw pageResult.error;
  const rows = pageResult.data ?? [];
  const pagesByCode = new Map(rows.map((row) => [String(row.code), row]));
  const missing = codes.filter((code) => !pagesByCode.has(code));
  if (missing.length) throw new Error(`Missing quiz_pages rows for: ${missing.join(", ")}`);

  const universeIds = [...new Set(rows.map((row) => Number(row.universe_id)).filter(Number.isSafeInteger))];
  const universeResult = await sb
    .from("roblox_universes")
    .select("universe_id,root_place_id,name,display_name,slug,icon_url,thumbnail_urls")
    .in("universe_id", universeIds);
  if (universeResult.error) throw universeResult.error;
  if ((universeResult.data ?? []).length !== universeIds.length) {
    throw new Error("One or more quiz universes are missing from the source database.");
  }

  const manifest: QuizDataManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    universes: (universeResult.data ?? []) as UniversePayload[],
    quizzes: codes.map((code) => {
      const row = pagesByCode.get(code)!;
      return {
        universe_id: Number.isSafeInteger(Number(row.universe_id)) ? Number(row.universe_id) : null,
        code,
        title: String(row.title),
        description_md: typeof row.description_md === "string" ? row.description_md : null,
        seo_title: typeof row.seo_title === "string" ? row.seo_title : null,
        seo_description: typeof row.seo_description === "string" ? row.seo_description : null,
        is_published: row.is_published === true,
        published_at: typeof row.published_at === "string" ? row.published_at : null,
        quiz_data: localQuizzes.get(code)!
      };
    })
  };

  const absolute = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Exported ${manifest.quizzes.length} quizzes to ${absolute}`);
}

async function syncManifest(inputPath: string, apply: boolean, allowProd: boolean) {
  const managed = isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL);
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (apply && !managed && !(production && allowProd && process.env.NODE_ENV === "production")) {
    throw new Error("Writes require managed development, or NODE_ENV=production with --allow-prod.");
  }
  if (allowProd && !production) throw new Error("--allow-prod requires the recognized production target.");

  const absolute = path.resolve(inputPath);
  const manifest = parseManifest(JSON.parse(await fs.readFile(absolute, "utf8")), absolute);
  const questionCount = manifest.quizzes.reduce(
    (sum, quiz) => sum + quiz.quiz_data.easy.length + quiz.quiz_data.medium.length + quiz.quiz_data.hard.length,
    0
  );
  console.log(`${apply ? "Applying" : "Would apply"} ${manifest.quizzes.length} quizzes (${questionCount} questions).`);
  if (!apply) return;

  const sb = supabaseAdmin();
  if (managed) {
    const universeResult = await sb.from("roblox_universes").upsert(manifest.universes, { onConflict: "universe_id" });
    if (universeResult.error) throw universeResult.error;
  }
  const upsertResult = await sb.from("quiz_pages").upsert(manifest.quizzes, { onConflict: "code" });
  if (upsertResult.error) throw upsertResult.error;

  const readback = await sb.from("quiz_pages").select("code,quiz_data,is_published").in(
    "code",
    manifest.quizzes.map((quiz) => quiz.code)
  );
  if (readback.error) throw readback.error;
  const savedByCode = new Map((readback.data ?? []).map((row) => [String(row.code), row]));
  for (const quiz of manifest.quizzes) {
    const saved = savedByCode.get(quiz.code);
    if (!saved) throw new Error(`Readback missing quiz ${quiz.code}.`);
    const savedData = parseQuizData(saved.quiz_data, `quiz_pages.${quiz.code}.quiz_data`);
    if (stableJson(savedData) !== stableJson(quiz.quiz_data)) throw new Error(`Readback mismatch for ${quiz.code}.`);
    if (saved.is_published !== quiz.is_published) throw new Error(`Publish-state mismatch for ${quiz.code}.`);
  }
  console.log(`Verified ${manifest.quizzes.length} quiz payloads in ${production ? "production" : "managed development"}.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.exportPath) await exportManifest(options.exportPath, options.allowRemoteRead);
  else await syncManifest(options.inputPath!, options.apply, options.allowProd);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
