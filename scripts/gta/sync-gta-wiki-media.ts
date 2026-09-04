import "../shared/load-env";

import { createHash } from "node:crypto";
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

const GTA_VI_SLUG = "gta-6";
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const allowProd = args.has("--allow-prod");
const skipSourceCheck = args.has("--skip-source-check");
const PUBLIC_WIKI_MEDIA_BASE_URL = "https://media.bloxodes.com/wiki";

function printHelp() {
  console.log("Usage: npm run sync:gta-wiki-media [--apply] [--allow-prod] [--skip-source-check]");
  console.log("Defaults to a read-only plan. Production apply requires --allow-prod and the recognized production target.");
}

function assertNoUnknownArgs() {
  for (const arg of args) {
    if (!["--apply", "--allow-prod", "--skip-source-check", "--help", "-h"].includes(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
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

async function verifySources() {
  const urls = GTA_WIKI_MEDIA.flatMap((media) => [media.coverImage, media.heroImage]);
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
  const body = await sharp(source, { animated: true })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
  const metadata = await sharp(body).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Could not read dimensions for ${sourceUrl}.`);
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

async function prepareAllHostedMedia(): Promise<Map<string, { cover: HostedMedia; thumbnail: HostedMedia }>> {
  const prepared = new Map<string, { cover: HostedMedia; thumbnail: HostedMedia }>();
  for (const media of GTA_WIKI_MEDIA) {
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

async function requireRows() {
  const sb = supabaseAdmin();
  const [games, pages] = await Promise.all([
    sb.from("gta_games").select("slug,is_published,cover_image,hero_image").in("slug", GTA_WIKI_MEDIA.map((media) => media.slug)),
    sb.from("gta_wiki_pages").select("slug,is_published").in("slug", GTA_WIKI_MEDIA.map((media) => media.slug))
  ]);
  if (games.error) throw games.error;
  if (pages.error) throw pages.error;

  const gameMap = new Map((games.data ?? []).map((row) => [row.slug, row]));
  const pageMap = new Map((pages.data ?? []).map((row) => [row.slug, row]));
  for (const media of GTA_WIKI_MEDIA) {
    if (!gameMap.has(media.slug) || !gameMap.get(media.slug)?.is_published) {
      throw new Error(`Expected published gta_games row is missing: ${media.slug}`);
    }
    if (!pageMap.has(media.slug) || !pageMap.get(media.slug)?.is_published) {
      throw new Error(`Expected published gta_wiki_pages row is missing: ${media.slug}`);
    }
  }
}

async function applyMediaRoles(prepared: Map<string, { cover: HostedMedia; thumbnail: HostedMedia }>) {
  const sb = supabaseAdmin();
  for (const media of GTA_WIKI_MEDIA) {
    const assets = prepared.get(media.slug);
    if (!assets) throw new Error(`Missing prepared hosted media for ${media.slug}.`);
    const result = await sb
      .from("gta_games")
      .update({ cover_image: assets.cover.publicUrl, hero_image: assets.thumbnail.publicUrl })
      .eq("slug", media.slug)
      .eq("is_published", true)
      .select("slug");
    if (result.error) throw result.error;
    if ((result.data ?? []).length !== 1) throw new Error(`Could not update exactly one GTA hub: ${media.slug}`);
  }
  console.log(`Applied separate cover and thumbnail artwork to ${GTA_WIKI_MEDIA.length} GTA hubs.`);
}

async function unpublishGtaVi() {
  const sb = supabaseAdmin();
  const collections = await sb
    .from("gta_wiki_collection_pages")
    .update({ is_published: false })
    .eq("wiki_slug", GTA_VI_SLUG)
    .eq("is_published", true)
    .select("id");
  if (collections.error) throw collections.error;

  const wiki = await sb
    .from("gta_wiki_pages")
    .update({ is_published: false })
    .eq("slug", GTA_VI_SLUG)
    .eq("is_published", true)
    .select("id");
  if (wiki.error) throw wiki.error;

  const game = await sb
    .from("gta_games")
    .update({ is_published: false })
    .eq("slug", GTA_VI_SLUG)
    .eq("is_published", true)
    .select("id");
  if (game.error) throw game.error;

  console.log(`Unpublished GTA VI: ${wiki.data?.length ?? 0} hub, ${collections.data?.length ?? 0} collection pages; source rows were preserved.`);
}

async function removeStaleGtaViSearchRows() {
  const sb = supabaseAdmin();
  const existing = await sb
    .from("search_index")
    .select("id")
    .eq("entity_type", "gta_wiki")
    .eq("slug", GTA_VI_SLUG);
  if (existing.error) throw existing.error;
  if (!(existing.data ?? []).length) return;
  const deleted = await sb
    .from("search_index")
    .delete()
    .eq("entity_type", "gta_wiki")
    .eq("slug", GTA_VI_SLUG);
  if (deleted.error) throw deleted.error;
  console.log("Removed the stale GTA VI wiki search-index row.");
}

async function verifyState(prepared: Map<string, { cover: HostedMedia; thumbnail: HostedMedia }>) {
  const sb = supabaseAdmin();
  const [games, pages, view, viGame, viPage, viCollections, viSearch] = await Promise.all([
    sb.from("gta_games").select("slug,is_published,cover_image,hero_image").in("slug", GTA_WIKI_MEDIA.map((media) => media.slug)),
    sb.from("gta_wiki_pages").select("slug,is_published").in("slug", GTA_WIKI_MEDIA.map((media) => media.slug)).eq("is_published", true),
    sb.from("gta_wiki_pages_view").select("slug,is_published,game_cover_image,game_hero_image").in("slug", GTA_WIKI_MEDIA.map((media) => media.slug)).eq("is_published", true),
    sb.from("gta_games").select("is_published").eq("slug", GTA_VI_SLUG).maybeSingle(),
    sb.from("gta_wiki_pages").select("is_published").eq("slug", GTA_VI_SLUG).maybeSingle(),
    sb.from("gta_wiki_collection_pages").select("id").eq("wiki_slug", GTA_VI_SLUG).eq("is_published", true),
    sb.from("search_index").select("id").eq("entity_type", "gta_wiki").eq("slug", GTA_VI_SLUG)
  ]);
  for (const result of [games, pages, view, viGame, viPage, viCollections, viSearch]) {
    if (result.error) throw result.error;
  }

  const mediaBySlug = new Map(prepared);
  const gameRows = games.data ?? [];
  if (gameRows.length !== GTA_WIKI_MEDIA.length) throw new Error("GTA hub image verification returned the wrong game count.");
  for (const row of gameRows) {
    const expected = mediaBySlug.get(row.slug);
    if (!expected || !row.is_published || row.cover_image !== expected.cover.publicUrl || row.hero_image !== expected.thumbnail.publicUrl || row.cover_image === row.hero_image) {
      throw new Error(`GTA hub image verification failed for ${row.slug}.`);
    }
  }
  if ((pages.data ?? []).length !== GTA_WIKI_MEDIA.length || (view.data ?? []).length !== GTA_WIKI_MEDIA.length) {
    throw new Error("GTA wiki publication verification returned the wrong retained hub count.");
  }
  if (viGame.data?.is_published || viPage.data?.is_published || (viCollections.data ?? []).length || (viSearch.data ?? []).length) {
    throw new Error("GTA VI is still visible in one or more publication surfaces.");
  }
  console.log(`Verified ${GTA_WIKI_MEDIA.length} retained published GTA hubs with distinct cover/thumbnail roles.`);
  console.log("Verified retained hub images use Bloxodes-hosted wiki media URLs.");
  console.log("Verified GTA VI is unpublished from game, wiki, collection, and search surfaces.");
}

async function main() {
  assertNoUnknownArgs();
  if (args.has("--help") || args.has("-h")) {
    printHelp();
    return;
  }
  if (!skipSourceCheck) await verifySources();
  await requireRows();
  if (!apply) {
    console.log(`Dry run only: ${GTA_WIKI_MEDIA.length} retained GTA hubs would receive media roles, and GTA VI would be unpublished.`);
    return;
  }
  const managed = isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL);
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (!managed && !production) throw new Error("Unrecognized Supabase target.");
  if (allowProd && (!apply || !production)) throw new Error("--allow-prod requires --apply and the recognized production target.");
  if (apply && production && !allowProd) throw new Error("Production GTA wiki media writes require --allow-prod.");
  const r2 = new R2Client(loadR2ClientConfig(process.env));
  const prepared = await prepareAllHostedMedia();
  await uploadHostedMedia(prepared, r2);
  await applyMediaRoles(prepared);
  await unpublishGtaVi();
  await removeStaleGtaViSearchRows();
  await verifyState(prepared);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
