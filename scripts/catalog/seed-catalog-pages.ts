import "../shared/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type CliOptions = {
  files: string[];
  dryRun: boolean;
  allowProd: boolean;
  draft: boolean;
};

type CatalogPageFinal = {
  code: string;
  title: string;
  seo_title?: string | null;
  meta_description: string;
  intro_md?: string | null;
  description_md?: string | null;
  how_it_works_md?: string | null;
  description_json?: Record<string, unknown> | null;
  faq_json?: unknown[] | null;
  schema_ld_json?: unknown | null;
  thumb_url?: string | null;
  wiki_md?: string | null;
  wiki_sort_order?: number | null;
};

type CatalogPageRow = {
  code: string;
  title: string;
  seo_title: string;
  meta_description: string;
  intro_md: string | null;
  description_md: string | null;
  how_it_works_md: string | null;
  description_json: Record<string, unknown>;
  faq_json: unknown[];
  schema_ld_json?: unknown | null;
  thumb_url?: string | null;
  wiki_md?: string | null;
  wiki_sort_order?: number | null;
  is_published: boolean;
  published_at?: string | null;
};

function printUsage() {
  console.log(
    "Usage: npm run seed:catalog-pages -- --file <final.json> [--file <final.json>...] [--dry-run] [--draft] [--allow-prod]"
  );
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    files: [],
    dryRun: false,
    allowProd: false,
    draft: false
  };

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
      case "--draft":
        options.draft = true;
        break;
      case "--allow-prod":
        options.allowProd = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.files.length) {
    throw new Error("At least one --file is required");
  }

  return options;
}

async function readJson(filePath: string): Promise<unknown> {
  const resolved = path.resolve(process.cwd(), filePath);
  const raw = await readFile(resolved, "utf8");
  return JSON.parse(raw);
}

function isCatalogPageFinal(value: unknown): value is CatalogPageFinal {
  const candidate = value as Partial<CatalogPageFinal>;
  return Boolean(candidate?.code && candidate?.title && candidate?.meta_description);
}

function normalizeFinalRows(payload: unknown, filePath: string): CatalogPageFinal[] {
  const rows = Array.isArray(payload) ? payload : [payload];
  if (!rows.length) {
    throw new Error(`${filePath} did not contain catalog page rows.`);
  }

  return rows.map((row, index) => {
    if (!isCatalogPageFinal(row)) {
      throw new Error(`${filePath} row ${index + 1} is not a catalog_pages final.json row.`);
    }
    return row;
  });
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildRow(finalRow: CatalogPageFinal, options: CliOptions): CatalogPageRow {
  const code = finalRow.code.trim().toLowerCase();
  const title = finalRow.title.trim();
  const metaDescription = finalRow.meta_description.trim();

  if (!code || !title || !metaDescription) {
    throw new Error(`Catalog row is missing required text: ${finalRow.code}`);
  }

  return {
    code,
    title,
    seo_title: normalizeText(finalRow.seo_title) ?? title,
    meta_description: metaDescription,
    intro_md: normalizeText(finalRow.intro_md),
    description_md: normalizeText(finalRow.description_md),
    how_it_works_md: normalizeText(finalRow.how_it_works_md),
    description_json: finalRow.description_json ?? {},
    faq_json: finalRow.faq_json ?? [],
    schema_ld_json: finalRow.schema_ld_json ?? null,
    thumb_url: normalizeText(finalRow.thumb_url),
    wiki_md: normalizeText(finalRow.wiki_md),
    wiki_sort_order: typeof finalRow.wiki_sort_order === "number" ? finalRow.wiki_sort_order : null,
    is_published: !options.draft,
    published_at: options.draft ? null : new Date().toISOString()
  };
}

async function loadRows(options: CliOptions): Promise<CatalogPageRow[]> {
  const rows: CatalogPageRow[] = [];
  const seen = new Set<string>();

  for (const file of options.files) {
    const payload = await readJson(file);
    for (const finalRow of normalizeFinalRows(payload, file)) {
      const row = buildRow(finalRow, options);
      if (seen.has(row.code)) {
        throw new Error(`Duplicate catalog page code in import payload: ${row.code}`);
      }
      seen.add(row.code);
      rows.push(row);
    }
  }

  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await loadRows(options);

  if (options.dryRun) {
    console.log(`Prepared ${rows.length} catalog_pages rows.`);
    for (const row of rows) {
      console.log(`${row.code} | ${row.title} | ${row.is_published ? "published" : "draft"}`);
    }
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. Use --dry-run to preview without writing.");
  }
  if (!options.allowProd && !isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to write outside managed development. Use --allow-prod only after managed-dev review is clean.");
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("catalog_pages").upsert(rows, { onConflict: "code" });
  if (error) throw error;

  console.log(`Upserted ${rows.length} ${options.draft ? "draft" : "published"} catalog_pages rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
