import "../shared/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { extractArticleBlockImageRefs } from "@/lib/article-blocks";
import { findMarkdownImages, findYouTubeDirectives } from "@/lib/article-media";

import { assertRenderedArticle, launchArticleBrowser } from "./article-browser";

type ArticleFinal = {
  title?: unknown;
  slug?: unknown;
  content_md?: unknown;
};

type Options = {
  baseUrl: string;
  files: string[];
};

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  npm run verify:article-browser -- --base-url http://localhost:3000 --file <final.json> [--file <final.json>...]",
      "",
      "Renders every article in headless Chrome, scrolls the content to trigger lazy media, and requires all article images to load."
    ].join("\n")
  );
}

function parseArgs(argv: string[]): Options {
  const options: Options = { baseUrl: "", files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--base-url") {
      options.baseUrl = argv[++index]?.trim() ?? "";
    } else if (arg === "--file") {
      const file = argv[++index]?.trim();
      if (!file) throw new Error("--file requires a path.");
      options.files.push(file);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.baseUrl) throw new Error("--base-url is required.");
  if (!options.files.length) throw new Error("At least one --file is required.");
  return options;
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  return url.toString().replace(/\/$/, "");
}

async function readFinal(file: string): Promise<{ file: string; title: string; slug: string; content: string }> {
  const absolutePath = path.resolve(process.cwd(), file);
  const parsed = JSON.parse(await readFile(absolutePath, "utf8")) as ArticleFinal;
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const slug = typeof parsed.slug === "string" ? parsed.slug.trim().toLowerCase() : "";
  const content = typeof parsed.content_md === "string" ? parsed.content_md.trim() : "";
  if (!title || !slug || !content) throw new Error(`${file} must contain title, slug, and content_md.`);
  return { file, title, slug, content };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const finals = await Promise.all(options.files.map(readFinal));
  const { browser, executable } = await launchArticleBrowser();
  console.log(`Rendered browser: ${executable}`);
  try {
    const page = await browser.newPage();
    for (const finalJson of finals) {
      const expectedImageSources = [
        ...findMarkdownImages(finalJson.content).map((image) => image.src),
        ...extractArticleBlockImageRefs(finalJson.content).map((image) => image.src)
      ];
      const expectedYouTubeIds = findYouTubeDirectives(finalJson.content)
        .map((directive) => directive.videoId)
        .filter((videoId): videoId is string => Boolean(videoId));
      const url = `${baseUrl}/articles/${finalJson.slug}`;
      await assertRenderedArticle(page, {
        url,
        title: finalJson.title,
        expectedImageSources,
        expectedYouTubeIds
      });
      console.log(`Browser preview passed: ${url}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
