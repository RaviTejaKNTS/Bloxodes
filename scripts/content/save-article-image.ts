/**
 * Download or copy a clean article image into apps/web/public/articles/<slug>/
 * and print the markdown snippet to paste into content_md.
 *
 * Usage:
 *   npm run content:save-article-image -- --slug my-article-slug --url https://... --name menu-panel --alt "Ascension menu"
 *   npm run content:save-article-image -- --slug my-article-slug --file ./shot.png --name menu-panel --alt "Ascension menu"
 *   npm run content:save-article-image -- --slug my-article-slug --url https://... --name cover --alt "..." --cover
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { articlePublicDir, suggestArticleImageMarkdown } from "@/lib/article-media";

type CliOptions = {
  slug: string;
  url: string | null;
  file: string | null;
  name: string;
  alt: string;
  cover: boolean;
  dryRun: boolean;
};

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run content:save-article-image -- --slug <article-slug> --url <https://...> --name <file-stem> --alt \"...\"",
      "  npm run content:save-article-image -- --slug <article-slug> --file <local-path> --name <file-stem> --alt \"...\"",
      "",
      "Options:",
      "  --cover     Save as cover.webp (also sets a common cover filename)",
      "  --dry-run   Print target path and markdown only",
      "",
      "Writes webp under apps/web/public/articles/<slug>/ and prints markdown for content_md.",
      "Do not hotlink wiki/competitor images in final.json; host them here first.",
    ].join("\n")
  );
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    slug: "",
    url: null,
    file: null,
    name: "",
    alt: "",
    cover: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--slug":
        options.slug = String(argv[++i] ?? "").trim().toLowerCase();
        break;
      case "--url":
        options.url = String(argv[++i] ?? "").trim();
        break;
      case "--file":
        options.file = String(argv[++i] ?? "").trim();
        break;
      case "--name":
        options.name = String(argv[++i] ?? "").trim();
        break;
      case "--alt":
        options.alt = String(argv[++i] ?? "").trim();
        break;
      case "--cover":
        options.cover = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.slug) throw new Error("--slug is required");
  if (!options.url && !options.file) throw new Error("Provide --url or --file");
  if (options.url && options.file) throw new Error("Use only one of --url or --file");
  if (options.cover) {
    options.name = options.name || "cover";
  }
  if (!options.name) throw new Error("--name is required (file stem, e.g. ascension-menu)");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(options.name)) {
    throw new Error("--name must be a simple slug stem (letters, numbers, hyphens)");
  }
  if (!options.alt) throw new Error("--alt is required (describe the useful UI fact)");

  return options;
}

async function loadBytes(options: CliOptions): Promise<Buffer> {
  if (options.file) {
    return readFile(path.resolve(process.cwd(), options.file));
  }

  const url = options.url!;
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "BloxodesArticleImageFetcher/1.0",
      accept: "image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
    throw new Error(`URL did not return an image content-type (${contentType})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fileName = `${options.name.toLowerCase()}.webp`;
  const publicDirRelative = articlePublicDir(options.slug).replace(/^\/+/, "");
  const outDir = path.resolve(process.cwd(), "apps/web/public", publicDirRelative);
  const outPath = path.join(outDir, fileName);
  const publicSrc = `${articlePublicDir(options.slug)}${fileName}`;
  const markdown = suggestArticleImageMarkdown({
    slug: options.slug,
    fileName,
    alt: options.alt,
  });

  console.log(`Target: ${outPath}`);
  console.log(`Public: ${publicSrc}`);
  console.log(`Markdown: ${markdown}`);
  if (options.cover) {
    console.log(`cover_image field suggestion: ${publicSrc}`);
  }

  if (options.dryRun) {
    console.log("Dry run only; no file written.");
    return;
  }

  const input = await loadBytes(options);
  const webp = await sharp(input).rotate().webp({ quality: 82 }).toBuffer();
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, webp);
  console.log(`Wrote ${outPath} (${webp.length} bytes)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
