import { writeFile } from "node:fs/promises";

import * as cheerio from "cheerio";

const INDEX_URL = "https://www.destructoid.com/tag/roblox-codes/";
const API_BASE = "https://www.destructoid.com/wp-json/wp/v2";
const OUTPUT_PATH = "docs/Destructoid Roblox Codes Articles.md";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type Article = {
  title: string;
  slug: string;
  gameName: string;
  url: string;
};

type TagResponse = {
  id: number;
  count: number;
  slug: string;
};

type PostResponse = {
  link: string;
  slug: string;
  title: { rendered: string };
};

function postsApiUrl(tagId: number, page: number): string {
  const url = new URL(`${API_BASE}/posts`);
  url.searchParams.set("tags", String(tagId));
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  url.searchParams.set("_fields", "link,slug,title");
  return url.toString();
}

async function fetchText(url: string): Promise<{ text: string; headers: Headers; status: number }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return { text: await response.text(), headers: response.headers, status: response.status };
}

async function fetchJson<T>(url: string): Promise<{ data: T; headers: Headers }> {
  const { text, headers } = await fetchText(url);
  return { data: JSON.parse(text) as T, headers };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titleLooksLikeCodeArticle(title: string): boolean {
  return /\bcodes?\b/i.test(title) && !/^roblox codes$/i.test(title);
}

function decodeHtml(value: string): string {
  return cheerio.load(`<span>${value}</span>`)("span").text();
}

function cleanTitle(raw: string): string {
  return normalizeWhitespace(decodeHtml(raw))
    .replace(/^\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\s+ago\s+/i, "")
    .replace(/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\s+/i, "")
    .replace(/\s+\d+\s+\d+$/, "")
    .replace(/\s+\p{Lu}[\p{L}.'’-]+(?:\s+\p{Lu}[\p{L}.'’-]+){1,2}$/u, "")
    .trim();
}

function gameNameFromTitle(title: string): string {
  return title
    .replace(/\s*\([^)]*\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}[^)]*\)/gi, "")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/\bRoblox\b\s*/gi, "")
    .replace(/\bcodes?\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownEscape(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function renderDoc(articles: Article[], pagesFetched: number, tagCount: number): string {
  const lines = [
    "# Destructoid Roblox Codes Articles",
    "",
    `Source index: [${INDEX_URL}](${INDEX_URL})`,
    `Destructoid REST pages fetched: ${pagesFetched}`,
    `Destructoid tag count: ${tagCount}`,
    `Total articles: ${articles.length}`,
    "",
    "| # | Page Title | Slug | Game Name | URL |",
    "| --- | --- | --- | --- | --- |"
  ];

  articles.forEach((article, index) => {
    lines.push(
      `| ${index + 1} | ${markdownEscape(article.title)} | \`${article.slug}\` | ${markdownEscape(article.gameName)} | [Link](${article.url}) |`
    );
  });

  lines.push("");
  return lines.join("\n");
}

async function main() {
  const { data: tags } = await fetchJson<TagResponse[]>(`${API_BASE}/tags?slug=roblox-codes`);
  const tag = tags[0];
  if (!tag) throw new Error("Could not resolve Destructoid roblox-codes tag.");

  const articles = new Map<string, Article>();
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    const { data: posts, headers } = await fetchJson<PostResponse[]>(postsApiUrl(tag.id, page));
    totalPages = Number(headers.get("x-wp-totalpages") ?? totalPages) || totalPages;
    for (const post of posts) {
      const title = cleanTitle(post.title.rendered);
      articles.set(post.link, {
        title,
        slug: post.slug,
        gameName: gameNameFromTitle(title),
        url: post.link
      });
    }
    if (page === 1 || page % 5 === 0 || page === totalPages) {
      console.log(`page=${page}/${totalPages} articles=${articles.size}`);
    }
  }

  const sorted = Array.from(articles.values()).sort((a, b) => a.title.localeCompare(b.title));
  await writeFile(OUTPUT_PATH, renderDoc(sorted, totalPages, tag.count));
  console.log(`Wrote ${sorted.length} articles to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
