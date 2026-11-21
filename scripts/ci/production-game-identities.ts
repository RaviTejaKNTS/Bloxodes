import { createClient } from "@supabase/supabase-js";
import "../shared/load-env";
import fs from "node:fs";
import path from "node:path";
import { batchPath, ownedPath, parseBatch } from "./content-contract.mjs";
import { productionGameIdentities } from "./managed-game-identities.mjs";
import { isProductionSupabaseUrl } from "../shared/supabase-target";

// Read-only: records the production identity (namespace, slug, kind) of every game a selected
// game-pages operation references, so managed QA can find the same game in development.
async function main() {
  if (process.env.GITHUB_ACTIONS !== "true" || !process.env.GITHUB_OUTPUT) throw new Error("Production game identities are read only in the selected-content GitHub job.");
  if (!isProductionSupabaseUrl(process.env.SUPABASE_URL)) throw new Error("Production game identities need the production target.");
  const file = batchPath(process.env.BATCH);
  const base = path.dirname(file);
  const batch = parseBatch(JSON.parse(fs.readFileSync(file, "utf8")));
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false } });
  const identities = await productionGameIdentities(
    batch,
    input => JSON.parse(fs.readFileSync(ownedPath(base, input), "utf8")),
    async ids => {
      const { data, error } = await db.from("games").select("id,namespace,slug,kind").in("id", ids);
      if (error) throw error;
      return data;
    },
  );
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `games=${JSON.stringify(identities)}\n`);
  for (const identity of identities) console.log(`Production game ${identity.id}: ${identity.namespace}/${identity.slug} (${identity.kind})`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
