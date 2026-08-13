import "../shared/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type ToolFinal = {
  code: string;
  title: string;
  seo_title?: string | null;
  meta_description: string;
  intro_md?: string | null;
  how_it_works_md?: string | null;
  description_json?: Record<string, unknown> | null;
  faq_json?: unknown[] | null;
  cta_label?: string | null;
  cta_url?: string | null;
  thumb_url?: string | null;
  universe_id?: number | null;
  is_published?: boolean;
};

type EventsFinal = {
  universe_id: number;
  slug: string;
  title: string;
  seo_title?: string | null;
  meta_description: string;
  content_md: string;
  is_published?: boolean;
};

type FinalEntry =
  | { kind: "tool"; file: string; row: ToolFinal; code: string; title: string; urlPath: string }
  | { kind: "event"; file: string; row: EventsFinal; slug: string; title: string; urlPath: string };

type CliOptions = {
  baseUrl: string;
  files: string[];
};

function printUsage() {
  console.log(
    "Usage: npm run verify:simple-page-finals -- --base-url http://localhost:3000 --file <tool-or-event-final.json> [...]"
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

function isToolFinal(value: unknown): value is ToolFinal {
  const candidate = value as Partial<ToolFinal>;
  return Boolean(candidate?.code && candidate.title && candidate.meta_description && "intro_md" in candidate);
}

function isEventsFinal(value: unknown): value is EventsFinal {
  const candidate = value as Partial<EventsFinal>;
  return Boolean(candidate?.slug && candidate.title && candidate.meta_description && candidate.content_md && candidate.universe_id);
}

async function readEntry(file: string): Promise<FinalEntry> {
  const parsed = JSON.parse(await readFile(path.resolve(process.cwd(), file), "utf8")) as unknown;
  if (isToolFinal(parsed)) {
    const code = parsed.code.trim().toLowerCase();
    return { kind: "tool", file, row: parsed, code, title: parsed.title.trim(), urlPath: `/tools/${code}` };
  }
  if (isEventsFinal(parsed)) {
    const slug = parsed.slug.trim().toLowerCase();
    return { kind: "event", file, row: parsed, slug, title: parsed.title.trim(), urlPath: `/events/${slug}` };
  }
  throw new Error(`${file} is not a supported tool or events final.json`);
}

function assertLocalWriteTarget() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE.");
  }
  if (!isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing verification writes outside managed Supabase development.");
  }
}

async function upsertEntry(entry: FinalEntry) {
  const sb = supabaseAdmin();
  if (entry.kind === "tool") {
    const row = entry.row;
    const payload = {
      code: entry.code,
      title: row.title.trim(),
      seo_title: row.seo_title ?? row.title.trim(),
      meta_description: row.meta_description.trim(),
      intro_md: row.intro_md ?? "",
      how_it_works_md: row.how_it_works_md ?? "",
      description_json: row.description_json ?? {},
      faq_json: row.faq_json ?? [],
      cta_label: row.cta_label ?? null,
      cta_url: row.cta_url ?? null,
      thumb_url: row.thumb_url ?? null,
      universe_id: row.universe_id ?? null,
      is_published: row.is_published ?? true,
      published_at: row.is_published === false ? null : new Date().toISOString(),
    };
    const { error } = await sb.from("tools").upsert(payload, { onConflict: "code" });
    if (error) throw new Error(`Failed to upsert tool ${entry.code}: ${error.message}`);
    return;
  }

  const row = entry.row;
  const payload = {
    universe_id: row.universe_id,
    slug: entry.slug,
    title: row.title.trim(),
    seo_title: row.seo_title ?? row.title.trim(),
    meta_description: row.meta_description.trim(),
    content_md: row.content_md.trim(),
    is_published: row.is_published ?? true,
    published_at: row.is_published === false ? null : new Date().toISOString(),
  };
  const { error } = await sb.from("events_pages").upsert(payload, { onConflict: "slug" });
  if (error) throw new Error(`Failed to upsert events page ${entry.slug}: ${error.message}`);
}

async function verifyReadback(entry: FinalEntry) {
  const sb = supabaseAdmin();
  if (entry.kind === "tool") {
    const { data, error } = await sb
      .from("tools")
      .select("code,title,meta_description,is_published")
      .eq("code", entry.code)
      .maybeSingle();
    if (error) throw new Error(`Failed to read tool ${entry.code}: ${error.message}`);
    if (!data) throw new Error(`No tools row found for ${entry.code}`);
    const row = data as { title?: string | null; meta_description?: string | null; is_published?: boolean };
    if (!row.is_published) throw new Error(`Tool ${entry.code} is not published`);
    if (row.title !== entry.title) throw new Error(`Tool title mismatch for ${entry.code}`);
    return;
  }

  const { data, error } = await sb
    .from("events_pages")
    .select("slug,title,meta_description,content_md,is_published")
    .eq("slug", entry.slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to read events page ${entry.slug}: ${error.message}`);
  if (!data) throw new Error(`No events_pages row found for ${entry.slug}`);
  const row = data as { title?: string | null; content_md?: string | null; is_published?: boolean };
  if (!row.is_published) throw new Error(`Events page ${entry.slug} is not published`);
  if (row.title !== entry.title) throw new Error(`Events page title mismatch for ${entry.slug}`);
  if (!row.content_md?.trim()) throw new Error(`Events page ${entry.slug} has empty content_md`);
}

async function verifyRoute(url: string, title: string) {
  const response = await fetch(url, { redirect: "follow" });
  const body = await response.text();
  if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
  if (!body.includes(title) && !body.includes(title.replace(/&/g, "&amp;"))) {
    throw new Error(`${url} returned 200 but did not include the page title`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = await Promise.all(options.files.map(readEntry));
  assertLocalWriteTarget();

  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["run", "content:check-copy", "--", ...options.files], {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`content:check-copy exited with code ${code ?? "unknown"}`))
    );
  });

  for (const entry of entries) {
    await upsertEntry(entry);
    await verifyReadback(entry);
  }

  const urls = entries.map((entry) => `${options.baseUrl}${entry.urlPath}`);
  for (let index = 0; index < entries.length; index += 1) {
    await verifyRoute(urls[index], entries[index].title);
    console.log(`Route passed: ${urls[index]}`);
  }

  console.log("\nVerified localhost links:");
  urls.forEach((url) => console.log(`- ${url}`));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
