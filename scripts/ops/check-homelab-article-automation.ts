import "../articles/load-notion-article-env";

import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { createNotionArticleQueue } from "../articles/notion-article-queue";
import { articleStateDirectory, readArticleState } from "../articles/article-local-state";
import { fetchProductionEditorialInventory } from "../articles/production-editorial-inventory";

type Component = "all" | "discovery";

function parseComponent(argv: string[]): Component {
  let component: Component = "all";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--component" || arg.startsWith("--component=")) {
      const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++index];
      if (!value || !["all", "discovery"].includes(value)) {
        throw new Error("--component must be all or discovery.");
      }
      component = value as Component;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run articles:homelab:check -- [--component all|discovery]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return component;
}

async function checkArticleQueue() {
  const queue = createNotionArticleQueue();
  await queue.validate();
  const rows = await queue.list();
  const directory = articleStateDirectory();
  await access(directory, constants.R_OK | constants.W_OK);
  const state = await readArticleState(directory);
  console.log(`Notion Article Queue: ${rows.length} row(s). State: ${directory}, ${state.candidates.length} candidate(s), ${state.runs.length} run(s).`);
}

async function main() {
  const component = parseComponent(process.argv.slice(2));
  await checkArticleQueue();

  const inventory = await fetchProductionEditorialInventory();
  if (!inventory.items.length) throw new Error("Production editorial inventory is empty.");
  console.log(`Production inventory: ${inventory.items.length} published page(s)`);

  if (!process.env.GROQ_API_KEY?.trim()) throw new Error("GROQ_API_KEY is required for discovery curation.");
  console.log("Groq curation key: configured");

  console.log(`Homelab article automation readiness passed (${component}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
