import "../shared/load-env";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { classifyArticleImageSrc } from "@/lib/article-media";
import { canonicalArticleMediaUrl, findArticleImages, readArticleImageManifest, usedVerifiedArticleImages, type ArticleImageManifest } from "./article-image-readiness";

type CliOptions = {
  manifest: string;
  apply: boolean;
  allowProd: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { manifest: "", apply: false, allowProd: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") {
      options.manifest = String(argv[index + 1] ?? "").trim();
      index += 1;
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--allow-prod") {
      options.allowProd = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npm run sync:article-image-provenance -- --manifest <media.json> [--apply] [--allow-prod]"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.manifest) throw new Error("--manifest is required");
  return options;
}

function assertTargetAllowed(options: CliOptions): void {
  const raw = process.env.SUPABASE_URL?.trim();
  if (!raw || !process.env.SUPABASE_SERVICE_ROLE?.trim()) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required");
  }
  const production = new URL(raw).hostname.toLowerCase() === "database.bloxodes.com";
  if (production && !(options.allowProd && process.env.NODE_ENV === "production")) {
    throw new Error("Production provenance writes require NODE_ENV=production and --allow-prod");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertTargetAllowed(options);
  const manifest = await readArticleImageManifest(options.manifest);
  await syncArticleImageProvenance(manifest, options);
}

export async function removeUnusedArticleImageProvenance(articleId: string, content: string, sb = supabaseAdmin()): Promise<void> {
  const usedUrls = new Set(findArticleImages(content).map(image => canonicalArticleMediaUrl(image.src)));
  const { data: rows, error: readError } = await sb
    .from("article_source_images")
    .select("id,public_url")
    .eq("article_id", articleId);
  if (readError) throw new Error(`Failed to read article ${articleId} provenance for cleanup: ${readError.message}`);
  const staleIds = (rows ?? []).filter(row => !usedUrls.has(canonicalArticleMediaUrl(row.public_url ?? ""))).map(row => row.id);
  if (!staleIds.length) return;

  const { error } = await sb
    .from("article_source_images")
    .delete()
    .eq("article_id", articleId)
    .in("id", staleIds);
  if (error) throw new Error(`Failed to remove unused article ${articleId} provenance: ${error.message}`);
}

export async function syncArticleImageProvenance(manifest: ArticleImageManifest, options: Pick<CliOptions, "apply">, sb = supabaseAdmin()) {
  const { data: article, error: articleError } = await sb
    .from("articles")
    .select("id,slug,content_md")
    .eq("slug", manifest.article_slug)
    .maybeSingle();
  if (articleError) throw new Error(`Failed to find article ${manifest.article_slug}: ${articleError.message}`);
  if (!article) throw new Error(`Article ${manifest.article_slug} does not exist in the target environment`);

  const entries = usedVerifiedArticleImages(manifest, article.content_md ?? "").filter(entry =>
    !(entry.public_url?.startsWith("/") && classifyArticleImageSrc(entry.public_url, manifest.article_slug).ok));
  for (const entry of entries) {
    if (!entry.source_page_url || !entry.original_image_url || !entry.uploaded_path || !entry.public_url) {
      throw new Error(`${entry.label}: verified provenance is incomplete`);
    }
  }

  console.log(`Article image provenance plan: slug=${manifest.article_slug} rows=${entries.length}`);
  if (!options.apply) {
    console.log("Dry run only. Add --apply to sync article_source_images and remove rows for images absent from this article body.");
    return;
  }

  for (const entry of entries) {
    const payload = {
      article_id: article.id,
      source_url: entry.source_page_url!,
      source_host: new URL(entry.source_page_url!).hostname.replace(/^www\./i, "").toLowerCase(),
      name: entry.label,
      original_url: entry.original_image_url!,
      uploaded_path: entry.uploaded_path!,
      public_url: entry.public_url!.trim(),
      alt_text: entry.alt ?? null,
      caption: null,
      context: entry.match_evidence ?? entry.placement_heading,
      is_table: false,
      width: entry.width ?? null,
      height: entry.height ?? null,
      table_key: null,
      row_text: entry.placement_heading,
    };
    const { data: existing, error: lookupError } = await sb
      .from("article_source_images")
      .select("id")
      .eq("article_id", article.id)
      .eq("uploaded_path", entry.uploaded_path!)
      .limit(1)
      .maybeSingle();
    if (lookupError) throw new Error(`Failed to read ${entry.label} provenance: ${lookupError.message}`);

    const operation = existing?.id
      ? sb.from("article_source_images").update(payload).eq("id", existing.id).eq("article_id", article.id)
      : sb.from("article_source_images").insert(payload);
    const { error } = await operation;
    if (error) throw new Error(`Failed to sync ${entry.label} provenance: ${error.message}`);
  }

  await removeUnusedArticleImageProvenance(article.id, article.content_md ?? "", sb);
  console.log(`Synced ${entries.length} article_source_images row${entries.length === 1 ? "" : "s"}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
