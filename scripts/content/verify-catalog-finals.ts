import "../shared/load-env";

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase-admin";

type CatalogFinal = {
  code: string;
  title: string;
  meta_description: string;
};

type CliOptions = {
  baseUrl: string;
  files: string[];
};

function printUsage() {
  console.log(
    "Usage: npm run verify:catalog-finals -- --base-url http://localhost:3000 --file <catalog-final.json> [...]"
  );
}

function parseArgs(argv: string[]): CliOptions {
  let baseUrl: string | null = null;
  const files: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--base-url":
        baseUrl = argv[++i] ?? null;
        break;
      case "--file":
        files.push(argv[++i] ?? "");
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!baseUrl) throw new Error("--base-url is required");
  if (!files.length || files.some((file) => !file)) throw new Error("At least one --file is required");
  return { baseUrl: new URL(baseUrl).toString().replace(/\/$/, ""), files };
}

function isCatalogFinal(value: unknown): value is CatalogFinal {
  const candidate = value as Partial<CatalogFinal>;
  return Boolean(candidate?.code && candidate.title && candidate.meta_description);
}

async function readFinals(files: string[]) {
  const rows: CatalogFinal[] = [];
  for (const file of files) {
    const parsed = JSON.parse(await readFile(path.resolve(process.cwd(), file), "utf8")) as unknown;
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    for (const entry of entries) {
      if (!isCatalogFinal(entry)) throw new Error(`${file} is not a catalog_pages final.json row`);
      rows.push({
        code: entry.code.trim().toLowerCase(),
        title: entry.title.trim(),
        meta_description: entry.meta_description.trim(),
      });
    }
  }
  return rows;
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function verifyReadback(rows: CatalogFinal[]) {
  const sb = supabaseAdmin();
  for (const row of rows) {
    const { data, error } = await sb
      .from("catalog_pages")
      .select("code,title,meta_description,is_published")
      .eq("code", row.code)
      .maybeSingle();
    if (error) throw new Error(`Failed to read catalog ${row.code}: ${error.message}`);
    if (!data) throw new Error(`No catalog_pages row found for ${row.code}`);
    const saved = data as { title?: string | null; meta_description?: string | null; is_published?: boolean };
    if (!saved.is_published) throw new Error(`Catalog ${row.code} is not published`);
    if (saved.title !== row.title) throw new Error(`Catalog title mismatch for ${row.code}`);
    if (saved.meta_description !== row.meta_description) throw new Error(`Catalog meta_description mismatch for ${row.code}`);
  }
}

async function verifyRoute(url: string, title: string) {
  const response = await fetch(url, { redirect: "follow" });
  const body = await response.text();
  if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
  if (!body.includes(title) && !body.includes(title.replace(/&/g, "&amp;"))) {
    throw new Error(`${url} returned 200 but did not include the catalog title`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await readFinals(options.files);

  await runCommand("npm", ["run", "content:check-copy", "--", ...options.files]);
  await runCommand("npm", ["run", "seed:catalog-pages", "--", ...options.files.flatMap((file) => ["--file", file])]);
  await verifyReadback(rows);

  const urls = rows.map((row) => `${options.baseUrl}/catalog/${row.code}`);
  for (let index = 0; index < rows.length; index += 1) {
    await verifyRoute(urls[index], rows[index].title);
    console.log(`Route passed: ${urls[index]}`);
  }

  console.log("\nVerified localhost links:");
  urls.forEach((url) => console.log(`- ${url}`));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
