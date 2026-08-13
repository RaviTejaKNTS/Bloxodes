import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const outputPath = path.join(repoRoot, ".envs/targets/local.env");
const container = process.env.BLOXODES_LOCAL_SUPABASE_KONG ?? "supabase_kong_roblox-codes";
const raw = execFileSync("docker", ["exec", container, "cat", "/home/kong/kong.yml"], {
  encoding: "utf8"
});
const anon = raw.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
const serviceRole = raw.match(/sb_secret_[A-Za-z0-9_-]+/)?.[0];
if (!anon || !serviceRole) {
  throw new Error(`Could not derive local Supabase keys from ${container}. Is the Bloxodes local stack running?`);
}
const local = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE: serviceRole,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_MEDIA_BUCKET: "media",
  SUPABASE_MEDIA_PUBLIC_URL: "http://127.0.0.1:54321/storage/v1/object/public/media"
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true, mode: 0o700 });
fs.writeFileSync(
  outputPath,
  `${Object.entries(local).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n")}\n`,
  { mode: 0o600 }
);
fs.chmodSync(outputPath, 0o600);
console.log(`Updated local Supabase target from ${container} without printing credentials.`);
