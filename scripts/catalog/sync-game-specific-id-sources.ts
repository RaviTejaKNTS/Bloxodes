import "../shared/load-env";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

type MusicUsage = {
  game_slug: string;
  universe_id?: number | null;
  asset_id: number;
  use_type: string;
  display_name: string;
  source_artist?: string | null;
  source_album?: string | null;
  source_duration_seconds?: number | null;
  source_album_art_asset_id?: number | null;
  category: string | null;
  tags: string[];
  source_url: string;
  source_checked_at: string;
  compatibility_status: "community_reported" | "source_verified";
  sort_order: number;
};

type DecalUsage = {
  game_slug: string;
  asset_id: number;
  texture_id: number | null;
  use_type: string;
  display_name: string;
  category: string | null;
  tags: string[];
  image_url: string | null;
  source_url: string;
  source_checked_at: string;
  compatibility_status: "community_reported" | "source_verified";
  sort_order: number;
};

const SOURCES = {
  jjs: "https://jjsbuilder.com/jjs-kill-sounds/",
  daHood: "https://rocodes.gg/decals/game/da-hood-crosshairs",
  sprayPaint: "https://robloxden.com/game-codes/spray-paint",
  forsaken: "https://stealthygaming.com/roblox-forsaken-hit-sound-ids/",
  tsb: "https://progameguides.com/roblox/the-strongest-battlegrounds-kill-sound-ids-list-roblox/",
  berryPictures: "https://tryhardguides.com/berry-avenue-picture-codes/",
  berryRugs: "https://tryhardguides.com/berry-avenue-rug-codes/",
  shindoEyes: "https://tryhardguides.com/shindo-life-eye-id-codes/",
  shindoFaces: "https://www.touchtapplay.com/shindo-life-face-id-codes/"
} as const;

const TSB_SOURCE_SEED = [
  ["2010 Song", 8140095101], ["Acne Sad", 6185331235], ["Ah Nope", 5304557205],
  ["Ahhh", 7772283448], ["Alarm", 792323017], ["Among Us", 7227567562],
  ["Android", 6879335951], ["Angstorm", 118505724922369], ["Anime Laugh", 82719020266339],
  ["Another Fatherless Child", 8235260386], ["Ara Ara", 8233569802], ["Arsenal", 78304589786200],
  ["Baldi", 93445142046152], ["Beat With a Stick", 8550333107], ["Bedfellows Fatigue", 84141227975191],
  ["Binah", 99978810893965], ["Binah Sound", 129852576674028], ["Bird Meme", 15704325502],
  ["Birb", 6286038151], ["Bleh Bleh Bleh", 127527672583618], ["Blood Splash", 5700183626],
  ["Blue King", 87152150064850], ["Blue Passport", 7291000847], ["Bone Cold", 9073674876],
  ["Bonk", 3765689841], ["Boom Headshot", 7361085557], ["Breath", 18798027781],
  ["Breaking Mirror", 8378549872], ["Bruh", 6349641063], ["Bugle Charge", 1838998408]
] as const;

type ExperienceSongSource = {
  gameSlug: string;
  universeId: number;
  useType: string;
  category: string;
  tags: string[];
  minimumRows: number;
};

const EXPERIENCE_SONG_SOURCES: ExperienceSongSource[] = [
  {
    gameSlug: "adopt-me",
    universeId: 383310974,
    useType: "top_experience_song",
    category: "Top Songs in Adopt Me",
    tags: ["jukebox", "top experience song"],
    minimumRows: 75
  },
  {
    gameSlug: "murder-mystery-2",
    universeId: 66654135,
    useType: "radio_top_song",
    category: "Top Songs in Murder Mystery 2",
    tags: ["radio", "top experience song"],
    minimumRows: 75
  },
  {
    gameSlug: "jujutsu-shenanigans",
    universeId: 3508322461,
    useType: "boombox_top_song",
    category: "Top Songs in Jujutsu Shenanigans",
    tags: ["boombox", "top experience song"],
    minimumRows: 70
  },
  {
    gameSlug: "brookhaven-rp",
    universeId: 1686885941,
    useType: "speaker_catalog_song",
    category: "Songs associated with Brookhaven RP",
    tags: ["speaker", "music unlocked", "experience song"],
    minimumRows: 75
  }
];

const OUTPUT = path.resolve(process.cwd(), "data/game-specific-ids/source-backed.json");

type CliOptions = {
  onlyMusicGame: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  let onlyMusicGame: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--only-music-game") {
      onlyMusicGame = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${argv[index]}`);
  }
  return { onlyMusicGame };
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "Bloxodes source refresh (+https://bloxodes.com)" },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function checkedAt() {
  return new Date().toISOString();
}

function parseJjsKillSounds(html: string): MusicUsage[] {
  const $ = cheerio.load(html);
  const list = $("script[type='application/ld+json']")
    .toArray()
    .map((element) => {
      try {
        return JSON.parse($(element).text()) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .find((value) => value?.["@type"] === "ItemList" && value.name === "JJS Kill Sound IDs");

  const entries = Array.isArray(list?.itemListElement) ? list.itemListElement : [];
  const timestamp = checkedAt();
  const rows = entries.flatMap((entry, index) => {
    const item = entry as { name?: unknown; description?: unknown };
    const match = String(item.description ?? "").match(/Sound ID:\s*(\d+)/i);
    const assetId = match ? Number(match[1]) : 0;
    const name = String(item.name ?? "").trim();
    if (!Number.isSafeInteger(assetId) || assetId <= 0 || !name) return [];
    return [{
      game_slug: "jujutsu-shenanigans",
      asset_id: assetId,
      use_type: "kill_death",
      display_name: name,
      category: "Kill and death sound",
      tags: ["kill sound", "death sound"],
      source_url: SOURCES.jjs,
      source_checked_at: timestamp,
      compatibility_status: "community_reported" as const,
      sort_order: index + 1
    }];
  });
  if (rows.length < 50) throw new Error(`JJS parser found only ${rows.length} rows`);
  return rows;
}

function parseDaHoodCrosshairs(html: string): DecalUsage[] {
  const $ = cheerio.load(html);
  const timestamp = checkedAt();
  const rows = $("img[src*='images.rocodes.gg/decals'], img[srcset*='images.rocodes.gg/decals']")
    .toArray()
    .flatMap((image, index) => {
      const card = $(image).parent().parent();
      const name = card.find("span.text-base").first().text().trim() || "Crosshair";
      const assetId = Number(card.find("span.font-semibold").last().text().trim());
      const source = $(image).attr("srcset") || $(image).attr("src") || "";
      const imageMatch = source.match(/https:\/\/images\.rocodes\.gg\/decals\/(\d+)\.png/i);
      if (!Number.isSafeInteger(assetId) || assetId <= 0) return [];
      return [{
        game_slug: "da-hood",
        asset_id: assetId,
        texture_id: null,
        use_type: "crosshair",
        display_name: name,
        category: "Crosshair",
        tags: ["crosshair", "cursor"],
        image_url: imageMatch ? `https://images.rocodes.gg/decals/${imageMatch[1]}.png` : null,
        source_url: SOURCES.daHood,
        source_checked_at: timestamp,
        compatibility_status: "community_reported" as const,
        sort_order: index + 1
      }];
    });
  const unique = Array.from(new Map(rows.map((row) => [row.asset_id, row])).values());
  if (unique.length < 20) throw new Error(`Da Hood parser found only ${unique.length} rows`);
  return unique;
}

function parseSprayPaintCandidates(html: string): DecalCandidate[] {
  const $ = cheerio.load(html);
  const rows = $("tr:not([data-expired='true']) [data-copy]")
    .toArray()
    .flatMap((copy, index) => {
      const assetId = Number($(copy).attr("data-copy"));
      const row = $(copy).closest("tr");
      const reward = row.find("td.search-term strong").first().text().trim();
      const name = reward.replace(/\s*Decal$/i, "").trim() || "Spray Paint image";
      if (!Number.isSafeInteger(assetId) || assetId <= 0) return [];
      return [{
        gameSlug: "spray-paint",
        assetId,
        name,
        useType: "spray_paint",
        category: "Spray Paint image",
        tags: ["spray paint", "image"],
        sourceUrl: SOURCES.sprayPaint,
        sortOrder: index + 1
      }];
    });
  const unique = Array.from(new Map(rows.map((row) => [row.assetId, row])).values());
  if (unique.length < 100) throw new Error(`Spray Paint parser found only ${unique.length} active rows`);
  return unique;
}

function parseForsakenHitSounds(html: string): MusicUsage[] {
  const $ = cheerio.load(html);
  const timestamp = checkedAt();
  const rows = $("table tr").toArray().flatMap((element, index) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    const match = text.match(/^(.*?)\s+(\d{6,})$/);
    if (!match) return [];
    const assetId = Number(match[2]);
    const name = match[1].trim();
    if (!Number.isSafeInteger(assetId) || assetId <= 0 || !name) return [];
    return [{
      game_slug: "forsaken",
      asset_id: assetId,
      use_type: "hit_sound",
      display_name: name,
      category: "Hit sound",
      tags: ["hit sound", "short sound"],
      source_url: SOURCES.forsaken,
      source_checked_at: timestamp,
      compatibility_status: "community_reported" as const,
      sort_order: index + 1
    }];
  });
  const unique = Array.from(new Map(rows.map((row) => [row.asset_id, row])).values());
  if (unique.length < 60) throw new Error(`Forsaken parser found only ${unique.length} IDs`);
  return unique;
}

function buildTsbSourceSeed(): MusicUsage[] {
  const timestamp = checkedAt();
  return TSB_SOURCE_SEED.map(([name, assetId], index) => ({
    game_slug: "the-strongest-battlegrounds",
    asset_id: assetId,
    use_type: "kill_death",
    display_name: name,
    category: "Kill and death sound",
    tags: ["kill sound", "death sound"],
    source_url: SOURCES.tsb,
    source_checked_at: timestamp,
    compatibility_status: "community_reported" as const,
    sort_order: index + 1
  }));
}

type DecalCandidate = {
  gameSlug: string;
  assetId: number;
  textureId?: number | null;
  name: string;
  useType: string;
  category: string;
  tags: string[];
  sourceUrl: string;
  sortOrder: number;
};

function extractRobloxAssetId(href: string) {
  const match = href.match(/\/(?:library|catalog|marketplace\/asset)\/(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function parseLinkedDecalCandidates(
  html: string,
  sourceUrl: string,
  defaults: Omit<DecalCandidate, "assetId" | "name" | "sourceUrl" | "sortOrder">
): DecalCandidate[] {
  const $ = cheerio.load(html);
  const rows = $("a[href*='create.roblox.com/marketplace/asset'], a[href*='roblox.com/library'], a[href*='roblox.com/catalog']")
    .toArray()
    .flatMap((element, index) => {
      const assetId = extractRobloxAssetId($(element).attr("href") || "");
      const name = $(element).text().replace(/\s+/g, " ").trim();
      if (!Number.isSafeInteger(assetId) || assetId <= 0 || !name) return [];
      return [{ ...defaults, assetId, name, sourceUrl, sortOrder: index + 1 }];
    });
  return Array.from(new Map(rows.map((row) => [row.assetId, row])).values());
}

function parseTextDecalCandidates(
  html: string,
  sourceUrl: string,
  defaults: Omit<DecalCandidate, "assetId" | "name" | "sourceUrl" | "sortOrder">
): DecalCandidate[] {
  const $ = cheerio.load(html);
  const rows = $("li").toArray().flatMap((element, index) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    const match = text.match(/^(.*?):\s*(\d{6,})$/);
    if (!match) return [];
    const assetId = Number(match[2]);
    const name = match[1].trim();
    if (!Number.isSafeInteger(assetId) || assetId <= 0 || !name) return [];
    return [{ ...defaults, assetId, name, sourceUrl, sortOrder: index + 1 }];
  });
  return Array.from(new Map(rows.map((row) => [row.assetId, row])).values());
}

async function mapWithConcurrency<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>) {
  const output = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await mapper(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return output;
}

async function verifyDecalCandidates(candidates: DecalCandidate[]): Promise<DecalUsage[]> {
  const unique = Array.from(new Map(candidates.map((row) => [`${row.gameSlug}:${row.assetId}`, row])).values());
  const verified = (await mapWithConcurrency(unique, 12, async (candidate) => {
    const response = await fetch(`https://apis.roblox.com/toolbox-service/v2/assets/${candidate.assetId}`, {
      headers: { "user-agent": "Bloxodes source refresh (+https://bloxodes.com)" },
      signal: AbortSignal.timeout(20_000)
    });
    let assetTypeId: number | undefined;
    let textureId = candidate.textureId ?? null;
    let officialName = candidate.name;
    if (response.ok) {
      const payload = await response.json() as { asset?: { assetTypeId?: number; textureId?: number; name?: string } };
      assetTypeId = payload.asset?.assetTypeId;
      textureId = Number(payload.asset?.textureId) || textureId;
      officialName = payload.asset?.name?.trim() || officialName;
    } else if (candidate.gameSlug === "bloxburg") {
      const economyResponse = await fetch(`https://economy.roblox.com/v2/assets/${candidate.assetId}/details`, {
        headers: { "user-agent": "Bloxodes source refresh (+https://bloxodes.com)" },
        signal: AbortSignal.timeout(20_000)
      });
      if (!economyResponse.ok) return null;
      const economy = await economyResponse.json() as { AssetTypeId?: number; Name?: string };
      assetTypeId = economy.AssetTypeId;
      officialName = economy.Name?.trim() || officialName;
    } else {
      return null;
    }
    if (assetTypeId !== 13 || /bypass/i.test(officialName)) return null;
    const verifiedCandidate = candidate.gameSlug === "spray-paint"
      ? { ...candidate, name: officialName }
      : candidate;
    return { candidate: verifiedCandidate, textureId };
  })).filter((row): row is NonNullable<typeof row> => Boolean(row));

  const thumbnailMap = new Map<number, string>();
  for (let index = 0; index < verified.length; index += 100) {
    const ids = verified.slice(index, index + 100).map((row) => row.candidate.assetId);
    const url = new URL("https://thumbnails.roblox.com/v1/assets");
    url.searchParams.set("assetIds", ids.join(","));
    url.searchParams.set("size", "420x420");
    url.searchParams.set("format", "Png");
    url.searchParams.set("isCircular", "false");
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Thumbnail request returned ${response.status}`);
    const payload = await response.json() as { data?: Array<{ targetId?: number; state?: string; imageUrl?: string }> };
    for (const item of payload.data ?? []) {
      if (item.targetId && item.state === "Completed" && item.imageUrl) thumbnailMap.set(item.targetId, item.imageUrl);
    }
  }

  const timestamp = checkedAt();
  return verified.flatMap(({ candidate, textureId }) => {
    if (candidate.gameSlug === "shindo-life" && !textureId) return [];
    if (candidate.gameSlug === "spray-paint" && !thumbnailMap.has(candidate.assetId)) return [];
    return [{
      game_slug: candidate.gameSlug,
      asset_id: candidate.assetId,
      texture_id: textureId,
      use_type: candidate.useType,
      display_name: candidate.name,
      category: candidate.category,
      tags: candidate.tags,
      image_url: thumbnailMap.get(candidate.assetId) ?? null,
      source_url: candidate.sourceUrl,
      source_checked_at: timestamp,
      compatibility_status: "source_verified" as const,
      sort_order: candidate.sortOrder
    }];
  });
}

type CreatorStoreSearchRow = {
  asset?: {
    id?: number;
    textureId?: number;
    name?: string;
    assetTypeId?: number;
  };
};

async function collectCreatorStoreDecals(options: {
  gameSlug: string;
  query: string;
  useType: string;
  category: string;
  tags: string[];
  requireTextureId?: boolean;
}): Promise<DecalUsage[]> {
  const url = new URL("https://apis.roblox.com/toolbox-service/v2/assets:search");
  url.searchParams.set("searchCategoryType", "Decal");
  url.searchParams.set("query", options.query);
  url.searchParams.set("maxPageSize", "100");
  url.searchParams.set("sortCategory", "Top");
  url.searchParams.set("sortDirection", "Descending");
  url.searchParams.set("searchView", "Full");
  url.searchParams.set("includeOnlyVerifiedCreators", "false");

  const response = await fetch(url, {
    headers: { "user-agent": "Bloxodes source refresh (+https://bloxodes.com)" },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Creator Store ${options.query} search returned ${response.status}`);
  const payload = await response.json() as { creatorStoreAssets?: CreatorStoreSearchRow[] };
  const candidates = (payload.creatorStoreAssets ?? []).flatMap((row, index) => {
    const assetId = Number(row.asset?.id);
    const textureId = Number(row.asset?.textureId) || null;
    const name = row.asset?.name?.trim() || `${options.category} image`;
    if (row.asset?.assetTypeId !== 13 || !Number.isSafeInteger(assetId) || assetId <= 0) return [];
    if (options.requireTextureId && !textureId) return [];
    if (/bypass/i.test(name)) return [];
    return [{ assetId, textureId, name, sortOrder: index + 1 }];
  });

  const thumbnailMap = new Map<number, string>();
  for (let index = 0; index < candidates.length; index += 100) {
    const url = new URL("https://thumbnails.roblox.com/v1/assets");
    url.searchParams.set("assetIds", candidates.slice(index, index + 100).map((row) => row.assetId).join(","));
    url.searchParams.set("size", "420x420");
    url.searchParams.set("format", "Png");
    url.searchParams.set("isCircular", "false");
    const thumbnailResponse = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!thumbnailResponse.ok) throw new Error(`Thumbnail request returned ${thumbnailResponse.status}`);
    const thumbnailPayload = await thumbnailResponse.json() as { data?: Array<{ targetId?: number; state?: string; imageUrl?: string }> };
    for (const item of thumbnailPayload.data ?? []) {
      if (item.targetId && item.state === "Completed" && item.imageUrl) thumbnailMap.set(item.targetId, item.imageUrl);
    }
  }

  const timestamp = checkedAt();
  return candidates.flatMap((candidate) => {
    const imageUrl = thumbnailMap.get(candidate.assetId);
    if (!imageUrl) return [];
    return [{
      game_slug: options.gameSlug,
      asset_id: candidate.assetId,
      texture_id: candidate.textureId,
      use_type: options.useType,
      display_name: candidate.name,
      category: options.category,
      tags: options.tags,
      image_url: imageUrl,
      source_url: url.toString(),
      source_checked_at: timestamp,
      compatibility_status: "source_verified" as const,
      sort_order: candidate.sortOrder
    }];
  });
}

async function collectBloxburgCandidates(): Promise<DecalCandidate[]> {
  const categories = ["Art", "Patterns", "Signs", "Nature", "Modern", "Food", "Fashion"];
  const groups = await Promise.all(categories.map(async (category) => {
    const url = new URL("https://bloxburg.djmarkuss.com/api/decals");
    url.searchParams.set("category", category);
    url.searchParams.set("sort", "latest");
    url.searchParams.set("page", "1");
    url.searchParams.set("limit", "100");
    const response = await fetch(url, {
      headers: { "user-agent": "Bloxodes source refresh (+https://bloxodes.com)" },
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`Bloxburg ${category} source returned ${response.status}`);
    const payload = await response.json() as {
      decals?: Array<{
        assetId?: string | number;
        textureId?: string | number;
        textureResolved?: boolean;
        assetType?: string;
        name?: string;
        category?: string;
        tags?: string[];
      }>;
    };
    return (payload.decals ?? []).flatMap((row, index) => {
      const assetId = Number(row.assetId);
      const textureId = Number(row.textureId);
      if (row.assetType !== "Decal" || !row.textureResolved || !Number.isSafeInteger(assetId) || assetId <= 0) return [];
      if (!Number.isSafeInteger(textureId) || textureId <= 0 || textureId === assetId) return [];
      return [{
        gameSlug: "bloxburg",
        assetId,
        textureId,
        name: row.name?.trim() || `${category} picture`,
        useType: category.toLowerCase(),
        category: row.category?.trim() || category,
        tags: Array.from(new Set([category.toLowerCase(), ...(row.tags ?? [])])).slice(0, 8),
        sourceUrl: "https://bloxburg.djmarkuss.com/",
        sortOrder: index + 1
      }];
    });
  }));
  return Array.from(new Map(groups.flat().map((row) => [row.assetId, row])).values()).slice(0, 200);
}

type ExperienceSong = {
  assetId?: number;
  title?: string;
  artist?: string;
  album?: string | null;
  duration?: number;
  albumArtAssetId?: number | null;
};

async function collectExperienceSongs(source: ExperienceSongSource): Promise<MusicUsage[]> {
  const rows: ExperienceSong[] = [];
  let pageToken: string | null = null;
  do {
    const url = new URL("https://apis.roblox.com/music-discovery/v1/experience-songs");
    url.searchParams.set("universeId", String(source.universeId));
    url.searchParams.set("limit", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { "user-agent": "Bloxodes source refresh (+https://bloxodes.com)" },
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    const payload = await response.json() as { songs?: ExperienceSong[]; nextPageToken?: string | null };
    rows.push(...(payload.songs ?? []));
    pageToken = payload.nextPageToken ?? null;
  } while (pageToken);

  const sourceUrl = `https://apis.roblox.com/music-discovery/v1/experience-songs?universeId=${source.universeId}&limit=50`;
  const timestamp = checkedAt();
  const unique = Array.from(new Map(rows.map((song) => [song.assetId, song])).values());
  const mapped = unique.flatMap((song, index) => {
    const assetId = Number(song.assetId);
    const name = String(song.title ?? "").trim();
    if (!Number.isSafeInteger(assetId) || assetId <= 0 || !name) return [];
    return [{
      game_slug: source.gameSlug,
      universe_id: source.universeId,
      asset_id: assetId,
      use_type: source.useType,
      display_name: name,
      source_artist: String(song.artist ?? "").trim() || null,
      source_album: String(song.album ?? "").trim() || null,
      source_duration_seconds: Number.isFinite(song.duration) ? Math.max(0, Math.round(song.duration!)) : null,
      source_album_art_asset_id: Number.isSafeInteger(song.albumArtAssetId) ? song.albumArtAssetId! : null,
      category: source.category,
      tags: source.tags,
      source_url: sourceUrl,
      source_checked_at: timestamp,
      compatibility_status: "source_verified" as const,
      sort_order: index + 1
    }];
  });
  if (mapped.length < source.minimumRows) {
    throw new Error(`${source.gameSlug} experience-song source returned only ${mapped.length} songs`);
  }
  return mapped;
}

async function refreshOneMusicGame(gameSlug: string) {
  const source = EXPERIENCE_SONG_SOURCES.find((candidate) => candidate.gameSlug === gameSlug);
  if (!source) {
    throw new Error(`No experience-song source configured for ${gameSlug}`);
  }
  const existing = JSON.parse(await readFile(OUTPUT, "utf8")) as {
    generated_at?: string;
    music?: MusicUsage[];
    decals?: DecalUsage[];
  };
  const music = (existing.music ?? []).filter((row) => row.game_slug !== gameSlug);
  music.push(...await collectExperienceSongs(source));
  await writeFile(OUTPUT, `${JSON.stringify({
    generated_at: checkedAt(),
    music,
    decals: existing.decals ?? []
  }, null, 2)}\n`, "utf8");
  console.log(`Refreshed ${music.filter((row) => row.game_slug === gameSlug).length} ${gameSlug} music mappings in ${path.relative(process.cwd(), OUTPUT)}.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.onlyMusicGame) {
    await refreshOneMusicGame(options.onlyMusicGame);
    return;
  }
  const [
    jjsHtml,
    daHoodHtml,
    sprayPaintHtml,
    forsakenHtml,
    berryPicturesHtml,
    berryRugsHtml,
    shindoEyesHtml,
    shindoFacesHtml,
    experienceSongGroups
  ] = await Promise.all([
    fetchHtml(SOURCES.jjs),
    fetchHtml(SOURCES.daHood),
    fetchHtml(SOURCES.sprayPaint),
    fetchHtml(SOURCES.forsaken),
    fetchHtml(SOURCES.berryPictures),
    fetchHtml(SOURCES.berryRugs),
    fetchHtml(SOURCES.shindoEyes),
    fetchHtml(SOURCES.shindoFaces),
    Promise.all(EXPERIENCE_SONG_SOURCES.map(collectExperienceSongs))
  ]);
  const music = [
    ...parseJjsKillSounds(jjsHtml),
    ...parseForsakenHitSounds(forsakenHtml),
    ...buildTsbSourceSeed(),
    ...experienceSongGroups.flat()
  ];
  const [bloxstrikeDecals, jjsCreatorStoreGroups, bloxburgCandidates] = await Promise.all([
    collectCreatorStoreDecals({
      gameSlug: "bloxstrike",
      query: "crosshair",
      useType: "custom_crosshair",
      category: "Crosshair",
      tags: ["crosshair", "cursor"]
    }),
    Promise.all(["anime", "meme", "character", "poster"].map((query) => collectCreatorStoreDecals({
      gameSlug: "jujutsu-shenanigans",
      query,
      useType: "image",
      category: `${query[0].toUpperCase()}${query.slice(1)} images`,
      tags: [query, "image"],
      requireTextureId: true
    }))),
    collectBloxburgCandidates()
  ]);
  const jjsCreatorStoreDecals = Array.from(
    new Map(jjsCreatorStoreGroups.flat().map((row) => [row.asset_id, row])).values()
  ).map((row, index) => ({ ...row, sort_order: index + 1 }));
  const verifiedDecals = await verifyDecalCandidates([
    ...parseSprayPaintCandidates(sprayPaintHtml),
    ...bloxburgCandidates,
    ...parseLinkedDecalCandidates(berryPicturesHtml, SOURCES.berryPictures, {
      gameSlug: "berry-avenue", useType: "picture", category: "Picture and wall art", tags: ["picture", "wall art"]
    }),
    ...parseLinkedDecalCandidates(berryRugsHtml, SOURCES.berryRugs, {
      gameSlug: "berry-avenue", useType: "rug", category: "Rug", tags: ["rug", "floor decor"]
    }),
    ...parseLinkedDecalCandidates(shindoEyesHtml, SOURCES.shindoEyes, {
      gameSlug: "shindo-life", useType: "eye", category: "Eyes", tags: ["eyes", "character customization"]
    }),
    ...parseTextDecalCandidates(shindoFacesHtml, SOURCES.shindoFaces, {
      gameSlug: "shindo-life", useType: "face", category: "Faces", tags: ["face", "character customization"]
    })
  ]);
  const decals = [
    ...parseDaHoodCrosshairs(daHoodHtml),
    ...bloxstrikeDecals,
    ...jjsCreatorStoreDecals,
    ...verifiedDecals
  ];
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify({ generated_at: checkedAt(), music, decals }, null, 2)}\n`, "utf8");
  console.log(`Wrote ${music.length} music and ${decals.length} decal mappings to ${path.relative(process.cwd(), OUTPUT)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
