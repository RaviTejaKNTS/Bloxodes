import "server-only";
import { createClient } from "@supabase/supabase-js";
import { rewriteLegacyWikiMediaFetch } from "./wiki-media-fetch";

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Rows and immutable collection revisions may still hold the retired wiki media prefix.
    global: { fetch: rewriteLegacyWikiMediaFetch }
  });
}
