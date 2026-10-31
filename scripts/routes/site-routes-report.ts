/** Read-only. Loads SUPABASE_URL and SUPABASE_SERVICE_ROLE through the shared
 * env loader. Defaults to managed dev. Production reads require --allow-prod
 * and BLOXODES_ENV_PROFILE=production-preview. Never publishes or writes. */
import "../shared/load-env";
import { createClient } from "@supabase/supabase-js";
import type { SiteRoutesDatabase } from "../../supabase/types/site-routes";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required");
  const target = new URL(url);
  const managed = target.protocol === "https:" && target.hostname.endsWith(".supabase.co");
  const production = target.origin === "https://database.bloxodes.com";
  if (!managed && !(production && process.argv.includes("--allow-prod") && process.env.BLOXODES_ENV_PROFILE === "production-preview")) {
    throw new Error("Use managed development, or production-preview with --allow-prod for a production read");
  }
  const db = createClient<SiteRoutesDatabase>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("site_routes_report");
  if (error) throw new Error(`site_routes_report failed: ${error.message}`);
  console.log(JSON.stringify({ target: target.origin, report: data }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Route report failed"); process.exitCode = 1; });
