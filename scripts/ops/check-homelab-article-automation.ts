import "../shared/load-env";

import { createClient } from "@supabase/supabase-js";

import { resolveArticleDevCredentials, supabaseTarget } from "../articles/article-queue-env";
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

async function checkDevDatabase() {
  const dev = resolveArticleDevCredentials();
  const supabase = createClient(dev.url, dev.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const tables = ["article_generation_queue", "articles", "article_discovery_candidates", "article_curation_runs"];
  for (const table of tables) {
    const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
    if (error) throw new Error(`Managed dev table ${table} is not ready: ${error.message}`);
  }
  console.log(`Managed dev Supabase: ${supabaseTarget(dev.url)} (${tables.length} tables ready)`);
}

async function main() {
  const component = parseComponent(process.argv.slice(2));
  await checkDevDatabase();

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
