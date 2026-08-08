import "../shared/load-env";

import { fetchProductionEditorialInventory } from "./production-editorial-inventory";

type Options = {
  family: string | null;
  universeId: number | null;
  search: string | null;
  json: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { family: null, universeId: null, search: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--family") options.family = argv[++index]?.trim() || null;
    else if (arg.startsWith("--family=")) options.family = arg.slice("--family=".length).trim() || null;
    else if (arg === "--search") options.search = argv[++index]?.trim() || null;
    else if (arg.startsWith("--search=")) options.search = arg.slice("--search=".length).trim() || null;
    else if (arg === "--universe-id" || arg.startsWith("--universe-id=")) {
      const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++index];
      const value = Number(raw);
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error("--universe-id requires a positive integer.");
      options.universeId = value;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run articles:inventory:production -- [--family NAME] [--universe-id ID] [--search TEXT] [--json]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const payload = await fetchProductionEditorialInventory();
  const needle = options.search?.toLowerCase() ?? null;
  const items = payload.items.filter((item) =>
    (!options.family || item.family === options.family) &&
    (!options.universeId || item.universe_id === options.universeId) &&
    (!needle || `${item.title} ${item.key}`.toLowerCase().includes(needle))
  );
  if (options.json) {
    console.log(JSON.stringify({ generated_at: payload.generated_at, items }, null, 2));
    return;
  }
  console.log(`Production inventory generated ${payload.generated_at}; ${items.length} matching page(s).`);
  console.table(items);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
