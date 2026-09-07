import "../shared/load-env";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadR2ClientConfig, R2Client } from "../shared/r2-client";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type Namespace = "red-dead";
type MediaRole = "cover" | "hero";

type FranchiseWikiMedia = {
  slug: string;
  coverImage: string;
  heroImage: string;
  sourcePage: string;
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

type NamespaceConfig = {
  label: string;
  gameTable: string;
  pageTable: string;
  viewTable: string;
  mediaPrefix: string;
};

const NAMESPACE_CONFIG: Record<Namespace, NamespaceConfig> = {
  "red-dead": {
    label: "Red Dead",
    gameTable: "red_dead_games",
    pageTable: "red_dead_wiki_pages",
    viewTable: "red_dead_wiki_pages_view",
    mediaPrefix: "red-dead"
  }
};

/**
 * Reviewed title artwork for the Red Dead wiki hubs currently in scope.
 *
 * Use landscape artwork/screenshots for full-bleed card covers and distinct
 * artwork for square title thumbnails. Never pad portrait box art into a
 * landscape canvas. Runtime pages only use the hosted
 * copies, never the source-site URLs.
 */
export const RED_DEAD_WIKI_MEDIA: readonly FranchiseWikiMedia[] = [
  {
    slug: "red-dead-online",
    coverImage: "https://www.ireddead.com/content/images/large/red-dead-online-specialist-roles.jpg",
    heroImage: "https://www.ireddead.com/content/images/large/red-dead-online-logo-square.png",
    sourcePage: "https://www.ireddead.com/reddeadonline/images/red-dead-online-logo-square"
  },
  {
    slug: "red-dead-redemption",
    coverImage: "https://www.ireddead.com/content/images/large/john-marston-artwork-155.jpg",
    heroImage: "https://www.ireddead.com/content/images/large/red-dead-redemption-box-art-1280x1580.jpg",
    sourcePage: "https://www.ireddead.com/rdr/images/john-marston-artwork-155"
  },
  {
    slug: "red-dead-redemption-2",
    coverImage: "https://www.ireddead.com/content/images/large/arthur-morgan-1473.jpg",
    heroImage: "https://www.ireddead.com/content/images/large/red-dead-redemption-2-box-art-1280x1580.jpg",
    sourcePage: "https://www.ireddead.com/rdr2/images/arthur-morgan-1473"
  },
  {
    slug: "red-dead-revolver",
    coverImage: "https://www.ireddead.com/content/images/large/red-dead-revolver-ps4-screenshot-5.jpg",
    heroImage: "https://www.ireddead.com/content/images/large/red-dead-revolver-logo.png",
    sourcePage: "https://www.ireddead.com/reddeadrevolver/images/red-dead-revolver-logo"
  },
  {
    slug: "undead-nightmare",
    coverImage: "https://www.ireddead.com/content/images/large/undead-nightmare-john-marston-698.jpg",
    heroImage: "https://www.ireddead.com/content/images/large/red-dead-redemption-undead-nightmare-box-art-1280x1580.jpg",
    sourcePage: "https://www.ireddead.com/undeadnightmare/images/undead-nightmare-john-marston-698"
  }
];

const MEDIA_BY_NAMESPACE: Record<Namespace, readonly FranchiseWikiMedia[]> = {
  "red-dead": RED_DEAD_WIKI_MEDIA
};

const PUBLIC_WIKI_MEDIA_BASE_URL = "https://media.bloxodes.com/wiki";
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const skipSourceCheck = argv.includes("--skip-source-check");
const namespace = value("--namespace") as Namespace | "";

function value(flag: string): string {
  const index = argv.indexOf(flag);
  return index === -1 ? "" : (argv[index + 1] ?? "").trim();
}

function printHelp() {
  console.log("Usage: npm run sync:franchise-wiki-media -- --namespace <red-dead> [--apply] [--skip-source-check]");
  console.log("Defaults to a read-only plan. --apply downloads, hosts, and points franchise wiki hubs at Bloxodes media; writes are restricted to managed development.");
}

function assertNoUnknownArgs() {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--namespace") {
      index += 1;
      continue;
    }
    if (!["--apply", "--skip-source-check", "--help", "-h"].includes(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (argv.includes("--namespace") && !namespace) throw new Error("--namespace requires a value.");
}

function getConfig(): NamespaceConfig {
  if (!namespace || !(namespace in NAMESPACE_CONFIG)) {
    throw new Error("--namespace must be red-dead.");
  }
  return NAMESPACE_CONFIG[namespace];
}

function getMedia(): readonly FranchiseWikiMedia[] {
  return MEDIA_BY_NAMESPACE[namespace];
}

async function fetchSource(url: string): Promise<Response> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
    headers: { "user-agent": "Bloxodes wiki media verifier/1.0" }
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) throw new Error(`${url} returned non-image content type ${contentType || "unknown"}.`);
  return response;
}

async function verifySourceUrl(url: string): Promise<void> {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
    headers: { "user-agent": "Bloxodes wiki media verifier/1.0" }
  });
  if (response.ok) {
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType || contentType.startsWith("image/")) return;
  }
  await fetchSource(url);
}

async function verifySources(media: readonly FranchiseWikiMedia[]) {
  const urls = [...new Set(media.flatMap((entry) => [entry.coverImage, entry.heroImage]))];
  for (let index = 0; index < urls.length; index += 8) {
    await Promise.all(urls.slice(index, index + 8).map(verifySourceUrl));
  }
  console.log(`Verified ${urls.length} ${NAMESPACE_CONFIG[namespace].label} wiki source image URL${urls.length === 1 ? "" : "s"}.`);
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function prepareHostedMedia(slug: string, role: MediaRole, sourceUrl: string): Promise<HostedMedia> {
  const response = await fetchSource(sourceUrl);
  const source = Buffer.from(await response.arrayBuffer());
  const pipeline = sharp(source, { animated: true }).rotate();
  const sourceMetadata = await sharp(source).metadata();
  if (role === "cover" && (!sourceMetadata.width || !sourceMetadata.height || sourceMetadata.width / sourceMetadata.height < 1.5)) {
    throw new Error(`Cover must use landscape source artwork: ${sourceUrl}`);
  }
  const body = role === "cover"
    ? await pipeline
        .resize({
          width: 1600,
          height: 900,
          fit: "cover"
        })
        .webp({ quality: 88 })
        .toBuffer()
    : await pipeline
        .resize({ width: 720, height: 720, fit: "cover" })
        .webp({ quality: 88 })
        .toBuffer();
  const metadata = await sharp(body).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Could not read dimensions for ${sourceUrl}.`);
  const digest = sha256(body);
  const key = `${NAMESPACE_CONFIG[namespace].mediaPrefix}/${slug}/hub-${role}-${digest.slice(0, 16)}.webp`;
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

async function prepareAllHostedMedia(media: readonly FranchiseWikiMedia[]) {
  const prepared = new Map<string, { cover: HostedMedia; hero: HostedMedia }>();
  for (const entry of media) {
    const cover = await prepareHostedMedia(entry.slug, "cover", entry.coverImage);
    const hero = await prepareHostedMedia(entry.slug, "hero", entry.heroImage);
    prepared.set(entry.slug, { cover, hero });
    console.log(`Prepared ${entry.slug}: cover ${cover.width}x${cover.height}, hero ${hero.width}x${hero.height}.`);
  }
  return prepared;
}

async function uploadHostedMedia(
  prepared: Map<string, { cover: HostedMedia; hero: HostedMedia }>,
  r2: R2Client
) {
  for (const assets of prepared.values()) {
    for (const asset of [assets.cover, assets.hero]) {
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
  console.log(`Verified ${prepared.size * 2} hosted ${NAMESPACE_CONFIG[namespace].label} wiki media objects in R2.`);
}

async function requireRows(config: NamespaceConfig, media: readonly FranchiseWikiMedia[]) {
  const sb = supabaseAdmin();
  const slugs = media.map((entry) => entry.slug);
  const [games, pages] = await Promise.all([
    sb.from(config.gameTable).select("slug,is_published,cover_image,hero_image").in("slug", slugs),
    sb.from(config.pageTable).select("slug,is_published").in("slug", slugs)
  ]);
  if (games.error) throw games.error;
  if (pages.error) throw pages.error;

  const gameMap = new Map((games.data ?? []).map((row) => [row.slug, row]));
  const pageMap = new Map((pages.data ?? []).map((row) => [row.slug, row]));
  for (const entry of media) {
    if (!gameMap.has(entry.slug) || !gameMap.get(entry.slug)?.is_published) {
      throw new Error(`Expected published ${config.gameTable} row is missing: ${entry.slug}`);
    }
    if (!pageMap.has(entry.slug) || !pageMap.get(entry.slug)?.is_published) {
      throw new Error(`Expected published ${config.pageTable} row is missing: ${entry.slug}`);
    }
  }
}

async function applyMediaRoles(config: NamespaceConfig, media: readonly FranchiseWikiMedia[], prepared: Map<string, { cover: HostedMedia; hero: HostedMedia }>) {
  const sb = supabaseAdmin();
  for (const entry of media) {
    const assets = prepared.get(entry.slug);
    if (!assets) throw new Error(`Missing prepared hosted media for ${entry.slug}.`);
    const result = await sb
      .from(config.gameTable)
      .update({ cover_image: assets.cover.publicUrl, hero_image: assets.hero.publicUrl })
      .eq("slug", entry.slug)
      .eq("is_published", true)
      .select("slug");
    if (result.error) throw result.error;
    if ((result.data ?? []).length !== 1) throw new Error(`Could not update exactly one ${config.label} hub: ${entry.slug}`);
  }
  console.log(`Applied separate cover and square hero artwork to ${media.length} ${config.label} hubs.`);
}

async function verifyState(config: NamespaceConfig, media: readonly FranchiseWikiMedia[], prepared: Map<string, { cover: HostedMedia; hero: HostedMedia }>) {
  const sb = supabaseAdmin();
  const slugs = media.map((entry) => entry.slug);
  const [games, pages, view] = await Promise.all([
    sb.from(config.gameTable).select("slug,is_published,cover_image,hero_image").in("slug", slugs),
    sb.from(config.pageTable).select("slug,is_published").in("slug", slugs).eq("is_published", true),
    sb.from(config.viewTable).select("slug,is_published,game_cover_image,game_hero_image").in("slug", slugs).eq("is_published", true)
  ]);
  for (const result of [games, pages, view]) {
    if (result.error) throw result.error;
  }

  const expectedBySlug = new Map(prepared);
  if ((games.data ?? []).length !== media.length || (pages.data ?? []).length !== media.length || (view.data ?? []).length !== media.length) {
    throw new Error(`Published ${config.label} image verification returned the wrong hub count.`);
  }
  for (const row of games.data ?? []) {
    const expected = expectedBySlug.get(row.slug);
    if (!expected || !row.is_published || row.cover_image !== expected.cover.publicUrl || row.hero_image !== expected.hero.publicUrl || row.cover_image === row.hero_image) {
      throw new Error(`${config.label} hub image verification failed for ${row.slug}.`);
    }
  }
  for (const row of view.data ?? []) {
    const expected = expectedBySlug.get(row.slug);
    if (!expected || row.game_cover_image !== expected.cover.publicUrl || row.game_hero_image !== expected.hero.publicUrl) {
      throw new Error(`${config.label} wiki view image verification failed for ${row.slug}.`);
    }
  }
  console.log(`Verified ${media.length} published ${config.label} hubs with distinct hosted cover and square hero roles.`);
}

async function main() {
  assertNoUnknownArgs();
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }
  const config = getConfig();
  const media = getMedia();
  if (!skipSourceCheck) await verifySources(media);
  await requireRows(config, media);
  if (!apply) {
    console.log(`Dry run only: ${media.length} ${config.label} hubs would receive hosted cover and square hero artwork.`);
    return;
  }
  if (!isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error(`Refusing to write ${config.label} wiki media outside managed development.`);
  }
  const r2 = new R2Client(loadR2ClientConfig(process.env));
  const prepared = await prepareAllHostedMedia(media);
  await uploadHostedMedia(prepared, r2);
  await applyMediaRoles(config, media, prepared);
  await verifyState(config, media, prepared);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
