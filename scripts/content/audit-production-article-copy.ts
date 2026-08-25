import { createClient } from "@supabase/supabase-js";

import { readBloxodesEnvFile } from "../shared/env-files";
import { isProductionSupabaseUrl } from "../shared/supabase-target";
import { scanPublicCopy } from "./public-copy-rules";

type Options = {
  allRules: boolean;
  days: number | null;
  json: boolean;
  slug: string | null;
};

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  content_md: string;
  faq_json: unknown;
  published_at: string | null;
  updated_at: string | null;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { allRules: false, days: 30, json: false, slug: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") options.days = null;
    else if (arg === "--all-rules") options.allRules = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--days" || arg.startsWith("--days=")) {
      const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++index];
      const days = Number(raw);
      if (!Number.isSafeInteger(days) || days <= 0) throw new Error("--days requires a positive integer");
      options.days = days;
    } else if (arg === "--slug" || arg.startsWith("--slug=")) {
      const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++index];
      options.slug = raw?.trim().toLowerCase() || null;
      if (!options.slug) throw new Error("--slug requires a value");
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run articles:audit-copy:production -- [--days 30 | --all] [--slug SLUG] [--all-rules] [--json]");
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function required(env: Record<string, string>, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing ${key} in .envs/targets/production.env`);
  return value;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = readBloxodesEnvFile("targets/production.env");
  const url = required(env, "SUPABASE_URL");
  const key = required(env, "SUPABASE_SERVICE_ROLE");
  if (!isProductionSupabaseUrl(url)) throw new Error("Production copy audit requires the production Supabase host");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const rows: ArticleRow[] = [];
  const pageSize = 500;
  const cutoff = options.days
    ? new Date(Date.now() - options.days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("articles")
      .select("id,slug,title,meta_description,content_md,faq_json,published_at,updated_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1);
    if (cutoff) query = query.gte("published_at", cutoff);
    if (options.slug) query = query.eq("slug", options.slug);
    const { data, error } = await query;
    if (error) throw new Error(`Could not read production articles: ${error.message}`);
    rows.push(...((data ?? []) as ArticleRow[]));
    if (!data || data.length < pageSize) break;
  }

  const sourceRules = new Set([
    "public source attribution",
    "public source or research workflow",
    "public editorial disclaimer",
    "public competitor/source name",
    "public research narration",
    "public guide/report attribution",
  ]);
  const violations = rows.flatMap((row) =>
    scanPublicCopy(
      {
        title: row.title,
        meta_description: row.meta_description,
        content_md: row.content_md,
        faq_json: row.faq_json,
      },
      row.slug
    )
    .filter((finding) => options.allRules || sourceRules.has(finding.rule))
    .map((finding) => ({
      slug: row.slug,
      published_at: row.published_at,
      updated_at: row.updated_at,
      field: finding.field,
      rule: finding.rule,
      excerpt: finding.excerpt,
    }))
  );
  const affected = new Set(violations.map((finding) => finding.slug));
  const output = {
    scope: options.slug ?? (options.days ? `published in the last ${options.days} days` : "all published articles"),
    scanned_articles: rows.length,
    affected_articles: affected.size,
    findings: violations.length,
    violations,
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(
    `Production article copy audit: scanned=${output.scanned_articles} affected=${output.affected_articles} findings=${output.findings} scope=${output.scope}`
  );
  for (const finding of violations) {
    console.log(`- ${finding.slug} :: ${finding.field} :: ${finding.rule}`);
    console.log(`  ${finding.excerpt}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
