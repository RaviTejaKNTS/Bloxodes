import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readBloxodesEnvFile } from "../shared/env-files";

/** Read production independently of the publisher's selected target. Never mutate its env. */
export function productionArticleDb(): SupabaseClient {
  const env = readBloxodesEnvFile("targets/production.env");
  const url = env.SUPABASE_URL;
  if (url?.replace(/\/$/, "") !== "https://database.bloxodes.com") throw new Error("Article context requires production credentials.");
  return createClient(url, env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(30_000) }) } });
}
export async function productionRows(db: SupabaseClient, table: string, columns = "*", filter: (query: any) => any = q => q) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await filter(db.from(table).select(columns)).order("id").range(offset, offset + 999);
    if (error) throw new Error(`Could not read production ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
