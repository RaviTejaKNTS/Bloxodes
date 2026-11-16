import { Lexer, marked } from "marked";
import { load } from "cheerio";
import { directProductionStatus, relatedArticlePages, type RelatedArticlePage } from "../articles/article-related";
import type { ArticleScope } from "../articles/article-topic-similarity";

export type MarkdownArticleLink = { text: string; href: string; raw: string; start: number; end: number; positions: number[] };
type Source = { text: string; positions: number[] };

// Container tokens remove list indentation and quote markers. Retain a mapping
// from their parsed text back to the original bytes, including repeated labels.
function locateSource(raw: string, source: Source, offset: number): Source | null {
  if (!raw.includes("\n")) {
    const at = source.text.indexOf(raw, offset);
    return at < 0 ? null : { text: raw, positions: source.positions.slice(at, at + raw.length) };
  }
  const positions: number[] = [];
  let cursor = offset;
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const at = line ? source.text.indexOf(line, cursor) : cursor;
    if (at < 0) return null;
    // Only container prefixes may disappear between physical lines. Never
    // jump to a later repeated sentence to make a transformed raw token fit.
    if (i > 0 && !/^[ \t>]*(?:(?:[-+*]|\d+[.)])[ \t]+)?$/.test(source.text.slice(cursor, at))) return null;
    positions.push(...source.positions.slice(at, at + line.length));
    cursor = at + line.length;
    if (i < lines.length - 1) {
      const newline = source.text.indexOf("\n", cursor);
      if (newline < 0) return null;
      if (!/^[ \t>]*$/.test(source.text.slice(cursor, newline))) return null;
      positions.push(source.positions[newline]); cursor = newline + 1;
    }
  }
  return { text: raw, positions };
}

/** Walk every parsed token. Source lookup must never hide a link from validation. */
export function markdownArticleLinks(markdown: string): MarkdownArticleLink[] {
  const links: MarkdownArticleLink[] = [];
  const positions: number[] = [];
  let text = "";
  for (let i = 0; i < markdown.length; i++) {
    if (markdown[i] === "\r" && markdown[i + 1] === "\n") continue;
    text += markdown[i] === "\r" ? "\n" : markdown[i]; positions.push(i);
  }
  function walk(tokens: any[], source: Source | null) {
    let offset = 0;
    for (const token of tokens) {
      const raw = token.type === "text" && token.tokens ? token.text : token.raw ?? token.text ?? "";
      const found = source ? locateSource(raw, source, offset) ?? (token.text ? locateSource(token.text, source, offset) : null) : null;
      if (found?.positions.length && source) offset = source.positions.indexOf(found.positions.at(-1)!) + 1;
      if (token.type === "html" && load(token.raw ?? "")("a").length) {
        throw new Error("Raw HTML <a> anchors are not allowed. Use Markdown links with a root-relative /path.");
      }
      if (token.type === "link") {
        links.push({ text: token.text, href: token.href, raw, start: found?.positions[0] ?? -1,
          end: found ? found.positions.at(-1)! + 1 : -1, positions: found?.positions ?? [] });
      } else if (!["image", "code", "codespan", "html"].includes(token.type)) {
        if (token.tokens) walk(token.tokens, found);
        if (token.items) walk(token.items, found);
        if (token.header) walk([...token.header, ...token.rows.flat()], found);
      }
    }
  }
  walk(Lexer.lex(text), { text, positions });
  return links;
}
function internalArticleDestination(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) {
    const url = new URL(href, "https://bloxodes.com");
    if (url.origin !== "https://bloxodes.com") throw new Error(`Invalid root-relative article link: ${href}. Use a root-relative /path.`);
    return url.href;
  }
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(href);
  if (!absolute && !href.startsWith("//")) throw new Error(`Relative article link: ${href || "(empty)"}. Use a root-relative /path.`);
  const url = new URL(href, "https://bloxodes.com");
  if (!absolute && url.hostname === "bloxodes.com") throw new Error(`Relative article link: ${href}. Use a root-relative /path.`);
  if (["bloxodes.com", "www.bloxodes.com"].includes(url.hostname)) return url.href;
  if (!absolute) throw new Error(`Relative article link: ${href}. Use a root-relative /path.`);
  return null;
}
export function internalArticleLinks(markdown: string) {
  return markdownArticleLinks(markdown).flatMap(link => {
    const url = internalArticleDestination(link.href);
    return url ? [{ ...link, url }] : [];
  });
}
export function stripArticleLinkMarkup(text: string) {
  const remove = new Set<number>();
  for (const link of markdownArticleLinks(text)) {
    // Reference links and autolinks cannot be added by this repair contract.
    if (!link.raw.match(/^\[[\s\S]*\]\(/)) continue;
    if (link.positions.length !== link.raw.length) throw new Error("Could not locate exact Markdown link source positions for repair.");
    // Locate the label's closing bracket, including nested brackets and escapes.
    let depth = 0, labelEnd = -1;
    for (let i = 0; i < link.raw.length; i++) {
      if (link.raw[i] === "\\") { i++; continue; }
      if (link.raw[i] === "[") depth++;
      if (link.raw[i] === "]" && --depth === 0) { labelEnd = i; break; }
    }
    if (labelEnd < 0 || link.raw[labelEnd + 1] !== "(") continue;
    remove.add(link.positions[0]);
    for (const position of link.positions.slice(labelEnd)) remove.add(position);
  }
  return text.split("").filter((_, i) => !remove.has(i)).join("");
}
export function assertArticleLinksOnlyChange(before: unknown, after: unknown, field = "$", allowMarkup = true): void {
  if(typeof before === "string" && typeof after === "string") {
    const editable = allowMarkup && (field === "$.content_md" || /^\$\.faq_json\[\d+\]\.a$/.test(field));
    if((editable?stripArticleLinkMarkup(before):before)!==(editable?stripArticleLinkMarkup(after):after))throw new Error(`Non-link change at ${field}.`);return;
  }
  if(Array.isArray(before) && Array.isArray(after)) {
    if(before.length!==after.length)throw new Error(`Array changed at ${field}.`);
    before.forEach((value,i)=>assertArticleLinksOnlyChange(value,after[i],`${field}[${i}]`,allowMarkup));return;
  }
  if(before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    const a=Object.keys(before).sort(),b=Object.keys(after).sort();if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`Fields changed at ${field}.`);
    for(const key of a)assertArticleLinksOnlyChange((before as any)[key],(after as any)[key],`${field}.${key}`,allowMarkup);return;
  }
  if(before!==after)throw new Error(`Value changed at ${field}.`);
}
export function articleLinkTexts(final: {content_md: string; faq_json?: unknown}) {
  const answers = Array.isArray(final.faq_json) ? final.faq_json.flatMap(faq => typeof faq?.a === "string" ? [faq.a] : []) : [];
  return [final.content_md, ...answers];
}
export class MissingRenderedArticleLinksError extends Error {}
export async function assertRenderedArticleLinks(final: {slug: string; content_md: string; faq_json?: unknown}, source: string, status = directProductionStatus) {
  const html = load(source);
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  const missing: string[] = [];
  const texts = articleLinkTexts(final);
  for (const [markdown, selector] of [[texts[0], "#article-body"], [texts.slice(1).join("\n\n"), ".content-faq-answer"]]) {
    const anchors = html(`${selector} a[href]`).toArray().map(el => {
      try { return { url: new URL(html(el).attr("href")!, "https://bloxodes.com").href, text: normalize(html(el).text()) }; }
      catch { return { url: "", text: "" }; }
    });
    for (const expected of internalArticleLinks(markdown)) {
      const text = normalize(load(marked.parseInline(expected.text, { async: false })).text());
      const index = anchors.findIndex(anchor => anchor.url === expected.url && anchor.text === text);
      if (index < 0) missing.push(`${selector}: "${text}" -> ${expected.url}`);
      else anchors.splice(index, 1);
    }
  }
  if (missing.length) throw new MissingRenderedArticleLinksError(`Live article is missing rendered internal links: ${missing.join("; ")}.`);
  // Structured blocks can render anchors that the Markdown lexer never saw.
  const urls = html("#article-body a[href], .content-faq-answer a[href]").toArray().flatMap(el => {
    const url = internalArticleDestination(html(el).attr("href")!);
    return url ? [url] : [];
  });
  const errors = await articleLinkTargetErrors(urls, final.slug, status);
  if (errors.length) throw new Error(`Live article has invalid rendered internal links: ${errors.join("; ")}`);
}

async function articleLinkTargetErrors(urls: Iterable<string>, slug: string, status = directProductionStatus) {
  const errors: string[] = [];
  for (const url of new Set(urls)) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "bloxodes.com") {
      errors.push(`Non-canonical internal article link: ${url}. Use the root-relative path ${parsed.pathname}${parsed.search}${parsed.hash}.`);
      continue;
    }
    if (parsed.pathname.replace(/\/$/, "") === `/articles/${slug}` || parsed.pathname.startsWith(`/articles/${slug}/page/`)) errors.push(`Self-link: ${url}`);
    const result = await status(url);
    if (result.status !== 200) errors.push(`${url}: HTTP ${result.status}${result.location ? ` Location: ${result.location}` : ""}`);
  }
  return errors;
}
export async function checkArticleLinks(final: {slug:string;content_md:string;[key:string]:unknown},scope:ArticleScope, dependencies: {
  status?: typeof directProductionStatus; related?: (scope:ArticleScope,excludeSlug?:string)=>Promise<RelatedArticlePage[]>;
}={}) {
  const texts = articleLinkTexts(final);
  const links: ReturnType<typeof internalArticleLinks> = [];
  const errors:string[]=[],warnings:string[]=[];
  for (const text of texts) {
    try { links.push(...internalArticleLinks(text)); }
    catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  }
  errors.push(...await articleLinkTargetErrors(links.map(link => link.url), final.slug, dependencies.status));
  if(!links.length && !errors.length) {
    const related=await (dependencies.related??relatedArticlePages)(scope,final.slug);
    if(related.length)errors.push(`Article has zero internal links; ${related.length} related production pages are available.`);
  }
  if(links.length>5)warnings.push(`Article has ${links.length} internal links; review links above 5.`);
  return {count:links.length,links,errors,warnings};
}
export async function assertArticleLinks(final: {slug:string;content_md:string;[key:string]:unknown},scope:ArticleScope) {
  const result=await checkArticleLinks(final,scope);
  for(const warning of result.warnings)console.warn(`WARNING: ${warning}`);
  if(result.errors.length)throw new Error(result.errors.join("\n"));
  return result;
}
