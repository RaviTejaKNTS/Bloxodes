import "../shared/load-env";

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveContentDates } from "../../apps/web/src/lib/content-dates";

type Row = Record<string, unknown>;

type TableContract = {
  table: string;
  select: string;
  publishedColumn?: string;
  identityField: string;
  titleField: string;
  routeFor: (row: Row) => string | null;
  descriptionFields: string[];
  bodyFields?: string[];
  imageFields?: string[];
  requirePublishedDate?: boolean;
};

type ValidationIssue = {
  severity: "error" | "warning";
  table: string;
  identity: string;
  route: string | null;
  code: string;
  message: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_REPORT_DIR = path.join(repoRoot, "tmp/test-reports");
const PAGE_SIZE = 1_000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isCanonicalSlugPath(value: string): boolean {
  return value.split("/").every((segment) => SLUG_PATTERN.test(segment));
}

const TABLE_CONTRACTS: TableContract[] = [
  {
    table: "code_pages",
    select:
      "id,name,slug,seo_description,intro_md,redeem_md,find_codes_md,troubleshoot_md,rewards_md,source_url,source_url_2,roblox_link,cover_image,is_published,published_at,created_at,updated_at",
    publishedColumn: "is_published",
    identityField: "slug",
    titleField: "name",
    routeFor: (row) => stringValue(row.slug) ? `/codes/${stringValue(row.slug)}` : null,
    descriptionFields: ["seo_description", "intro_md"],
    bodyFields: ["intro_md", "redeem_md", "find_codes_md", "troubleshoot_md"],
    imageFields: ["cover_image"]
  },
  {
    table: "articles",
    select:
      "id,title,slug,content_md,meta_description,faq_json,cover_image,is_published,published_at,created_at,updated_at",
    publishedColumn: "is_published",
    identityField: "slug",
    titleField: "title",
    routeFor: (row) => stringValue(row.slug) ? `/articles/${stringValue(row.slug)}` : null,
    descriptionFields: ["meta_description"],
    bodyFields: ["content_md"],
    imageFields: ["cover_image"]
  },
  {
    table: "catalog_pages",
    select:
      "id,code,title,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,thumb_url,is_published,published_at,created_at,updated_at",
    publishedColumn: "is_published",
    identityField: "code",
    titleField: "title",
    routeFor: (row) => stringValue(row.code) ? `/catalog/${stringValue(row.code)}` : null,
    descriptionFields: ["meta_description"],
    bodyFields: ["intro_md", "description_md", "how_it_works_md", "description_json"],
    imageFields: ["thumb_url"]
  },
  {
    table: "tools",
    select:
      "id,code,title,meta_description,intro_md,how_it_works_md,description_json,faq_json,thumb_url,is_published,published_at,created_at,updated_at",
    publishedColumn: "is_published",
    identityField: "code",
    titleField: "title",
    routeFor: (row) => stringValue(row.code) ? `/tools/${stringValue(row.code)}` : null,
    descriptionFields: ["meta_description"],
    bodyFields: ["intro_md", "how_it_works_md", "description_json"],
    imageFields: ["thumb_url"]
  },
  {
    table: "wiki_pages",
    select:
      "id,slug,title,meta_description,description_md,controls_json,tips_md,cover_image,is_published,published_at,created_at,updated_at",
    publishedColumn: "is_published",
    identityField: "slug",
    titleField: "title",
    routeFor: (row) => stringValue(row.slug) ? `/wiki/${stringValue(row.slug)}` : null,
    descriptionFields: ["meta_description"],
    bodyFields: ["description_md", "tips_md", "controls_json"],
    imageFields: ["cover_image"]
  },
  {
    table: "wiki_collection_pages",
    select:
      "id,wiki_page_id,wiki_slug,collection_slug,code,title,display_name,item_count,meta_description,intro_md,how_it_works_md,description_md,description_json,faq_json,thumb_url,is_published,published_at,created_at,updated_at",
    publishedColumn: "is_published",
    identityField: "code",
    titleField: "title",
    routeFor: (row) =>
      stringValue(row.wiki_slug) && stringValue(row.collection_slug)
        ? `/wiki/${stringValue(row.wiki_slug)}/${stringValue(row.collection_slug)}`
        : null,
    descriptionFields: ["meta_description"],
    bodyFields: ["intro_md", "description_md", "how_it_works_md", "description_json"],
    imageFields: ["thumb_url"]
  },
  {
    table: "events_pages",
    select:
      "id,slug,title,content_md,meta_description,is_published,published_at,created_at,updated_at",
    publishedColumn: "is_published",
    identityField: "slug",
    titleField: "title",
    routeFor: (row) => stringValue(row.slug) ? `/events/${stringValue(row.slug)}` : null,
    descriptionFields: ["meta_description"],
    bodyFields: ["content_md"]
  },
  {
    table: "checklist_pages",
    select:
      "id,slug,title,description_md,seo_description,is_public,published_at,created_at,updated_at",
    publishedColumn: "is_public",
    identityField: "slug",
    titleField: "title",
    routeFor: (row) => stringValue(row.slug) ? `/checklists/${stringValue(row.slug)}` : null,
    descriptionFields: ["seo_description", "description_md"],
    bodyFields: ["description_md"]
  },
  {
    table: "quiz_pages",
    select:
      "id,code,title,description_md,seo_description,is_published,published_at,created_at,updated_at",
    publishedColumn: "is_published",
    identityField: "code",
    titleField: "title",
    routeFor: (row) => stringValue(row.code) ? `/quizzes/${stringValue(row.code)}` : null,
    descriptionFields: ["seo_description", "description_md"],
    bodyFields: ["description_md"]
  },
  {
    table: "puzzle_pages",
    select:
      "id,slug,title,meta_description,intro_md,answer_intro_md,how_to_play_md,description_md,icon_url,is_published,published_at,created_at,updated_at",
    publishedColumn: "is_published",
    identityField: "slug",
    titleField: "title",
    routeFor: (row) => stringValue(row.slug) ? `/puzzles/${stringValue(row.slug)}` : null,
    descriptionFields: ["meta_description"],
    bodyFields: ["intro_md", "answer_intro_md", "how_to_play_md", "description_md"],
    imageFields: ["icon_url"]
  },
  {
    table: "authors",
    select: "id,name,slug,bio_md,avatar_url,created_at,updated_at",
    identityField: "slug",
    titleField: "name",
    routeFor: (row) => stringValue(row.slug) ? `/authors/${stringValue(row.slug)}` : null,
    descriptionFields: ["bio_md"],
    imageFields: ["avatar_url"],
    requirePublishedDate: false
  }
];

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasContent(value: unknown): boolean {
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

function isLocalSupabaseUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

function parseOptions() {
  const args = process.argv.slice(2);
  let reportDir = DEFAULT_REPORT_DIR;
  let allowRemoteRead = false;
  let failOnWarning = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--allow-remote-read") allowRemoteRead = true;
    else if (arg === "--fail-on-warning") failOnWarning = true;
    else if (arg === "--report-dir") {
      const value = args[index + 1];
      if (!value) throw new Error("--report-dir requires a value");
      reportDir = path.resolve(repoRoot, value);
      index += 1;
    } else if (arg === "--help") {
      console.log(`Usage: npm run validate:published-content -- [--allow-remote-read] [--fail-on-warning] [--report-dir <path>]\n\nThe validator is read-only and refuses non-local Supabase by default.`);
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { reportDir, allowRemoteRead, failOnWarning };
}

async function readAllRows(client: SupabaseClient, contract: TableContract): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(contract.table).select(contract.select);
    if (contract.publishedColumn) query = query.eq(contract.publishedColumn, true);
    const { data, error } = await query.order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${contract.table}: ${error.message}`);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function pushIssue(
  issues: ValidationIssue[],
  contract: TableContract,
  row: Row,
  code: string,
  message: string,
  severity: ValidationIssue["severity"] = "error"
) {
  issues.push({
    severity,
    table: contract.table,
    identity: stringValue(row[contract.identityField]) || stringValue(row.id) || "unknown",
    route: contract.routeFor(row),
    code,
    message
  });
}

async function validateLocalImage(
  issues: ValidationIssue[],
  contract: TableContract,
  row: Row,
  field: string
) {
  const value = stringValue(row[field]);
  if (!value || !value.startsWith("/") || value.startsWith("//")) return;
  let decoded = value.replace(/^\/+/, "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    pushIssue(issues, contract, row, "invalid-image-url", `${field} contains invalid URL encoding: ${value}`);
    return;
  }
  const localPath = path.join(repoRoot, "apps/web/public", decoded);
  try {
    const info = await stat(localPath);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    pushIssue(issues, contract, row, "missing-local-image", `${field} points to missing file ${value}`);
  }
}

async function validateRow(issues: ValidationIssue[], contract: TableContract, row: Row) {
  const identity = stringValue(row[contract.identityField]);
  const title = stringValue(row[contract.titleField]);
  if (!identity) pushIssue(issues, contract, row, "missing-identity", `Missing ${contract.identityField}`);
  if (identity && !isCanonicalSlugPath(identity)) {
    pushIssue(issues, contract, row, "invalid-slug", `${contract.identityField} is not a canonical kebab-case slug`);
  }
  if (contract.table === "code_pages" && identity.endsWith("-codes")) {
    pushIssue(issues, contract, row, "codes-suffix-in-slug", "Codes slugs must not end in -codes");
  }
  if (!title) pushIssue(issues, contract, row, "missing-title", `Missing ${contract.titleField}`);
  if (!contract.routeFor(row)) pushIssue(issues, contract, row, "missing-route", "Could not build a public route");

  if (!contract.descriptionFields.some((field) => hasContent(row[field]))) {
    pushIssue(issues, contract, row, "missing-description", `Expected one of ${contract.descriptionFields.join(", ")}`);
  }
  if (contract.bodyFields?.length && !contract.bodyFields.some((field) => hasContent(row[field]))) {
    pushIssue(
      issues,
      contract,
      row,
      "missing-body",
      `Expected one of ${contract.bodyFields.join(", ")}; rendered route checks must prove an approved code-backed body`,
      "warning"
    );
  }

  const dates = resolveContentDates(
    {
      published_at: stringValue(row.published_at) || null,
      created_at: stringValue(row.created_at) || null,
      updated_at: stringValue(row.updated_at) || null
    },
    { requirePublished: contract.requirePublishedDate !== false }
  );
  for (const issue of dates.issues) {
    pushIssue(issues, contract, row, issue.code, `${issue.field ?? "date"}: ${issue.value ?? "missing"}`);
  }

  for (const field of ["faq_json", "description_json", "controls_json"] as const) {
    const value = row[field];
    if (typeof value === "string" && value.trim()) {
      try {
        JSON.parse(value);
      } catch {
        pushIssue(issues, contract, row, "invalid-json-field", `${field} is not valid JSON`);
      }
    }
  }

  if (contract.table === "code_pages") {
    const robloxLink = stringValue(row.roblox_link);
    const sourceUrl = stringValue(row.source_url);
    const sourceUrl2 = stringValue(row.source_url_2);
    if (!robloxLink) pushIssue(issues, contract, row, "missing-roblox-link", "roblox_link is required");
    if (robloxLink && !robloxLink.includes("roblox.com/")) {
      pushIssue(issues, contract, row, "invalid-roblox-link", "roblox_link must use roblox.com");
    }
    if (!sourceUrl && !sourceUrl2) {
      pushIssue(issues, contract, row, "missing-code-source", "At least one codes source URL is required");
    }
    if (sourceUrl && !sourceUrl.includes("robloxden.com/")) {
      pushIssue(issues, contract, row, "unexpected-source-url", "source_url must be a RobloxDen codes page");
    }
    if (sourceUrl2 && !sourceUrl2.includes("beebom.com/")) {
      pushIssue(issues, contract, row, "unexpected-source-url-2", "source_url_2 must be a Beebom codes page");
    }
  }

  if (contract.table === "wiki_collection_pages") {
    const wikiSlug = stringValue(row.wiki_slug);
    const collectionSlug = stringValue(row.collection_slug);
    const expectedCode = wikiSlug && collectionSlug ? `${wikiSlug}-${collectionSlug}` : "";
    if (identity && expectedCode && identity !== expectedCode) {
      pushIssue(issues, contract, row, "invalid-collection-code", `Expected code ${expectedCode}`);
    }
    if (typeof row.item_count === "number" && row.item_count <= 0) {
      pushIssue(issues, contract, row, "empty-collection", "Published collection item_count must be positive");
    }
  }

  for (const field of contract.imageFields ?? []) await validateLocalImage(issues, contract, row, field);
}

function markdownReport(generatedAt: string, counts: Record<string, number>, issues: ValidationIssue[]) {
  const lines = [
    "# Published content validation",
    "",
    `Generated: ${generatedAt}`,
    "",
    `Rows checked: ${Object.values(counts).reduce((sum, count) => sum + count, 0)}`,
    `Errors: ${issues.filter((issue) => issue.severity === "error").length}`,
    `Warnings: ${issues.filter((issue) => issue.severity === "warning").length}`,
    "",
    "## Table counts",
    "",
    ...Object.entries(counts).map(([table, count]) => `- ${table}: ${count}`),
    "",
    "## Issues",
    "",
    ...(issues.length
      ? issues.map(
          (issue) =>
            `- [${issue.severity}] ${issue.table}:${issue.identity} ${issue.code} - ${issue.message}${issue.route ? ` (${issue.route})` : ""}`
        )
      : ["- None"])
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseOptions();
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required");
  if (!isLocalSupabaseUrl(url) && !options.allowRemoteRead) {
    throw new Error("Refusing non-local Supabase. Pass --allow-remote-read for an intentional read-only candidate check.");
  }

  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const issues: ValidationIssue[] = [];
  const counts: Record<string, number> = {};
  const rowsByTable = new Map<string, Row[]>();

  for (const contract of TABLE_CONTRACTS) {
    const rows = await readAllRows(client, contract);
    rowsByTable.set(contract.table, rows);
    counts[contract.table] = rows.length;
    for (const row of rows) await validateRow(issues, contract, row);
  }

  const wikiSlugs = new Set((rowsByTable.get("wiki_pages") ?? []).map((row) => stringValue(row.slug)).filter(Boolean));
  const collectionContract = TABLE_CONTRACTS.find((contract) => contract.table === "wiki_collection_pages");
  if (collectionContract) {
    for (const row of rowsByTable.get("wiki_collection_pages") ?? []) {
      const wikiSlug = stringValue(row.wiki_slug);
      if (wikiSlug && !wikiSlugs.has(wikiSlug)) {
        pushIssue(issues, collectionContract, row, "missing-wiki-hub", `No published wiki_pages row for ${wikiSlug}`);
      }
      if (!stringValue(row.wiki_page_id)) {
        pushIssue(
          issues,
          collectionContract,
          row,
          "missing-wiki-page-id",
          "Published collection is not linked to wiki_pages",
          "warning"
        );
      }
    }
  }

  const routeOwners = new Map<string, string>();
  for (const contract of TABLE_CONTRACTS) {
    for (const row of rowsByTable.get(contract.table) ?? []) {
      const route = contract.routeFor(row);
      if (!route) continue;
      const owner = `${contract.table}:${stringValue(row[contract.identityField])}`;
      const existing = routeOwners.get(route);
      if (existing) pushIssue(issues, contract, row, "duplicate-route", `${route} is also owned by ${existing}`);
      else routeOwners.set(route, owner);
    }
  }

  const generatedAt = new Date().toISOString();
  const routeDates = TABLE_CONTRACTS.flatMap((contract) =>
    (rowsByTable.get(contract.table) ?? []).flatMap((row) => {
      const route = contract.routeFor(row);
      if (!route) return [];
      const dates = resolveContentDates(
        {
          published_at: stringValue(row.published_at) || null,
          created_at: stringValue(row.created_at) || null,
          updated_at: stringValue(row.updated_at) || null
        },
        { requirePublished: contract.requirePublishedDate !== false }
      );
      return [{
        route,
        table: contract.table,
        identity: stringValue(row[contract.identityField]),
        publishedAt: dates.publishedAt,
        modifiedAt: dates.modifiedAt
      }];
    })
  );
  const report = {
    generatedAt,
    source: isLocalSupabaseUrl(url) ? "local" : "remote-read-only",
    counts,
    routeDates,
    issues
  };
  await mkdir(options.reportDir, { recursive: true });
  await writeFile(path.join(options.reportDir, "published-content.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(options.reportDir, "published-content.md"), markdownReport(generatedAt, counts, issues));

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  console.log(`Published content: ${Object.values(counts).reduce((sum, count) => sum + count, 0)} rows, ${errors.length} errors, ${warnings.length} warnings`);
  console.log(`Reports: ${options.reportDir}`);
  if (errors.length || (options.failOnWarning && warnings.length)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
