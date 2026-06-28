import "../shared/load-env";

import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateWikiControlsJson } from "../shared/wiki-controls";

type CliOptions = {
  baseUrl: string;
  game: string;
  finalJsonRoot: string;
};

type WikiFinal = {
  slug?: string;
  title?: string;
  universe_id?: number | null;
  description_md?: string | null;
  controls_json?: unknown;
};

function printUsage() {
  console.log(
    "Usage: npm run verify:wiki-final -- --base-url http://localhost:3000 --game <game-slug> --final-json-root <workspace-root>"
  );
}

function parseArgs(argv: string[]): CliOptions {
  let baseUrl: string | null = null;
  let game: string | null = null;
  let finalJsonRoot: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--base-url":
        baseUrl = argv[++i] ?? null;
        break;
      case "--game":
      case "--game-slug":
      case "--wiki-slug":
        game = argv[++i] ?? null;
        break;
      case "--final-json-root":
      case "--final-json-dir":
        finalJsonRoot = argv[++i] ?? null;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!baseUrl) throw new Error("--base-url is required");
  if (!game) throw new Error("--game is required");
  if (!finalJsonRoot) throw new Error("--final-json-root is required");

  return {
    baseUrl: new URL(baseUrl).toString().replace(/\/$/, ""),
    game: game.trim().toLowerCase(),
    finalJsonRoot,
  };
}

async function findFile(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // Try next workspace shape.
    }
  }
  throw new Error(`Could not find wiki final.json. Checked: ${candidates.join(", ")}`);
}

async function readWikiFinal(file: string): Promise<WikiFinal> {
  const parsed = JSON.parse(await readFile(file, "utf8")) as WikiFinal;
  validateWikiControlsJson(parsed.controls_json, "final.json controls_json");
  if (parsed.slug && parsed.slug.trim().toLowerCase() !== path.basename(path.dirname(path.dirname(file)))) {
    // The seed script also checks this; this warning keeps verifier output direct when the path shape is different.
    console.warn(`Warning: final.json slug is ${parsed.slug}`);
  }
  return parsed;
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

async function verifyReadback(game: string, finalJson: WikiFinal) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("wiki_pages")
    .select("slug,title,universe_id,is_published,tips_md,meta_description,description_md")
    .eq("slug", game)
    .maybeSingle();

  if (error) throw new Error(`Failed to read wiki ${game}: ${error.message}`);
  if (!data) throw new Error(`No wiki_pages row found for ${game}`);
  const row = data as {
    title?: string | null;
    universe_id?: number | null;
    is_published?: boolean;
    tips_md?: string | null;
    description_md?: string | null;
  };
  if (!row.is_published) throw new Error(`Wiki ${game} is not published`);
  if (finalJson.title && row.title !== finalJson.title) throw new Error(`Wiki title mismatch for ${game}`);
  if (typeof finalJson.universe_id === "number" && row.universe_id !== finalJson.universe_id) {
    throw new Error(`Wiki universe_id mismatch for ${game}`);
  }
  if (!row.tips_md?.trim()) throw new Error(`Wiki ${game} has no tips_md`);
  const expectedDescription = finalJson.description_md ?? null;
  if (expectedDescription && row.description_md !== expectedDescription) {
    throw new Error(`Wiki description_md mismatch for ${game}`);
  }
  if (!row.description_md?.trim()) throw new Error(`Wiki ${game} has no description_md`);
}

async function verifyRoute(url: string, title?: string) {
  const response = await fetch(url, { redirect: "follow" });
  const body = await response.text();
  if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
  if (title && !body.includes(title) && !body.includes(title.replace(/&/g, "&amp;"))) {
    throw new Error(`${url} returned 200 but did not include the wiki title`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = path.isAbsolute(options.finalJsonRoot)
    ? options.finalJsonRoot
    : path.resolve(process.cwd(), options.finalJsonRoot);
  const finalJsonPath = await findFile([
    path.join(root, options.game, "wiki", "final.json"),
    path.join(root, options.game, "final.json"),
    path.join(root, "wiki", "final.json"),
    path.join(root, "final.json"),
  ]);
  const finalJson = await readWikiFinal(finalJsonPath);

  await runCommand("npm", ["run", "content:check-copy", "--", finalJsonPath]);
  await runCommand("npm", [
    "run",
    "seed:game-wiki-pages",
    "--",
    "--game",
    options.game,
    "--final-json-root",
    options.finalJsonRoot,
  ]);
  await verifyReadback(options.game, finalJson);

  const url = `${options.baseUrl}/wiki/${options.game}`;
  await verifyRoute(url, finalJson.title);
  console.log(`Route passed: ${url}`);
  console.log(`\nVerified localhost link:\n- ${url}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
