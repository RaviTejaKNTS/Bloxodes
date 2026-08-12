import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { readArticleImageManifest } from "./article-image-readiness";

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
  const entries = manifest.entries.filter((entry) => entry.status === "verified");

  for (const entry of entries) {
    if (
      !entry.source_page_url ||
      !entry.original_image_url ||
      !entry.uploaded_path ||
      !entry.public_url
    ) {
      throw new Error(`${entry.label}: verified provenance is incomplete`);
    }
  }

  const sb = supabaseAdmin();
  const { data: article, error: articleError } = await sb
    .from("articles")
    .select("id,slug")
    .eq("slug", manifest.article_slug)
    .maybeSingle();
  if (articleError) throw new Error(`Failed to find article ${manifest.article_slug}: ${articleError.message}`);
  if (!article) throw new Error(`Article ${manifest.article_slug} does not exist in the target environment`);

  console.log(`Article image provenance plan: slug=${manifest.article_slug} rows=${entries.length}`);
  if (!options.apply) {
    console.log("Dry run only. Add --apply to insert or update article_source_images rows.");
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
      public_url: entry.public_url!,
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
      .eq("original_url", entry.original_image_url!)
      .limit(1)
      .maybeSingle();
    if (lookupError) throw new Error(`Failed to read ${entry.label} provenance: ${lookupError.message}`);

    const operation = existing?.id
      ? sb.from("article_source_images").update(payload).eq("id", existing.id)
      : sb.from("article_source_images").insert(payload);
    const { error } = await operation;
    if (error) throw new Error(`Failed to sync ${entry.label} provenance: ${error.message}`);
  }

  console.log(`Synced ${entries.length} article_source_images row${entries.length === 1 ? "" : "s"}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
