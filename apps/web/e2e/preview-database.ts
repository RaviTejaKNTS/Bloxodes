import { createClient } from "@supabase/supabase-js";

export function previewDatabase() {
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("Preview database coverage runs only in GitHub CI.");
  const target = process.env.BLOXODES_CI_DATA === "1" ? "http://127.0.0.1:54321" : "https://bbtcaurrtyoukvjbxbbj.supabase.co";
  if (process.env.SUPABASE_URL !== target || !process.env.SUPABASE_SERVICE_ROLE) throw new Error("Preview database must match the explicit CI target.");
  return createClient(target, process.env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
}
