import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

export function checkCiEnv() {
  const root = path.resolve(import.meta.dirname, "../..");
  const config = JSON.parse(fs.readFileSync(path.join(root, "env/config.json"), "utf8"));
  const files = new Set<string>([...Object.values(config.profiles).flat(), ...Object.values(config.overlays).flat()] as string[]);
  for (const file of files) parse(fs.readFileSync(path.join(root, "env/examples", `${file}.example`), "utf8"));
  for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
    if (!process.env[key]?.trim()) throw new Error(`Required CI environment variable ${key} is missing.`);
  }
  if (process.env.BLOXODES_ENV_PROFILE !== "process-only") throw new Error("CI must use process-only environment loading.");
  if (process.env.SUPABASE_URL !== "https://bbtcaurrtyoukvjbxbbj.supabase.co" || process.env.NEXT_PUBLIC_SUPABASE_URL !== process.env.SUPABASE_URL) throw new Error("PR checks must use the managed-development project.");
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE === process.env.SUPABASE_ANON_KEY) throw new Error("The public CI key must match anon and differ from service role.");
  console.log(`CI environment verified; ${files.size} committed profile/overlay contracts and the managed-development target.`);
}
