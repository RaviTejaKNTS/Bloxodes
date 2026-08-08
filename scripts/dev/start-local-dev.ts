import "../shared/load-env";

import { spawn } from "node:child_process";

function isLocalSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const articleDevUrl = process.env.ARTICLE_DEV_SUPABASE_URL;
const remoteArticleDev = process.env.ARTICLE_WRITER_DEV_ONLY === "true";
const productionHosts = new Set(["database.bloxodes.com", "bloxodesdb.ravitejaknts.com"]);

function isApprovedArticleDevUrl(value: string | undefined): boolean {
  if (!remoteArticleDev || !value) return false;
  try {
    const url = new URL(value);
    return !productionHosts.has(url.hostname) && (!articleDevUrl || articleDevUrl === value);
  } catch {
    return false;
  }
}

if (!isLocalSupabaseUrl(supabaseUrl) && !isApprovedArticleDevUrl(supabaseUrl)) {
  throw new Error(
    `Refusing to start local dev against unapproved SUPABASE_URL (${supabaseUrl ?? "unset"}). Check the article dev environment.`
  );
}

console.log(`Starting local preview against ${supabaseUrl}`);

const child = spawn("npm", ["run", "dev:web"], {
  cwd: process.cwd(),
  env: process.env,
  shell: false,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
