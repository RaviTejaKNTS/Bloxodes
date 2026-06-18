import "../shared/load-env";

import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";
import sharp from "sharp";

import { scrapeRobloxGameMetadata } from "@/lib/roblox/game-metadata";
import { ensureUniverseForRobloxLink } from "@/lib/roblox/universe";
import { scrapeSocialLinksFromSources, type SocialLinks as ScrapedSocialLinks } from "@/lib/social-links";
import { toMediaPublicUrl } from "../shared/storage-public-url";

type CodePageRow = {
  id: string;
  name: string;
  slug: string;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
  roblox_link: string | null;
  community_link: string | null;
  discord_link: string | null;
  twitter_link: string | null;
  youtube_link: string | null;
  cover_image: string | null;
  universe_id: number | null;
};

type LinkInfo = {
  url: string;
};

type PlaceholderLinks = {
  roblox_link?: LinkInfo;
  community_link?: LinkInfo;
  discord_link?: LinkInfo;
  twitter_link?: LinkInfo;
  youtube_link?: LinkInfo;
};

type EnrichmentStats = {
  processed: number;
  failed: number;
  linksUpdated: number;
  robloxLinks: number;
  universeIds: number;
  coverImages: number;
  googleSearches: number;
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
  { auth: { persistSession: false } }
);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const ENABLE_GOOGLE_IMAGE_FALLBACK = process.argv.includes("--google-image-fallback");
const RETRY_MISSING_UNIVERSE_ONLY = process.argv.includes("--retry-missing-universe-only");

function assertLocalSupabase() {
  const url = process.env.SUPABASE_URL ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url)) {
    throw new Error(`Refusing to run against non-local Supabase URL: ${url}`);
  }
}

function normalizeExternalLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const resolved = new URL(trimmed);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function splitSourceUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((url) => normalizeExternalLink(url))
    .filter((url): url is string => Boolean(url));
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

function convertScrapedSocialLinks(links: ScrapedSocialLinks): PlaceholderLinks {
  const toLinkInfo = (value?: string | null): LinkInfo | undefined =>
    value ? { url: value } : undefined;
  return {
    roblox_link: toLinkInfo(links.roblox),
    community_link: toLinkInfo(links.community),
    discord_link: toLinkInfo(links.discord),
    twitter_link: toLinkInfo(links.twitter),
    youtube_link: toLinkInfo(links.youtube)
  };
}

function compactLinks(links: PlaceholderLinks): PlaceholderLinks {
  const compacted: PlaceholderLinks = {};
  for (const key of ["roblox_link", "community_link", "discord_link", "twitter_link", "youtube_link"] as const) {
    const value = links[key]?.url;
    if (value) compacted[key] = { url: value };
  }
  return compacted;
}

async function collectSocialLinksFromExistingSources(game: CodePageRow): Promise<PlaceholderLinks> {
  const sourceCandidates = uniqueUrls([
    ...splitSourceUrls(game.source_url),
    ...splitSourceUrls(game.source_url_2),
    ...splitSourceUrls(game.source_url_3)
  ]);

  if (!sourceCandidates.length) return {};

  const socialResult = await scrapeSocialLinksFromSources(sourceCandidates);
  if (socialResult.errors.length) {
    for (const errorMessage of socialResult.errors) {
      console.warn(`⚠️ Social scrape error for ${game.slug}: ${errorMessage}`);
    }
  }
  const providerLinks = compactLinks(convertScrapedSocialLinks(socialResult.links));
  const genericLinks = await scrapeGenericSocialLinksFromSources(sourceCandidates, game.slug);
  return {
    ...genericLinks,
    ...providerLinks,
  };
}

function classifyKnownLink(rawUrl: string): keyof PlaceholderLinks | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const pathname = url.pathname.toLowerCase();

    if (host.endsWith("roblox.com")) {
      if (/^\/(games|game-details|experiences)(\/|$)/.test(pathname) || url.searchParams.has("placeId")) {
        return "roblox_link";
      }
      if (/^\/(communities|groups)(\/|$)/.test(pathname)) {
        return "community_link";
      }
      return null;
    }

    if (host === "discord.gg" || host.endsWith("discord.com")) return "discord_link";
    if (host === "x.com" || host.endsWith("twitter.com")) return "twitter_link";
    if (host.endsWith("youtube.com") || host === "youtu.be" || host === "m.youtube.com") return "youtube_link";
    return null;
  } catch {
    return null;
  }
}

function normalizeHref(href: string | null | undefined, baseUrl: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeDiscoveredUrl(raw: string): string | null {
  const cleaned = raw
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/[)"'<>\\]+$/g, "")
    .trim();
  if (!cleaned) return null;
  const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned.replace(/^\/\//, "")}`;
  return normalizeExternalLink(withProtocol);
}

function collectKnownLinksFromText(html: string): PlaceholderLinks {
  const found: PlaceholderLinks = {};
  const patterns = [
    /(?:https?:\\?\/\\?\/)?(?:www\.)?roblox\.com\\?\/(?:games|game-details|experiences)\\?\/[0-9][^"'<> )\\]{}]*/gi,
    /(?:https?:\\?\/\\?\/)?(?:www\.)?roblox\.com\\?\/(?:communities|groups)\\?\/[0-9][^"'<> )\\]{}]*/gi,
    /(?:https?:\\?\/\\?\/)?(?:www\.)?(?:discord\.gg|discord\.com)\\?\/[^"'<> )\\]{}]+/gi,
    /(?:https?:\\?\/\\?\/)?(?:www\.)?(?:x\.com|twitter\.com)\\?\/[^"'<> )\\]{}]+/gi,
    /(?:https?:\\?\/\\?\/)?(?:www\.)?(?:youtube\.com|youtu\.be|m\.youtube\.com)\\?\/[^"'<> )\\]{}]+/gi,
  ];

  for (const pattern of patterns) {
    const matches = html.match(pattern) ?? [];
    for (const match of matches) {
      const normalized = normalizeDiscoveredUrl(match);
      if (!normalized) continue;
      const type = classifyKnownLink(normalized);
      if (!type || found[type]) continue;
      found[type] = { url: normalized };
    }
  }

  return found;
}

async function scrapeGenericSocialLinksFromSources(urls: string[], slug: string): Promise<PlaceholderLinks> {
  const found: PlaceholderLinks = {};
  for (const sourceUrl of urls) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BloxodesLocalGameEnricher/1.0)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      if (!response.ok) continue;

      const html = await response.text();
      Object.assign(found, {
        ...collectKnownLinksFromText(html),
        ...found,
      });

      const dom = new JSDOM(html, { url: sourceUrl });
      const anchors = Array.from(dom.window.document.querySelectorAll<HTMLAnchorElement>("a[href]"));

      for (const anchor of anchors) {
        const resolved = normalizeHref(anchor.getAttribute("href"), sourceUrl);
        if (!resolved) continue;
        const type = classifyKnownLink(resolved);
        if (!type || found[type]) continue;
        found[type] = { url: resolved };
      }

      if (found.roblox_link && found.discord_link && found.twitter_link && found.youtube_link && found.community_link) {
        break;
      }
    } catch (error) {
      console.warn(`⚠️ Generic link scrape failed for ${slug}:`, error instanceof Error ? error.message : error);
    }
  }
  return found;
}

async function collectRobloxMetadata(robloxLink?: string | null) {
  if (!robloxLink) {
    return { communityLink: null };
  }

  try {
    const scraped = await scrapeRobloxGameMetadata(robloxLink);
    return { communityLink: scraped.communityLink ?? null };
  } catch (error) {
    console.warn("⚠️ Failed to scrape Roblox metadata:", error instanceof Error ? error.message : error);
    return { communityLink: null };
  }
}

async function googleSearch(query: string, limit = 4): Promise<Array<{ title: string; url: string }>> {
  if (!process.env.GOOGLE_SEARCH_KEY || !process.env.GOOGLE_SEARCH_CX) {
    return [];
  }

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&num=${limit}&key=${process.env.GOOGLE_SEARCH_KEY}&cx=${process.env.GOOGLE_SEARCH_CX}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Search failed: ${res.statusText}`);
  }

  const data = (await res.json()) as {
    items?: { title?: string; link?: string }[];
  };

  return (
    data.items
      ?.map((item) => ({ title: item.title ?? "", url: item.link ?? "" }))
      .filter((item) => item.title && item.url) ?? []
  );
}

async function fetchRobloxThumbnailViaApi(gameUrl: string): Promise<string | null> {
  try {
    const placeMatch = gameUrl.match(/roblox\.com\/(?:games|game-details)\/(\d+)/i);
    const placeId = placeMatch ? placeMatch[1] : null;
    if (!placeId) return null;

    const placeDetailsRes = await fetch(
      `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      }
    );

    if (!placeDetailsRes.ok) return null;
    const placeDetails = await placeDetailsRes.json();
    const universeId = Array.isArray(placeDetails) && placeDetails[0]?.universeId;
    if (!universeId) return null;

    const thumbRes = await fetch(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      }
    );

    if (!thumbRes.ok) return null;
    const thumbs = await thumbRes.json();
    const imageUrl = thumbs?.data?.[0]?.thumbnails?.[0]?.imageUrl ?? thumbs?.data?.[0]?.imageUrl;
    return typeof imageUrl === "string" ? imageUrl : null;
  } catch (error) {
    console.warn("⚠️ Roblox thumbnail API failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchRobloxExperienceThumbnail(gameUrl: string): Promise<string | null> {
  try {
    const viaApi = await fetchRobloxThumbnailViaApi(gameUrl);
    if (viaApi) return viaApi;

    const response = await fetch(gameUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const dom = new JSDOM(html, { url: gameUrl });
    const { document } = dom.window;

    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null;
    if (ogImage) {
      try {
        return new URL(ogImage, gameUrl).toString();
      } catch {
        // ignore invalid page image URLs
      }
    }

    const primaryImage = document.querySelector("img") as HTMLImageElement | null;
    if (primaryImage?.src) {
      try {
        return new URL(primaryImage.src, gameUrl).toString();
      } catch {
        // ignore invalid page image URLs
      }
    }

    return null;
  } catch (error) {
    console.warn("⚠️ Failed to fetch Roblox thumbnail:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchPrimaryImageFromPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;

    const html = await res.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const metaOg = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
    if (metaOg?.content) return metaOg.content;

    const metaTwitter = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null;
    if (metaTwitter?.content) return metaTwitter.content;

    const img = document.querySelector("img") as HTMLImageElement | null;
    if (img?.src) return img.src;
  } catch (error) {
    console.warn("⚠️ Failed to extract image from page", url, error);
  }

  return null;
}

async function findRobloxImageUrl(gameName: string, stats: EnrichmentStats): Promise<string | null> {
  const query = `site:roblox.com ${gameName} game`;
  const results = await googleSearch(query, 4);
  if (results.length) stats.googleSearches += 1;

  for (const entry of results) {
    if (!entry.url) continue;
    if (!/roblox\.com\//i.test(entry.url)) continue;

    const image = await fetchPrimaryImageFromPage(entry.url);
    if (image) return image;
    await sleep(1000);
  }

  return null;
}

async function downloadResizeAndUploadImage(params: {
  imageUrl: string;
  slug: string;
  gameName: string;
}): Promise<string | null> {
  const response = await fetch(params.imageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    console.warn("⚠️ Failed to download image:", response.statusText);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const resized = await sharp(buffer)
    .resize(1200, 675, { fit: "cover", position: "attention" })
    .webp({ quality: 90, effort: 4 })
    .toBuffer();

  const fileBase = params.gameName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/(^-|-$)/g, "") || params.slug;

  const fileName = `${fileBase}-codes.webp`;
  const path = `games/${params.slug}/${fileName}`;

  const bucket = process.env.SUPABASE_MEDIA_BUCKET!;
  const storageClient = supabase.storage.from(bucket);

  const { error } = await storageClient.upload(path, resized, {
    contentType: "image/webp",
    upsert: true,
  });

  if (error) {
    console.error("⚠️ Failed to upload cover image:", error.message);
    return null;
  }

  const publicUrl = storageClient.getPublicUrl(path);
  return toMediaPublicUrl(publicUrl.data.publicUrl);
}

async function resolveCoverImage(game: CodePageRow, robloxLink: string | null, stats: EnrichmentStats): Promise<string | null> {
  if (!process.env.SUPABASE_MEDIA_BUCKET) {
    console.log("⚠️ SUPABASE_MEDIA_BUCKET not configured. Skipping cover image upload.");
    return null;
  }

  let imageUrl: string | null = null;
  if (robloxLink) {
    imageUrl = await fetchRobloxExperienceThumbnail(robloxLink);
  }

  if (!imageUrl && ENABLE_GOOGLE_IMAGE_FALLBACK) {
    imageUrl = await findRobloxImageUrl(game.name, stats);
  }

  if (!imageUrl) return null;

  return downloadResizeAndUploadImage({
    imageUrl,
    slug: game.slug,
    gameName: game.name,
  });
}

async function loadUnpublishedCodePages(limit: number | null, startAfterSlug: string | null): Promise<CodePageRow[]> {
  const pageSize = 1000;
  const rows: CodePageRow[] = [];
  let offset = 0;

  while (limit === null || rows.length < limit) {
    const remaining = limit === null ? pageSize : Math.min(pageSize, limit - rows.length);
    if (remaining <= 0) break;

    let query = supabase
      .from("code_pages")
      .select(
        "id, name, slug, source_url, source_url_2, source_url_3, roblox_link, community_link, discord_link, twitter_link, youtube_link, cover_image, universe_id"
      )
      .eq("is_published", false)
      .order("slug", { ascending: true })
      .range(offset, offset + remaining - 1);

    if (RETRY_MISSING_UNIVERSE_ONLY) {
      query = query.not("roblox_link", "is", null).is("universe_id", null);
    }

    if (startAfterSlug) {
      query = query.gt("slug", startAfterSlug);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load local code pages: ${error.message}`);
    rows.push(...((data ?? []) as CodePageRow[]));
    if (!data || data.length < remaining) break;
    offset += remaining;
  }

  return rows;
}

async function promisePool<T>(items: T[], concurrency: number, handler: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      if (!item) continue;
      await handler(item);
    }
  });
  await Promise.all(workers);
}

async function enrichCodePage(game: CodePageRow, stats: EnrichmentStats): Promise<void> {
  console.log(`\n🔎 ${stats.processed + 1}. Enriching ${game.slug}`);
  const socialLinks = RETRY_MISSING_UNIVERSE_ONLY ? {} : await collectSocialLinksFromExistingSources(game);

  const robloxLink = socialLinks.roblox_link?.url ?? game.roblox_link ?? null;

  let resolvedUniverseId: number | null = null;
  if (robloxLink) {
    try {
      const ensuredUniverse = await ensureUniverseForRobloxLink(supabase, robloxLink);
      resolvedUniverseId = ensuredUniverse.universeId;
    } catch (error) {
      console.warn("⚠️ Failed to ensure Roblox universe:", error instanceof Error ? error.message : error);
    }
  }

  let coverImage: string | null = null;
  if (!RETRY_MISSING_UNIVERSE_ONLY) {
    try {
      coverImage = await resolveCoverImage(game, robloxLink, stats);
    } catch (error) {
      console.warn("⚠️ Failed to attach cover image:", error instanceof Error ? error.message : error);
    }
  }

  const updatePayload = {
    roblox_link: socialLinks.roblox_link?.url ?? game.roblox_link ?? null,
    community_link: socialLinks.community_link?.url ?? game.community_link ?? null,
    discord_link: socialLinks.discord_link?.url ?? game.discord_link ?? null,
    twitter_link: socialLinks.twitter_link?.url ?? game.twitter_link ?? null,
    youtube_link: socialLinks.youtube_link?.url ?? game.youtube_link ?? null,
    universe_id: resolvedUniverseId ?? game.universe_id ?? null,
    cover_image: coverImage ?? game.cover_image ?? null,
  };

  const { error } = await supabase.from("code_pages").update(updatePayload).eq("id", game.id);
  if (error) throw new Error(`Failed to update ${game.slug}: ${error.message}`);

  stats.processed += 1;
  if (
    updatePayload.roblox_link ||
    updatePayload.community_link ||
    updatePayload.discord_link ||
    updatePayload.twitter_link ||
    updatePayload.youtube_link
  ) {
    stats.linksUpdated += 1;
  }
  if (updatePayload.roblox_link) stats.robloxLinks += 1;
  if (updatePayload.universe_id) stats.universeIds += 1;
  if (updatePayload.cover_image) stats.coverImages += 1;

  console.log(
    `✅ ${game.slug}: roblox=${Boolean(updatePayload.roblox_link)} universe=${updatePayload.universe_id ?? "none"} cover=${Boolean(updatePayload.cover_image)}`
  );
}

function parseLimit(args: string[]): number | null {
  const arg = args.find((value) => value.startsWith("--limit="));
  if (!arg) return null;
  const parsed = Number(arg.slice("--limit=".length));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function parseStartAfterSlug(args: string[]): string | null {
  const arg = args.find((value) => value.startsWith("--start-after-slug="));
  const slug = arg ? arg.slice("--start-after-slug=".length).trim() : "";
  return slug || null;
}

function parseConcurrency(args: string[]): number {
  const arg = args.find((value) => value.startsWith("--concurrency="));
  const parsed = arg ? Number(arg.slice("--concurrency=".length)) : 4;
  if (!Number.isFinite(parsed) || parsed <= 0) return 4;
  return Math.min(8, Math.floor(parsed));
}

async function countWhereNotNull(column: keyof CodePageRow): Promise<number> {
  const { count, error } = await supabase
    .from("code_pages")
    .select("id", { count: "exact", head: true })
    .eq("is_published", false)
    .not(column, "is", null);
  if (error) throw new Error(`Failed to count ${column}: ${error.message}`);
  return count ?? 0;
}

async function verify() {
  const { count: total, error: totalError } = await supabase
    .from("code_pages")
    .select("id", { count: "exact", head: true })
    .eq("is_published", false);
  if (totalError) throw new Error(`Failed to count code pages: ${totalError.message}`);

  const { count: universes, error: universeError } = await supabase
    .from("roblox_universes")
    .select("universe_id", { count: "exact", head: true });
  if (universeError) throw new Error(`Failed to count universes: ${universeError.message}`);

  return {
    unpublishedCodePages: total ?? 0,
    robloxLinks: await countWhereNotNull("roblox_link"),
    universeIds: await countWhereNotNull("universe_id"),
    coverImages: await countWhereNotNull("cover_image"),
    discordLinks: await countWhereNotNull("discord_link"),
    twitterLinks: await countWhereNotNull("twitter_link"),
    communityLinks: await countWhereNotNull("community_link"),
    youtubeLinks: await countWhereNotNull("youtube_link"),
    universes,
  };
}

async function main() {
  assertLocalSupabase();

  const args = process.argv.slice(2);
  const limit = parseLimit(args);
  const startAfterSlug = parseStartAfterSlug(args);
  const concurrency = parseConcurrency(args);
  const codePages = await loadUnpublishedCodePages(limit, startAfterSlug);

  if (!codePages.length) {
    console.log("No local unpublished code pages found.");
    return;
  }

  console.log(
    `🧾 Local enrichment target: ${codePages.length} unpublished code page${codePages.length === 1 ? "" : "s"} with concurrency ${concurrency}${
      RETRY_MISSING_UNIVERSE_ONLY ? " (missing universe retry only)" : ""
    }`
  );
  const stats: EnrichmentStats = {
    processed: 0,
    failed: 0,
    linksUpdated: 0,
    robloxLinks: 0,
    universeIds: 0,
    coverImages: 0,
    googleSearches: 0,
  };

  await promisePool(codePages, concurrency, async (game) => {
    try {
      await enrichCodePage(game, stats);
    } catch (error) {
      stats.failed += 1;
      console.error(`❌ Failed ${game.slug}:`, error instanceof Error ? error.message : error);
    }
    await sleep(500);
  });

  const verification = await verify();
  console.log("\n✅ Local enrichment complete.");
  console.log(JSON.stringify({ stats, verification }, null, 2));
}

main().catch((error) => {
  console.error("❌ Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
