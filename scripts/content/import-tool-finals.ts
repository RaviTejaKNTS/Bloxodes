import "../shared/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase-admin";

type CliOptions = {
  files: string[];
  dryRun: boolean;
  allowProd: boolean;
};

type ToolFinal = {
  code: string;
  title: string;
  seo_title?: string | null;
  meta_description: string;
  intro_md?: string | null;
  how_it_works_md?: string | null;
  description_json?: Record<string, unknown> | null;
  faq_json?: Array<{ q: string; a: string }> | null;
  cta_label?: string | null;
  cta_url?: string | null;
  schema_ld_json?: unknown | null;
  thumb_url?: string | null;
  universe_id?: number | null;
  is_published?: boolean;
};

type ToolRow = {
  code: string;
  title: string;
  seo_title: string;
  meta_description: string;
  intro_md: string;
  how_it_works_md: string;
  description_json: Record<string, unknown>;
  faq_json: Array<{ q: string; a: string }>;
  cta_label: string | null;
  cta_url: string | null;
  schema_ld_json: unknown | null;
  thumb_url: string | null;
  universe_id: number | null;
  is_published: boolean;
};

function printUsage() {
  console.log(
    "Usage: npm run import:tool-finals -- --file <final.json> [--file <final.json>...] [--dry-run] [--allow-prod]"
  );
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { files: [], dryRun: false, allowProd: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--file": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value for --file");
        options.files.push(value);
        i += 1;
        break;
      }
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--allow-prod":
        options.allowProd = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.files.length) throw new Error("At least one --file is required");
  return options;
}

function requiredText(value: unknown, field: string, file: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${file}: ${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string, file: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error(`${file}: ${field} must be a string or null`);
  return value.trim() || null;
}

function normalizeFaq(value: unknown, file: string): Array<{ q: string; a: string }> {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${file}: faq_json must be an array`);

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${file}: faq_json[${index}] must be an object`);
    }
    const faq = entry as Record<string, unknown>;
    return {
      q: requiredText(faq.q, `faq_json[${index}].q`, file),
      a: requiredText(faq.a, `faq_json[${index}].a`, file)
    };
  });
}

function normalizeFinal(value: unknown, file: string): ToolRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${file}: expected one tool final object`);
  }

  const final = value as ToolFinal;
  const code = requiredText(final.code, "code", file).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) {
    throw new Error(`${file}: code must be a lowercase kebab-case slug`);
  }

  const description = final.description_json ?? {};
  if (!description || typeof description !== "object" || Array.isArray(description)) {
    throw new Error(`${file}: description_json must be an object`);
  }

  const ctaUrl = optionalText(final.cta_url, "cta_url", file);
  if (ctaUrl) {
    try {
      new URL(ctaUrl);
    } catch {
      throw new Error(`${file}: cta_url must be an absolute URL`);
    }
  }

  const title = requiredText(final.title, "title", file);
  return {
    code,
    title,
    seo_title: optionalText(final.seo_title, "seo_title", file) ?? title,
    meta_description: requiredText(final.meta_description, "meta_description", file),
    intro_md: optionalText(final.intro_md, "intro_md", file) ?? "",
    how_it_works_md: optionalText(final.how_it_works_md, "how_it_works_md", file) ?? "",
    description_json: description,
    faq_json: normalizeFaq(final.faq_json, file),
    cta_label: optionalText(final.cta_label, "cta_label", file),
    cta_url: ctaUrl,
    schema_ld_json: final.schema_ld_json ?? null,
    thumb_url: optionalText(final.thumb_url, "thumb_url", file),
    universe_id: typeof final.universe_id === "number" ? final.universe_id : null,
    is_published: final.is_published ?? true
  };
}

async function loadRows(files: string[]): Promise<ToolRow[]> {
  const rows: ToolRow[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const raw = await readFile(path.resolve(process.cwd(), file), "utf8");
    const row = normalizeFinal(JSON.parse(raw) as unknown, file);
    if (seen.has(row.code)) throw new Error(`Duplicate tool code in import: ${row.code}`);
    seen.add(row.code);
    rows.push(row);
  }

  return rows;
}

function isLocalSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await loadRows(options.files);

  if (options.dryRun) {
    console.log(`Prepared ${rows.length} tools rows.`);
    rows.forEach((row) => console.log(`${row.code} | ${row.title} | ${row.is_published ? "published" : "draft"}`));
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. Use --dry-run to preview without writing.");
  }

  const isLocal = isLocalSupabaseUrl(process.env.SUPABASE_URL);
  if (!isLocal && (process.env.NODE_ENV !== "production" || !options.allowProd)) {
    throw new Error(
      "Refusing to write to non-local Supabase. Set NODE_ENV=production and pass --allow-prod after local review."
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("tools")
    .upsert(rows, { onConflict: "code" })
    .select("code,title,is_published");
  if (error) throw new Error(`Tool upsert failed: ${error.message}`);

  const saved = data ?? [];
  if (saved.length !== rows.length) {
    throw new Error(`Tool readback returned ${saved.length} rows for ${rows.length} inputs`);
  }

  for (const row of rows) {
    const match = saved.find((entry) => entry.code === row.code);
    if (!match || match.title !== row.title || match.is_published !== row.is_published) {
      throw new Error(`Tool readback mismatch for ${row.code}`);
    }
  }

  const target = isLocal ? "local Supabase" : new URL(process.env.SUPABASE_URL).hostname;
  console.log(`Upserted and verified ${rows.length} tools rows in ${target}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
