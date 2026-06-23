import "../shared/load-env";

import { spawnSync } from "node:child_process";

import * as cheerio from "cheerio";

import { cleanRobloxUniverseDisplayName } from "@/lib/roblox/display-name";
import { ensureUniverseForRobloxLink } from "@/lib/roblox/universe";
import { slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { assertEditorialSlug } from "../shared/editorial-slugs";

const BEEBOM_TAG_URL = "https://beebom.com/tag/roblox-codes/";
const USER_AGENT =
  process.env.BEEBOM_DISCOVERY_UA ??
  "BloxodesBeebomCodesDiscovery/1.0 (+https://bloxodes.com; contact@bloxodes.com)";

type CliOptions = {
  apply: boolean;
  generate: boolean;
  articleLimit: number;
  newLimit: number;
  requestTimeoutMs: number;
};

type ArticleCandidate = {
  url: string;
  title: string | null;
};

type UniverseNameRow = {
  universe_id: number;
  root_place_id: number | null;
  name: string | null;
  display_name: string | null;
};

type ExistingCodePageRow = {
  id: string;
  slug: string;
  name: string;
  universe_id: number | null;
  source_url_2: string | null;
};

type DraftInsert = {
  id: string;
  slug: string;
  name: string;
  universe_id: number;
};

function readPositiveIntArg(argv: string[], name: string, fallback: number): number {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const inlinePrefix = `${name}=`;
    const rawValue = arg.startsWith(inlinePrefix) ? arg.slice(inlinePrefix.length) : arg === name ? argv[index + 1] : null;
    if (rawValue == null) continue;
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Expected positive integer for ${name}`);
    return parsed;
  }
  return fallback;
}

function parseArgs(argv: string[]): CliOptions {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const apply = argv.includes("--apply");
  return {
    apply,
    generate: apply && !argv.includes("--no-generate"),
    articleLimit: readPositiveIntArg(argv, "--article-limit", 12),
    newLimit: readPositiveIntArg(argv, "--new-limit", 10),
    requestTimeoutMs: readPositiveIntArg(argv, "--request-timeout-ms", 20000)
  };
}

function printUsage() {
  console.log(`Usage: npm run discover:beebom-codes -- [options]

Discovers Beebom Roblox codes articles, resolves Roblox experience links to universe IDs,
creates unpublished code_pages drafts, and optionally runs npm run generate for new rows.

Options:
  --apply                     Write new drafts to Supabase. Without this, dry-run only.
  --no-generate               Do not run npm run generate after inserting drafts.
  --article-limit <number>    Number of Beebom tag-page articles to inspect. Default: 12.
  --new-limit <number>        Max new drafts to insert in one run. Default: 10.
  --request-timeout-ms <ms>   Fetch timeout for Beebom pages. Default: 20000.
`);
}

function normalizeText(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : null;
}

function resolveUrl(raw: string | null | undefined, baseUrl: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function canonicalArticleUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "beebom.com") return null;
    if (url.pathname.toLowerCase().startsWith("/tag/")) return null;
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isLikelyRobloxCodesArticle(candidate: ArticleCandidate): boolean {
  try {
    const url = new URL(candidate.url);
    const path = url.pathname.toLowerCase();
    const title = candidate.title?.toLowerCase() ?? "";
    return path.includes("codes") || title.includes("codes");
  } catch {
    return false;
  }
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }
  return response.text();
}

async function discoverBeebomArticles(options: CliOptions): Promise<ArticleCandidate[]> {
  const html = await fetchHtml(BEEBOM_TAG_URL, options.requestTimeoutMs);
  const $ = cheerio.load(html);
  const candidates: ArticleCandidate[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const resolved = resolveUrl(href, BEEBOM_TAG_URL);
    if (!resolved) return;
    const canonical = canonicalArticleUrl(resolved);
    if (!canonical || seen.has(canonical)) return;
    const title =
      normalizeText($(element).attr("title")) ??
      normalizeText($(element).text()) ??
      null;
    const candidate = { url: canonical, title };
    if (!isLikelyRobloxCodesArticle(candidate)) return;
    seen.add(canonical);
    candidates.push(candidate);
  });

  return candidates.slice(0, options.articleLimit);
}

function unwrapRedirectUrl(raw: string): string {
  let current = raw;
  for (let depth = 0; depth < 3; depth += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return current;
    }

    const nested =
      parsed.searchParams.get("url") ??
      parsed.searchParams.get("u") ??
      parsed.searchParams.get("target") ??
      parsed.searchParams.get("redirect") ??
      parsed.searchParams.get("redirect_to");
    if (!nested) return current;

    try {
      current = decodeURIComponent(nested);
    } catch {
      current = nested;
    }
  }
  return current;
}

function normalizeRobloxExperienceUrl(raw: string | null | undefined, baseUrl: string): string | null {
  const resolved = resolveUrl(raw, baseUrl);
  if (!resolved) return null;
  const unwrapped = unwrapRedirectUrl(resolved);
  try {
    const url = new URL(unwrapped);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.endsWith("roblox.com")) return null;
    const path = url.pathname.toLowerCase();
    if (!/^\/(games|game-details|experiences)(\/|$)/.test(path)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function extractRobloxLinksFromText(html: string): string[] {
  const matches = html.match(/https?:\\?\/\\?\/(?:www\.)?roblox\.com\\?\/(?:games|game-details|experiences)\\?\/[^"'\\\s<)]+/gi) ?? [];
  return matches.map((match) => match.replace(/\\\//g, "/"));
}

async function discoverRobloxLinks(articleUrl: string, options: CliOptions): Promise<string[]> {
  const html = await fetchHtml(articleUrl, options.requestTimeoutMs);
  const $ = cheerio.load(html);
  const links: string[] = [];
  const seen = new Set<string>();

  const pushLink = (raw: string | null | undefined) => {
    const link = normalizeRobloxExperienceUrl(raw, articleUrl);
    if (!link || seen.has(link)) return;
    seen.add(link);
    links.push(link);
  };

  $("a[href]").each((_, element) => {
    pushLink($(element).attr("href"));
  });

  for (const raw of extractRobloxLinksFromText(html)) {
    pushLink(raw);
  }

  return links;
}

async function loadUniverseName(universeId: number): Promise<UniverseNameRow | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select("universe_id, root_place_id, name, display_name")
    .eq("universe_id", universeId)
    .maybeSingle<UniverseNameRow>();

  if (error) throw new Error(`Failed to load universe ${universeId}: ${error.message}`);
  return data ?? null;
}

function cleanGameName(universe: UniverseNameRow | null, fallbackTitle: string | null, universeId: number): string | null {
  const raw =
    cleanRobloxUniverseDisplayName(universe?.display_name) ??
    cleanRobloxUniverseDisplayName(universe?.name) ??
    normalizeText(fallbackTitle)?.replace(/\b(?:roblox\s+)?codes\b/gi, " ") ??
    `Universe ${universeId}`;
  return cleanRobloxUniverseDisplayName(raw);
}

async function findExistingCodePage(params: {
  universeId: number;
  slug: string;
  beebomUrl: string;
}): Promise<{ reason: string; row: ExistingCodePageRow } | null> {
  const sb = supabaseAdmin();
  const [byUniverse, bySlug, bySource] = await Promise.all([
    sb
      .from("code_pages")
      .select("id, slug, name, universe_id, source_url_2")
      .eq("universe_id", params.universeId)
      .limit(1)
      .maybeSingle<ExistingCodePageRow>(),
    sb
      .from("code_pages")
      .select("id, slug, name, universe_id, source_url_2")
      .eq("slug", params.slug)
      .limit(1)
      .maybeSingle<ExistingCodePageRow>(),
    sb
      .from("code_pages")
      .select("id, slug, name, universe_id, source_url_2")
      .eq("source_url_2", params.beebomUrl)
      .limit(1)
      .maybeSingle<ExistingCodePageRow>()
  ]);

  for (const result of [byUniverse, bySlug, bySource]) {
    if (result.error) throw new Error(`Failed to check existing code pages: ${result.error.message}`);
  }
  if (byUniverse.data) return { reason: "universe_id", row: byUniverse.data };
  if (bySource.data) return { reason: "source_url_2", row: bySource.data };
  if (bySlug.data) return { reason: "slug", row: bySlug.data };
  return null;
}

function canonicalRobloxExperienceLink(rawLink: string, universe: UniverseNameRow | null): string {
  if (universe?.root_place_id) {
    return `https://www.roblox.com/games/${universe.root_place_id}`;
  }
  return rawLink;
}

async function insertDraft(params: {
  name: string;
  slug: string;
  universeId: number;
  robloxLink: string;
  beebomUrl: string;
  apply: boolean;
}): Promise<DraftInsert | null> {
  const payload = {
    name: params.name,
    slug: params.slug,
    is_published: false,
    seo_title: null,
    roblox_link: params.robloxLink,
    source_url_2: params.beebomUrl,
    universe_id: params.universeId
  };

  if (!params.apply) {
    console.log(JSON.stringify({ dryRunInsert: payload }, null, 2));
    return null;
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages")
    .insert(payload)
    .select("id, slug, name, universe_id")
    .single<DraftInsert>();

  if (error || !data) {
    throw new Error(`Failed to insert ${params.slug}: ${error?.message ?? "no row returned"}`);
  }
  return data;
}

async function runGeneratorForDrafts(drafts: DraftInsert[]) {
  if (!drafts.length) return;
  const ids = drafts.map((draft) => draft.id).join(",");
  console.log(`\n▶ Running code-page copy generation for ${drafts.length} new draft${drafts.length === 1 ? "" : "s"}...`);
  const result = spawnSync("npm", ["run", "generate", "--", `--ids=${ids}`], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`npm run generate failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sb = supabaseAdmin();
  const articles = await discoverBeebomArticles(options);

  console.log(
    `▶ Beebom discovery: inspecting ${articles.length} article${articles.length === 1 ? "" : "s"} from ${BEEBOM_TAG_URL}`
  );

  const inserted: DraftInsert[] = [];
  const stats = {
    inspected: 0,
    noRobloxLink: 0,
    unresolved: 0,
    existing: 0,
    inserted: 0,
    dryRunNew: 0,
    failed: 0
  };

  for (const article of articles) {
    const newDraftCount = options.apply ? inserted.length : stats.dryRunNew;
    if (newDraftCount >= options.newLimit) {
      console.log(`⏹️ Reached new draft limit (${options.newLimit}).`);
      break;
    }
    stats.inspected += 1;
    console.log(`\n🔎 ${article.title ?? "Beebom Roblox codes article"}\n   ${article.url}`);

    try {
      const robloxLinks = await discoverRobloxLinks(article.url, options);
      if (!robloxLinks.length) {
        stats.noRobloxLink += 1;
        console.log("   ⏭️ No Roblox experience link found.");
        continue;
      }

      let resolved: { link: string; universeId: number; universe: UniverseNameRow | null } | null = null;
      for (const robloxLink of robloxLinks) {
        const ensured = await ensureUniverseForRobloxLink(sb as any, robloxLink).catch((error) => {
          console.warn(`   ⚠️ Could not resolve Roblox link ${robloxLink}: ${error instanceof Error ? error.message : error}`);
          return { universeId: null, rootPlaceId: null };
        });
        if (!ensured.universeId) continue;
        const universe = await loadUniverseName(ensured.universeId);
        resolved = { link: robloxLink, universeId: ensured.universeId, universe };
        break;
      }

      if (!resolved) {
        stats.unresolved += 1;
        console.log("   ⏭️ Roblox link did not resolve to a universe ID.");
        continue;
      }

      const name = cleanGameName(resolved.universe, article.title, resolved.universeId);
      if (!name) {
        stats.unresolved += 1;
        console.log("   ⏭️ Universe resolved but no clean game name could be derived.");
        continue;
      }
      const slug = slugify(name);
      if (!slug) {
        stats.unresolved += 1;
        console.log("   ⏭️ Clean game name did not produce a usable slug.");
        continue;
      }
      assertEditorialSlug(slug, "code_pages.slug", resolved.universeId, { matchAnyTrailingId: false });

      const existing = await findExistingCodePage({
        universeId: resolved.universeId,
        slug,
        beebomUrl: article.url
      });
      if (existing) {
        stats.existing += 1;
        console.log(`   ⏭️ Existing code page by ${existing.reason}: ${existing.row.slug} (${existing.row.name})`);
        continue;
      }

      const robloxLink = canonicalRobloxExperienceLink(resolved.link, resolved.universe);
      const draft = await insertDraft({
        name,
        slug,
        universeId: resolved.universeId,
        robloxLink,
        beebomUrl: article.url,
        apply: options.apply
      });

      if (draft) {
        inserted.push(draft);
        stats.inserted += 1;
        console.log(`   ✅ Inserted draft ${draft.slug} (${draft.name})`);
      } else {
        stats.dryRunNew += 1;
        console.log(`   ✅ Dry-run would insert ${slug} (${name})`);
      }
    } catch (error) {
      stats.failed += 1;
      console.warn(`   ⚠️ Failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log("\n▶ Beebom discovery summary");
  console.log(JSON.stringify(stats, null, 2));

  if (options.generate && inserted.length) {
    await runGeneratorForDrafts(inserted);
  } else if (options.apply && !inserted.length) {
    console.log("No new drafts inserted, so generation was not triggered.");
  } else if (!options.apply) {
    console.log("Dry-run only. Pass --apply to insert drafts and run generation.");
  }
}

main().catch((error) => {
  console.error("❌ Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
