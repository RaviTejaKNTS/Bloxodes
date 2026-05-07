import { writeFile } from "node:fs/promises";

import * as cheerio from "cheerio";

const INDEX_URL = "https://progameguides.com/roblox/roblox-game-codes/";
const OUTPUT_PATH = "docs/Pro Game Guides Roblox Codes Articles.md";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type Article = {
  indexLabel: string;
  slug: string;
  gameName: string;
  url: string;
  notes: string;
};

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function absoluteUrl(href: string): string | null {
  try {
    return new URL(href, INDEX_URL).toString();
  } catch {
    return null;
  }
}

function slugFromUrl(url: string): string | null {
  const pathname = new URL(url).pathname.replace(/\/+$/g, "");
  const match = pathname.match(/^\/roblox\/([^/]+)$/);
  return match?.[1] ?? null;
}

function cleanGameName(label: string): string {
  return normalizeWhitespace(label)
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/\s+[–—-]\s*(?:do (?:any|they) exist.*|are there any.*|free .+|best free outfits.*|image id.*|wiki.*)$/i, "")
    .replace(/\s+[–—-]\s*(?:may|june|july|august|september|october|november|december|january|february|march|april)\s+\d{4}.*$/i, "")
    .replace(/\s+\((?:may|june|july|august|september|october|november|december|january|february|march|april)\s+\d{4}[^)]*\)$/i, "")
    .replace(/\bRoblox\b\s*/gi, "")
    .replace(/\bcodes?\b.*$/i, "")
    .replace(/\s+[–—-]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function notesFor(label: string, slug: string): string {
  const notes: string[] = [];
  if (!/-codes?$/.test(slug)) notes.push("URL slug does not end with codes");
  if (/\bdo (?:any|they) exist\b/i.test(label) || /\bare there any\b/i.test(label)) {
    notes.push("existence/check article");
  }
  if (/\bimage id\b/i.test(label)) notes.push("image ID page");
  if (/\boutfits?\b/i.test(label)) notes.push("outfit page");
  if (/\bwiki\b/i.test(label) || /\bboss drops?\b/i.test(label)) notes.push("wiki/boss drops mixed page");
  return notes.join("; ");
}

function markdownEscape(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function collectIndexLinks(html: string): Article[] {
  const $ = cheerio.load(html);
  const start = $("h2")
    .filter((_, element) => normalizeWhitespace($(element).text()) === "All Roblox Codes in One Place")
    .first();
  if (!start.length) {
    throw new Error("Could not find the PGG alphabetical list heading.");
  }

  const articles = new Map<string, Article>();
  let node = start.next();

  while (node.length) {
    if (node.is("h2") && /^What Are Roblox Game Codes\??$/i.test(normalizeWhitespace(node.text()))) {
      break;
    }

    node.find("a[href]").each((_, element) => {
      const href = String($(element).attr("href") ?? "");
      const url = absoluteUrl(href);
      if (!url) return;
      if (!url.startsWith("https://progameguides.com/roblox/")) return;
      if (url === INDEX_URL) return;

      const slug = slugFromUrl(url);
      if (!slug) return;

      const indexLabel = normalizeWhitespace($(element).text());
      if (!indexLabel) return;
      articles.set(url, {
        indexLabel,
        slug,
        gameName: cleanGameName(indexLabel),
        url,
        notes: notesFor(indexLabel, slug)
      });
    });

    node = node.next();
  }

  return Array.from(articles.values());
}

function renderDoc(articles: Article[]): string {
  const lines = [
    "# Pro Game Guides Roblox Codes Articles",
    "",
    `Source index: [${INDEX_URL}](${INDEX_URL})`,
    `Total unique index links: ${articles.length}`,
    "",
    "| # | Index Label | Slug | Game Name | URL | Notes |",
    "| --- | --- | --- | --- | --- | --- |"
  ];

  articles.forEach((article, index) => {
    lines.push(
      `| ${index + 1} | ${markdownEscape(article.indexLabel)} | \`${article.slug}\` | ${markdownEscape(article.gameName)} | [Link](${article.url}) | ${markdownEscape(article.notes)} |`
    );
  });

  lines.push("");
  return lines.join("\n");
}

async function main() {
  const html = await fetchText(INDEX_URL);
  const articles = collectIndexLinks(html);
  await writeFile(OUTPUT_PATH, renderDoc(articles));
  console.log(`Wrote ${articles.length} articles to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
