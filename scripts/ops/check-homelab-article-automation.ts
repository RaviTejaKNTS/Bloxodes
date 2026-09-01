import "../shared/load-env";

import { accessSync, constants as fsConstants, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { resolveArticleDevCredentials, supabaseTarget } from "../articles/article-queue-env";
import { readProductionCredentials } from "../articles/release-completed-articles";
import { parseCodexReasoningEffort } from "../articles/article-writer-provider";
import {
  PI_WRITER_MODEL,
  PI_WRITER_PROVIDER,
  PI_WRITER_REASONING,
  assertLunaMaxConfiguration,
  assertPiVersion
} from "../articles/pi-article-writer";
import { fetchProductionEditorialInventory } from "../articles/production-editorial-inventory";
import { runArticleBrowserSmokeTest } from "../content/article-browser";

type Component = "all" | "discovery" | "writer";

function autoPublishEnabled(): boolean {
  const value = process.env.ARTICLE_AUTO_PUBLISH?.trim().toLowerCase();
  if (!value) return true;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  throw new Error("ARTICLE_AUTO_PUBLISH must be true or false.");
}

function parseComponent(argv: string[]): Component {
  let component: Component = "all";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--component" || arg.startsWith("--component=")) {
      const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++index];
      if (!value || !["all", "discovery", "writer"].includes(value)) {
        throw new Error("--component must be all, discovery, or writer.");
      }
      component = value as Component;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run articles:homelab:check -- [--component all|discovery|writer]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return component;
}

function findExecutable(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate.includes("/")) {
      try {
        accessSync(candidate, fsConstants.X_OK);
        return candidate;
      } catch {
        continue;
      }
    }
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  return null;
}

async function checkDevDatabase(component: Component) {
  const dev = resolveArticleDevCredentials();
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const tables = ["article_generation_queue", "articles"];
  if (component !== "writer") tables.push("article_discovery_candidates", "article_curation_runs");
  for (const table of tables) {
    const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
    if (error) throw new Error(`Managed dev table ${table} is not ready: ${error.message}`);
  }
  console.log(`Managed dev Supabase: ${supabaseTarget(dev.url)} (${tables.length} tables ready)`);
}

async function main() {
  const component = parseComponent(process.argv.slice(2));
  await checkDevDatabase(component);

  const inventory = await fetchProductionEditorialInventory();
  if (!inventory.items.length) throw new Error("Production editorial inventory is empty.");
  console.log(`Production inventory: ${inventory.items.length} published page(s)`);

  if (component !== "writer") {
    if (!process.env.GROQ_API_KEY?.trim()) throw new Error("GROQ_API_KEY is required for discovery curation.");
    console.log("Groq curation key: configured");
  }

  if (component !== "discovery") {
    if (!process.env.SUPABASE_MEDIA_BUCKET?.trim()) throw new Error("SUPABASE_MEDIA_BUCKET is required for article media.");
    if (autoPublishEnabled()) {
      const productionEnvFile = path.resolve(
        process.env.ARTICLE_RELEASE_PRODUCTION_ENV_FILE?.trim() || ".envs/targets/production.env"
      );
      await readProductionCredentials(productionEnvFile);
      console.log(`Production release target: ${productionEnvFile} (validated)`);
    } else {
      console.log("Production release: disabled for manual review");
    }
    const codexConfigured = process.env.ARTICLE_WRITER_CODEX_BIN?.trim();
    const codex = findExecutable(
      [codexConfigured || "", `${process.env.HOME ?? ""}/.local/bin/codex`, "codex"].filter(Boolean)
    );
    if (!codex) throw new Error("Codex CLI is not installed or ARTICLE_WRITER_CODEX_BIN is incorrect.");
    const codexVersion = spawnSync(codex, ["--version"], { encoding: "utf8" });
    if (codexVersion.status !== 0) throw new Error(`Codex CLI failed its version check: ${codexVersion.stderr.trim()}`);
    const codexLogin = spawnSync(codex, ["login", "status"], { encoding: "utf8" });
    if (codexLogin.status !== 0) {
      throw new Error(`Codex CLI authentication is not ready: ${codexLogin.stderr.trim() || codexLogin.stdout.trim()}`);
    }
    const codexModel = process.env.ARTICLE_WRITER_CODEX_MODEL?.trim() || "gpt-5.6-luna";
    const codexReasoning = parseCodexReasoningEffort(
      process.env.ARTICLE_WRITER_CODEX_REASONING_EFFORT?.trim() || "xhigh"
    );
    console.log(`Codex CLI: ${codexVersion.stdout.trim()} (${codexModel}, ${codexReasoning})`);

    const piConfigured = process.env.ARTICLE_WRITER_PI_BIN?.trim();
    const pi = findExecutable([piConfigured || "", path.join(os.homedir(), ".local", "bin", "pi"), "pi"].filter(Boolean));
    if (!pi) throw new Error("Pi CLI is not installed or ARTICLE_WRITER_PI_BIN is incorrect.");
    const piVersion = spawnSync(pi, ["--version"], { encoding: "utf8" });
    if (piVersion.status !== 0) throw new Error(`Pi CLI failed its version check: ${piVersion.stderr.trim()}`);
    const parsedPiVersion = assertPiVersion(piVersion.stdout);
    const piProvider = process.env.ARTICLE_WRITER_PI_PROVIDER?.trim() || PI_WRITER_PROVIDER;
    const piModel = process.env.ARTICLE_WRITER_PI_MODEL?.trim() || PI_WRITER_MODEL;
    const piReasoning = process.env.ARTICLE_WRITER_PI_REASONING_EFFORT?.trim() || PI_WRITER_REASONING;
    if (piProvider !== PI_WRITER_PROVIDER) {
      throw new Error(`Pi article writing must use provider ${PI_WRITER_PROVIDER}; received ${piProvider}.`);
    }
    assertLunaMaxConfiguration(piModel, piReasoning, "Pi article writing");
    const piAuthPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
    let piAuth: unknown;
    try {
      piAuth = JSON.parse(readFileSync(piAuthPath, "utf8"));
    } catch {
      throw new Error(`Pi ChatGPT authentication is not ready at ${piAuthPath}; run /login and choose ChatGPT Plus/Pro.`);
    }
    if (!piAuth || typeof piAuth !== "object" || !(PI_WRITER_PROVIDER in piAuth)) {
      throw new Error(`Pi auth.json has no ${PI_WRITER_PROVIDER} login; run /login and choose ChatGPT Plus/Pro.`);
    }
    console.log(`Pi CLI: ${parsedPiVersion} (${piProvider}/${piModel}, ${piReasoning}; ChatGPT auth present)`);

    const browser = await runArticleBrowserSmokeTest();
    console.log(`Headless browser: ${browser} (Playwright smoke test passed)`);
  }

  console.log(`Homelab article automation readiness passed (${component}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
