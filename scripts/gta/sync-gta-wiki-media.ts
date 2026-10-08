import { gameDatabase } from "@/lib/game-content-db";
import "../shared/load-env";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadR2ClientConfig, R2Client } from "../shared/r2-client";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";

type GtaWikiMedia = {
  slug: string;
  coverImage: string;
  heroImage: string;
};

type HostedMedia = {
  key: string;
  publicUrl: string;
  body: Buffer;
  contentType: "image/webp";
  sha256: string;
  width: number;
  height: number;
};

/**
 * Reviewed media roles for every GTA wiki hub that is currently in scope.
 * coverImage is used for cards/social previews; heroImage is the separate,
 * square-friendly thumbnail beside the wiki title.
 */
export const GTA_WIKI_MEDIA: readonly GtaWikiMedia[] = [
  {
    slug: "gta",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/6/68/Logo-GTA.png/revision/latest?cb=20201109124008",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/8/86/Protagonists-GTA1.png/revision/latest?cb=20190902184308"
  },
  {
    slug: "gta-2",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/b/b4/GTA2_PC_screenshot.jpg/revision/latest?cb=20090310113436",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/9/91/ClaudeSpeed-GTA2-Render-Infobox.png/revision/latest?cb=20221116141134"
  },
  {
    slug: "gta-advance",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/1/1c/PromotionalWebsite-GTAA-Media-SS1.jpg/revision/latest?cb=20200408013537",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/a/a5/Mike-GTAA.jpg/revision/latest?cb=20230521021239"
  },
  {
    slug: "gta-iii",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/1/11/GTATrilogyDE-GTAIII-Screenshot1.png/revision/latest?cb=20211022125612",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/3/34/Claude-GTA3.png/revision/latest?cb=20230412193939"
  },
  {
    slug: "gta-4",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/4/44/GTAIV-Boxart.jpg/revision/latest?cb=20260330025009",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/9/9e/NikoBellic-GTAIV-Portrait.png/revision/latest?cb=20260212152128"
  },
  {
    slug: "gta-4-tlad",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/b/bc/Tlad_boxart.JPG/revision/latest?cb=20110914153831",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/2/29/JohnnyKlebitz-TLAD.jpg/revision/latest?cb=20260301101036"
  },
  {
    slug: "gta-4-tbogt",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/d/db/CoverArt-TBoGT.JPG/revision/latest?cb=20250907163031",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/b/b4/LuisFernandoLopez-TBOGT.jpg/revision/latest?cb=20220806150957"
  },
  {
    slug: "gta-5",
    coverImage: "https://media.rockstargames.com/rockstargames/img/global/news/upload/actual_1368203681.jpg",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/7/77/FranklinClinton-GTAV.png/revision/latest?cb=20150514182257"
  },
  {
    slug: "gta-online",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/2/2c/GTAOnline-StandaloneReleaseArtwork.jpg/revision/latest?cb=20220307210604",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/6/65/GTAOnline-BoxArt.jpg/revision/latest?cb=20260330025009"
  },
  {
    slug: "gta-chinatown-wars",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/9/9a/Screenshot-GTACW-Android.jpg/revision/latest?cb=20211103055359",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/8/84/HuangLee-GTACW.png/revision/latest?cb=20230616145140"
  },
  {
    slug: "gta-liberty-city-stories",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/4/43/CoverArt-GTALCS.png/revision/latest?cb=20240503114247",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/7/7c/ToniCipriani-GTALCS.png/revision/latest?cb=20230308121254"
  },
  {
    slug: "gta-london-1969",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/2/29/GTALondon1969-PCCover.jpg/revision/latest?cb=20171005061035",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/1/1f/Artwork-RodneyMorash-GTALondon.png/revision/latest?cb=20130703204655"
  },
  {
    slug: "gta-london-1961",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/7/7a/GTALondon1961-InfoboxImage.jpg/revision/latest?cb=20250831025636",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/0/09/HaroldCartwright-GTAL61-Portrait.png/revision/latest?cb=20220913064243"
  },
  {
    slug: "gta-san-andreas",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/4/48/Artwork-GroveStreetFamily-GTASA.jpg/revision/latest?cb=20130502205239",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/7/70/CJ-GTASA.png/revision/latest?cb=20260330025009"
  },
  {
    slug: "gta-vice-city",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/5/5b/GTATrilogyDE-GTAVC-Screenshot1.png/revision/latest?cb=20211022125747",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/a/ae/TommyVercetti-GTAVC.jpg/revision/latest?cb=20220618090315"
  },
  {
    slug: "gta-vice-city-stories",
    coverImage: "https://static.wikia.nocookie.net/gtawiki/images/f/fb/GTAVCS-Cover.jpg/revision/latest?cb=20230718045517",
    heroImage: "https://static.wikia.nocookie.net/gtawiki/images/c/cb/VictorVance-GTAVC2.png/revision/latest?cb=20230419175026"
  }
];

const PUBLIC_WIKI_MEDIA_BASE_URL = "https://media.bloxodes.com/wiki";

function printHelp() {
  console.log("Usage: npm run sync:gta-wiki-media -- [--manifest <reviewed-media.json>] [--apply] [--allow-prod] [--skip-source-check]");
  console.log("Defaults to a read-only plan. Production apply requires --allow-prod and the recognized production target.");
  console.log("An optional manifest replaces the built-in mapping with a nonempty JSON array of { slug, coverImage, heroImage } for the selected published hubs.");
}

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  let manifest: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") {
      const value = argv[++index];
      if (manifest || !value || value.startsWith("--")) throw new Error("Expected one file path after --manifest.");
      manifest = value;
    } else if (["--apply", "--allow-prod", "--skip-source-check", "--help", "-h"].includes(arg)) {
      flags.add(arg);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return { manifest, apply: flags.has("--apply"), allowProd: flags.has("--allow-prod"), skipSourceCheck: flags.has("--skip-source-check"), help: flags.has("--help") || flags.has("-h") };
}

async function loadMediaMapping(manifest: string | undefined): Promise<readonly GtaWikiMedia[]> {
  if (!manifest) return GTA_WIKI_MEDIA;
  const rows: unknown = JSON.parse(await readFile(manifest, "utf8"));
  if (!Array.isArray(rows) || !rows.length) throw new Error("Media manifest must be a nonempty array.");
  const slugs = new Set<string>();
  return rows.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Invalid media manifest row.");
    const { slug, coverImage, heroImage } = row as Record<string, unknown>;
    if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) {
      throw new Error("Media manifest slugs must be unique game slugs.");
    }
    for (const value of [coverImage, heroImage]) {
      if (typeof value !== "string" || new URL(value).protocol !== "https:") throw new Error(`Media for ${slug} must use HTTPS URLs.`);
    }
    if (coverImage === heroImage) throw new Error(`Cover and hero source URLs must differ for ${slug}.`);
    slugs.add(slug);
    return { slug, coverImage: coverImage as string, heroImage: heroImage as string };
  });
}

async function verifySourceUrl(url: string): Promise<void> {
  const head = await fetch(url, { method: "HEAD", redirect: "follow" });
  if (head.ok) return;
  const ranged = await fetch(url, {
    headers: { Range: "bytes=0-1023" },
    redirect: "follow"
  });
  if (!ranged.ok) throw new Error(`${url} returned HTTP ${ranged.status}.`);
}

async function verifySources(mediaRows: readonly GtaWikiMedia[]) {
  const urls = mediaRows.flatMap((media) => [media.coverImage, media.heroImage]);
  for (let index = 0; index < urls.length; index += 8) {
    await Promise.all(urls.slice(index, index + 8).map(verifySourceUrl));
  }
  console.log(`Verified ${urls.length} GTA wiki source image URLs.`);
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function prepareHostedMedia(slug: string, role: "cover" | "thumbnail", sourceUrl: string): Promise<HostedMedia> {
  const response = await fetch(sourceUrl, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${sourceUrl} returned HTTP ${response.status}.`);
  const source = Buffer.from(await response.arrayBuffer());
  const sourceMetadata = await sharp(source, { animated: true }).rotate().metadata();
  const thumbnailSize = Math.min(960, sourceMetadata.width ?? 960, sourceMetadata.height ?? 960);
  const body = await sharp(source, { animated: true })
    .rotate()
    .resize(role === "thumbnail"
      ? { width: thumbnailSize, height: thumbnailSize, fit: "cover", position: "attention" }
      : { width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
  const metadata = await sharp(body).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Could not read dimensions for ${sourceUrl}.`);
  if (role === "thumbnail" && metadata.width !== metadata.height) {
    throw new Error(`Thumbnail for ${slug} must be square; received ${metadata.width}x${metadata.height}.`);
  }
  const digest = sha256(body);
  const key = `gta/${slug}/hub-${role}-${digest.slice(0, 16)}.webp`;
  return {
    key,
    publicUrl: `${PUBLIC_WIKI_MEDIA_BASE_URL}/${key}`,
    body,
    contentType: "image/webp",
    sha256: digest,
    width: metadata.width,
    height: metadata.height
  };
}

async function prepareAllHostedMedia(mediaRows: readonly GtaWikiMedia[]): Promise<Map<string, { cover: HostedMedia; thumbnail: HostedMedia }>> {
  const prepared = new Map<string, { cover: HostedMedia; thumbnail: HostedMedia }>();
  for (const media of mediaRows) {
    const cover = await prepareHostedMedia(media.slug, "cover", media.coverImage);
    const thumbnail = await prepareHostedMedia(media.slug, "thumbnail", media.heroImage);
    prepared.set(media.slug, { cover, thumbnail });
    console.log(`Prepared hosted media for ${media.slug}: cover ${cover.width}x${cover.height}, thumbnail ${thumbnail.width}x${thumbnail.height}.`);
  }
  return prepared;
}

async function uploadHostedMedia(
  prepared: Map<string, { cover: HostedMedia; thumbnail: HostedMedia }>,
  r2: R2Client
) {
  for (const assets of prepared.values()) {
    for (const asset of [assets.cover, assets.thumbnail]) {
      if (!(await r2.hasObject(asset.key))) {
        await r2.putObject({
          key: asset.key,
          body: asset.body,
          contentType: asset.contentType,
          metadata: { width: asset.width, height: asset.height, sha256: asset.sha256 }
        });
      }
      if (!(await r2.hasObject(asset.key))) throw new Error(`R2 readback failed for ${asset.key}.`);
    }
  }
  console.log(`Verified ${prepared.size * 2} hosted GTA wiki media objects in R2.`);
}

async function requireRows(mediaRows: readonly GtaWikiMedia[]) {
  const sb = supabaseAdmin();
  const [games, pages] = await Promise.all([
    gameDatabase(sb, "gta").from("games").select("slug,is_published,cover_image,hero_image").in("slug", mediaRows.map((media) => media.slug)),
    gameDatabase(sb, "gta").from("wiki_pages").select("slug,is_published").in("slug", mediaRows.map((media) => media.slug))
  ]);
  if (games.error) throw games.error;
  if (pages.error) throw pages.error;

  const gameMap = new Map((games.data ?? []).map((row) => [row.slug, row]));
  const pageMap = new Map((pages.data ?? []).map((row) => [row.slug, row]));
  for (const media of mediaRows) {
    if (!gameMap.has(media.slug) || !gameMap.get(media.slug)?.is_published) {
      throw new Error(`Expected published GTA game row is missing: ${media.slug}`);
    }
    if (!pageMap.has(media.slug) || !pageMap.get(media.slug)?.is_published) {
      throw new Error(`Expected published gta_wiki_pages row is missing: ${media.slug}`);
    }
  }
}

async function applyMediaRoles(prepared: Map<string, { cover: HostedMedia; thumbnail: HostedMedia }>) {
  const sb = supabaseAdmin();
  for (const [slug, assets] of prepared) {
    const result = await gameDatabase(sb, "gta").from("games")
      .update({ cover_image: assets.cover.publicUrl, hero_image: assets.thumbnail.publicUrl })
      .eq("slug", slug)
      .eq("is_published", true)
      .select("slug");
    if (result.error) throw result.error;
    if ((result.data ?? []).length !== 1) throw new Error(`Could not update exactly one GTA hub: ${slug}`);
  }
  console.log(`Applied separate cover and thumbnail artwork to ${prepared.size} GTA hubs.`);
}

async function verifyState(prepared: Map<string, { cover: HostedMedia; thumbnail: HostedMedia }>) {
  const sb = supabaseAdmin();
  const slugs = [...prepared.keys()];
  const [games, pages, view] = await Promise.all([
    gameDatabase(sb, "gta").from("games").select("slug,is_published,cover_image,hero_image").in("slug", slugs),
    gameDatabase(sb, "gta").from("wiki_pages").select("slug,is_published").in("slug", slugs).eq("is_published", true),
    gameDatabase(sb, "gta").from("wiki_pages_view").select("slug,is_published,game_cover_image,game_hero_image").in("slug", slugs).eq("is_published", true)
  ]);
  for (const result of [games, pages, view]) {
    if (result.error) throw result.error;
  }

  const mediaBySlug = new Map(prepared);
  const gameRows = games.data ?? [];
  if (gameRows.length !== prepared.size) throw new Error("GTA hub image verification returned the wrong game count.");
  for (const row of gameRows) {
    const expected = mediaBySlug.get(row.slug);
    if (!expected || !row.is_published || row.cover_image !== expected.cover.publicUrl || row.hero_image !== expected.thumbnail.publicUrl || row.cover_image === row.hero_image) {
      throw new Error(`GTA hub image verification failed for ${row.slug}.`);
    }
  }
  if ((pages.data ?? []).length !== prepared.size || (view.data ?? []).length !== prepared.size) {
    throw new Error("GTA wiki publication verification returned the wrong hub count.");
  }
  console.log(`Verified ${prepared.size} published GTA hubs with distinct cover/thumbnail roles.`);
  console.log("Verified hub images use Bloxodes-hosted wiki media URLs.");
}

async function main() {
  const { apply, allowProd, skipSourceCheck, manifest, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }
  const mediaRows = await loadMediaMapping(manifest);
  if (!skipSourceCheck) await verifySources(mediaRows);
  await requireRows(mediaRows);
  if (!apply) {
    console.log(`Dry run only: ${mediaRows.length} GTA hubs would receive media roles.`);
    return;
  }
  const managed = isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL);
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (!managed && !production) throw new Error("Unrecognized Supabase target.");
  if (allowProd && (!apply || !production)) throw new Error("--allow-prod requires --apply and the recognized production target.");
  if (apply && production && !allowProd) throw new Error("Production GTA wiki media writes require --allow-prod.");
  const r2 = new R2Client(loadR2ClientConfig(process.env));
  const prepared = await prepareAllHostedMedia(mediaRows);
  await uploadHostedMedia(prepared, r2);
  await applyMediaRoles(prepared);
  await verifyState(prepared);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
