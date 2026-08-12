import "../shared/load-env";

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { toMediaPublicUrl } from "../shared/storage-public-url";
import {
  type ArticleImageEntry,
  type ArticleImageManifest,
  readArticleImageManifest,
} from "./article-image-readiness";

type CliOptions = {
  manifest: string;
  finalFile: string;
  apply: boolean;
  allowProd: boolean;
};

type ArticleFinal = {
  slug: string;
  content_md: string;
  [key: string]: unknown;
};

function printUsage() {
  console.log(`Usage:
  npm run collect:article-images -- --manifest <media.json> [--file <final.json>] [--apply]

The default is a read-only dry run. --apply downloads exact-match verified images,
converts them to WebP, uploads them to Supabase Storage, verifies readback, and
updates media.json with uploaded_path, public_url, width, and height.

During an approved production release, pass the reviewed final.json too. The
collector copies the approved managed-dev bytes to the same production object
path and rewrites the managed-dev image URLs in final.json to production URLs.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { manifest: "", finalFile: "", apply: false, allowProd: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") {
      options.manifest = String(argv[index + 1] ?? "").trim();
      index += 1;
    } else if (arg === "--file") {
      options.finalFile = String(argv[index + 1] ?? "").trim();
      index += 1;
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--allow-prod") {
      options.allowProd = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.manifest) throw new Error("--manifest is required");
  return options;
}

function assertCollectionReady(entry: ArticleImageEntry): void {
  if (entry.status !== "verified") return;
  if (!entry.source_page_url || !entry.original_image_url) {
    throw new Error(`${entry.label}: verified entries need source_page_url and original_image_url`);
  }
  if (!entry.match_evidence || entry.match_evidence.trim().length < 12) {
    throw new Error(`${entry.label}: record exact-match evidence before collecting`);
  }
  if (!entry.rights_note || entry.rights_note.trim().length < 8) {
    throw new Error(`${entry.label}: record the source/usage basis before collecting`);
  }
  if (!entry.alt || entry.alt.trim().length < 8) {
    throw new Error(`${entry.label}: add useful alt text before collecting`);
  }
}

function assertTargetAllowed(options: CliOptions): void {
  const raw = process.env.SUPABASE_URL?.trim();
  const bucket = process.env.SUPABASE_MEDIA_BUCKET?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (!raw || !bucket || !key) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE, and SUPABASE_MEDIA_BUCKET are required with --apply");
  }

  const host = new URL(raw).hostname.toLowerCase();
  const production = host === "database.bloxodes.com";
  if (production && !(options.allowProd && process.env.NODE_ENV === "production")) {
    throw new Error("Production Storage writes require NODE_ENV=production and --allow-prod");
  }
}

function sourceHash(entry: ArticleImageEntry): string {
  return createHash("sha256")
    .update(`${entry.source_page_url}|${entry.original_image_url}`)
    .digest("hex")
    .slice(0, 12);
}

async function downloadImage(url: string, referer: string) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "user-agent": "Mozilla/5.0 Bloxodes article image collector",
      referer,
    },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
    throw new Error(`${url} returned ${contentType}, not an image`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function prepareImage(entry: ArticleImageEntry, useApprovedHostedBytes: boolean) {
  const sourceUrl = useApprovedHostedBytes ? entry.public_url! : entry.original_image_url!;
  const input = await downloadImage(sourceUrl, entry.source_page_url!);
  const image = sharp(input).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 128 || height < 128) {
    throw new Error(`${entry.label}: image is too small (${width}x${height})`);
  }

  return {
    bytes: useApprovedHostedBytes && metadata.format === "webp"
      ? input
      : await image.webp({ quality: 88, effort: 4 }).toBuffer(),
    width,
    height,
  };
}

async function verifyPublicReadback(publicUrl: string): Promise<void> {
  const response = await fetch(publicUrl, { method: "GET", redirect: "follow" });
  if (!response.ok) throw new Error(`uploaded image readback returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`uploaded image readback returned ${contentType || "an unknown content type"}`);
  }
}

async function saveManifest(filePath: string, manifest: ArticleImageManifest): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function readFinal(filePath: string, slug: string): Promise<ArticleFinal> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as ArticleFinal;
  if (!parsed?.slug || !parsed?.content_md) throw new Error(`${filePath} must contain slug and content_md`);
  if (parsed.slug !== slug) throw new Error(`${filePath} slug ${parsed.slug} does not match ${slug}`);
  return parsed;
}

async function saveFinal(filePath: string, finalJson: ArticleFinal): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(finalJson, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(process.cwd(), options.manifest);
  const manifest = await readArticleImageManifest(manifestPath);
  const finalPath = options.finalFile ? path.resolve(process.cwd(), options.finalFile) : "";
  const finalJson = finalPath ? await readFinal(finalPath, manifest.article_slug) : null;
  if (manifest.expected_count !== manifest.entries.length) {
    throw new Error(
      `expected_count is ${manifest.expected_count}, but media.json has ${manifest.entries.length} entries`
    );
  }

  const collectable = manifest.entries.filter((entry) => entry.status === "verified");
  for (const entry of collectable) assertCollectionReady(entry);

  console.log(
    `Article image plan: type=${manifest.visual_type} expected=${manifest.expected_count} verified=${collectable.length}`
  );
  for (const entry of manifest.entries) {
    const action = entry.status === "verified" ? (entry.public_url ? "reuse" : "upload") : "skip";
    console.log(`- ${entry.label}: status=${entry.status} action=${action}`);
  }

  if (!options.apply) {
    console.log("Dry run only. Add --apply to upload verified entries and update media.json.");
    return;
  }

  assertTargetAllowed(options);
  const bucket = process.env.SUPABASE_MEDIA_BUCKET!;
  const storage = supabaseAdmin().storage.from(bucket);
  let uploaded = 0;

  for (const entry of collectable) {
    const objectPath = entry.uploaded_path ||
      `articles/${manifest.article_slug}/sources/${entry.id}-${sourceHash(entry)}.webp`;
    const targetPublicUrl = toMediaPublicUrl(storage.getPublicUrl(objectPath).data.publicUrl);
    if (!targetPublicUrl) throw new Error(`${entry.label}: Storage returned no target public URL`);

    if (entry.public_url === targetPublicUrl && entry.uploaded_path === objectPath) {
      await verifyPublicReadback(entry.public_url);
      continue;
    }
    if (entry.public_url && entry.public_url !== targetPublicUrl && !finalJson) {
      throw new Error(
        `${entry.label}: target environment changes the hosted URL; pass --file <final.json> so content_md is rewritten`
      );
    }

    const previousPublicUrl = entry.public_url ?? null;
    if (finalJson && previousPublicUrl && previousPublicUrl !== targetPublicUrl) {
      if (!finalJson.content_md.includes(previousPublicUrl)) {
        throw new Error(`${entry.label}: final.json does not contain the managed-dev public URL`);
      }
    }
    const converted = await prepareImage(entry, Boolean(previousPublicUrl));
    const result = await storage.upload(objectPath, converted.bytes, {
      contentType: "image/webp",
      upsert: true,
    });
    if (result.error) throw new Error(`${entry.label}: upload failed: ${result.error.message}`);

    await verifyPublicReadback(targetPublicUrl);

    entry.uploaded_path = objectPath;
    entry.public_url = targetPublicUrl;
    entry.width = converted.width;
    entry.height = converted.height;
    await saveManifest(manifestPath, manifest);
    if (finalJson && previousPublicUrl && previousPublicUrl !== targetPublicUrl) {
      finalJson.content_md = finalJson.content_md.split(previousPublicUrl).join(targetPublicUrl);
      await saveFinal(finalPath, finalJson);
    }
    uploaded += 1;
    console.log(`Uploaded ${entry.label}: ${targetPublicUrl}`);
  }

  console.log(`Article image collection complete: uploaded=${uploaded} manifest=${manifestPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
