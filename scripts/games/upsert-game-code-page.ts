import "../shared/load-env";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeGameSlug } from "@/lib/slug";
import { ensureUniverseForRobloxLink } from "@/lib/roblox/universe";
import { supabaseAdmin } from "@/lib/supabase-admin";

type SourceUrlFields = Partial<Record<`source_url${"" | "_2" | "_3" | "_4" | "_5" | "_6" | "_7" | "_8" | "_9" | "_10"}`, string | null>>;

type CodePagePayload = {
  name: string;
  slug?: string;
  publish?: boolean;
  sourceUrls?: string[];
  robloxLink?: string | null;
  communityLink?: string | null;
  discordLink?: string | null;
  twitterLink?: string | null;
  youtubeLink?: string | null;
  coverImage?: string | null;
  seoTitle?: string | null;
  seoDescription: string;
  introMd: string;
  redeemMd: string;
  rewardsMd: string;
  troubleshootMd: string;
  findCodesMd: string;
};

type ExistingGame = {
  id: string;
  slug: string;
  name: string;
  cover_image: string | null;
  is_published: boolean;
  published_at: string | null;
  universe_id: number | null;
};

type CliOptions = {
  file?: string;
  dryRun: boolean;
  publish?: boolean;
};

function printUsage() {
  console.log(`\nUsage: npm run upsert:game-code-page -- --file <payload.json> [options]\n\nOptions:\n  --file <path>          JSON payload with code page games-row fields and source URLs.\n  --dry-run              Print the planned create/update without writing.\n  --draft                Save the game row as unpublished.\n  --publish              Save the game row as published.\n  -h, --help             Show this help message.\n`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--file": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value for --file");
        options.file = value;
        i += 1;
        break;
      }
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--draft":
        options.publish = false;
        break;
      case "--publish":
        options.publish = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Payload field ${field} is required`);
  }
  return value.trim();
}

function validatePayload(value: unknown): CodePagePayload {
  if (!value || typeof value !== "object") {
    throw new Error("Payload must be an object");
  }
  const payload = value as Record<string, unknown>;
  const requiredMarkdown = ["seoDescription", "introMd", "redeemMd", "rewardsMd", "troubleshootMd", "findCodesMd"];

  const name = assertString(payload.name, "name");
  for (const field of requiredMarkdown) {
    assertString(payload[field], field);
  }

  return {
    ...(payload as CodePagePayload),
    name,
    slug: typeof payload.slug === "string" ? payload.slug.trim() : undefined,
    seoDescription: assertString(payload.seoDescription, "seoDescription"),
    introMd: assertString(payload.introMd, "introMd"),
    redeemMd: assertString(payload.redeemMd, "redeemMd"),
    rewardsMd: assertString(payload.rewardsMd, "rewardsMd"),
    troubleshootMd: assertString(payload.troubleshootMd, "troubleshootMd"),
    findCodesMd: assertString(payload.findCodesMd, "findCodesMd"),
  };
}

async function loadPayload(filePath: string): Promise<CodePagePayload> {
  const resolved = path.resolve(process.cwd(), filePath);
  const raw = await readFile(resolved, "utf8");
  return validatePayload(JSON.parse(raw));
}

function mapSourceUrls(sourceUrls: string[] | undefined): SourceUrlFields {
  const fields: SourceUrlFields = {};
  const keys: Array<keyof SourceUrlFields> = [
    "source_url",
    "source_url_2",
    "source_url_3",
    "source_url_4",
    "source_url_5",
    "source_url_6",
    "source_url_7",
    "source_url_8",
    "source_url_9",
    "source_url_10",
  ];

  const normalized = Array.from(
    new Set(
      (sourceUrls ?? [])
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter(Boolean)
    )
  ).slice(0, keys.length);

  for (let i = 0; i < keys.length; i += 1) {
    fields[keys[i]] = normalized[i] ?? null;
  }

  return fields;
}

async function fetchRobloxThumbnail(
  robloxLink: string | null | undefined,
  universeIdHint?: number | null
): Promise<string | null> {
  if (!robloxLink && !universeIdHint) return null;
  const placeMatch = robloxLink?.match(/roblox\.com\/(?:games|game-details)\/(\d+)/i);
  const placeId = placeMatch ? placeMatch[1] : null;
  let universeId = universeIdHint ?? null;

  try {
    if (!universeId && placeId) {
      const placeDetailsRes = await fetch(
        `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; BloxodesBot/1.0)" } }
      );
      if (placeDetailsRes.ok) {
        const placeDetails = await placeDetailsRes.json();
        universeId = Array.isArray(placeDetails) ? placeDetails[0]?.universeId : null;
      }
    }
    if (!universeId) return null;

    const thumbRes = await fetch(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; BloxodesBot/1.0)" } }
    );
    if (!thumbRes.ok) return null;
    const thumbs = await thumbRes.json();
    const imageUrl = thumbs?.data?.[0]?.thumbnails?.[0]?.imageUrl ?? thumbs?.data?.[0]?.imageUrl;
    return typeof imageUrl === "string" ? imageUrl : null;
  } catch {
    return null;
  }
}

async function upsertGamePage(payload: CodePagePayload, options: CliOptions) {
  const sb = supabaseAdmin();
  const slug = normalizeGameSlug(payload.name, payload.slug ?? payload.name);
  const publish = options.publish ?? payload.publish ?? true;

  const { data: existing, error: existingError } = await sb
    .from("games")
    .select("id, slug, name, cover_image, is_published, published_at, universe_id")
    .eq("slug", slug)
    .maybeSingle<ExistingGame>();

  if (existingError) {
    throw new Error(`Failed to check existing game: ${existingError.message}`);
  }

  let universeId = existing?.universe_id ?? null;
  if (payload.robloxLink) {
    try {
      const ensured = await ensureUniverseForRobloxLink(sb as any, payload.robloxLink);
      universeId = ensured.universeId ?? universeId;
    } catch (error) {
      console.warn("Warning: failed to ensure Roblox universe:", error instanceof Error ? error.message : error);
    }
  }

  const resolvedCoverImage =
    payload.coverImage !== undefined
      ? payload.coverImage
      : existing?.cover_image ?? (await fetchRobloxThumbnail(payload.robloxLink, universeId));

  const gamePayload: Record<string, unknown> = {
    name: payload.name,
    slug,
    is_published: publish,
    seo_title: payload.seoTitle ?? null,
    seo_description: payload.seoDescription,
    intro_md: payload.introMd,
    redeem_md: payload.redeemMd,
    rewards_md: payload.rewardsMd,
    troubleshoot_md: payload.troubleshootMd,
    find_codes_md: payload.findCodesMd,
    roblox_link: payload.robloxLink ?? null,
    community_link: payload.communityLink ?? null,
    discord_link: payload.discordLink ?? null,
    twitter_link: payload.twitterLink ?? null,
    youtube_link: payload.youtubeLink ?? null,
    cover_image: resolvedCoverImage ?? null,
    universe_id: universeId,
    ...mapSourceUrls(payload.sourceUrls),
  };

  if (publish && !existing?.published_at) {
    gamePayload.published_at = new Date().toISOString();
  }

  if (options.dryRun) {
    console.log(existing ? `Would update ${slug}` : `Would create ${slug}`);
    console.log(JSON.stringify({ gamePayload }, null, 2));
    return;
  }

  const query = existing
    ? sb.from("games").update(gamePayload).eq("id", existing.id)
    : sb.from("games").insert(gamePayload);

  const { data: saved, error: saveError } = await query
    .select("id, slug, name, is_published")
    .single<{ id: string; slug: string; name: string; is_published: boolean }>();

  if (saveError || !saved) {
    throw new Error(`Failed to ${existing ? "update" : "create"} game row: ${saveError?.message ?? "no row returned"}`);
  }

  console.log(
    `${existing ? "Updated" : "Created"} ${saved.slug} (${saved.is_published ? "published" : "draft"}) - source URLs saved; run refresh:codes to collect codes.`
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.file) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const payload = await loadPayload(options.file);
  await upsertGamePage(payload, options);
}

main().catch((error) => {
  console.error("Fatal upsert error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
