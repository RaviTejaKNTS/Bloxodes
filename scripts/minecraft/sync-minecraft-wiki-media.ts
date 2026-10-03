import "../shared/load-env";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { loadR2ClientConfig, R2Client } from "../shared/r2-client";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type HubMediaManifest = {
  parentReview: { approved: boolean; approvedAt: string };
  gameFile: string;
  wikiFile: string;
  images: Array<{ role: "cover" | "hero"; file: string; sha256: string; sourceUrls: string[]; sourceAssets: string[]; processing: string }>;
};

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const marker = args.indexOf("--manifest");
  if (marker < 0 || !args[marker + 1]) throw new Error("Pass --manifest <reviewed hub media manifest>. Dry-run is the default.");
  if (args.some((value, index) => value !== "--apply" && value !== "--manifest" && index !== marker + 1)) throw new Error("Unknown argument.");
  const manifestPath = path.resolve(args[marker + 1]);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as HubMediaManifest;
  if (manifest.images.length !== 2 || new Set(manifest.images.map(image => image.role)).size !== 2) throw new Error("The hub requires distinct cover and hero images.");
  const prepared = [];
  for (const image of manifest.images) {
    if (!image.sourceUrls.length || !image.sourceAssets.length || !image.processing) throw new Error(`Missing source record for ${image.role}.`);
    const sourcePath = path.resolve(path.dirname(manifestPath), image.file);
    const bytes = await fs.readFile(sourcePath);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== image.sha256) throw new Error(`Reviewed ${image.role} bytes changed.`);
    const metadata = await sharp(bytes).metadata();
    if (metadata.format !== "webp" || !metadata.width || !metadata.height) throw new Error(`Invalid ${image.role} image.`);
    if (image.role === "cover" && (metadata.width < 1200 || metadata.width / metadata.height < 1.6)) throw new Error("Cover requires a landscape image of at least 1200 pixels.");
    if (image.role === "hero" && metadata.width !== metadata.height) throw new Error("Hero must be square.");
    const key = `minecraft/minecraft/hub/${hash}/${image.role}.webp`;
    prepared.push({ ...image, bytes, key, url: `https://media.bloxodes.com/wiki/${key}`, width: metadata.width, height: metadata.height });
  }
  if (prepared[0].sha256 === prepared[1].sha256) throw new Error("Cover and hero must contain distinct image bytes.");
  console.log(JSON.stringify({ apply, images: prepared.map(({ role, key, url, width, height }) => ({ role, key, url, width, height })) }, null, 2));
  if (!apply) return;
  if (!isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) throw new Error("Minecraft authoring media apply requires the managed-development target.");
  if (!manifest.parentReview?.approved || !manifest.parentReview.approvedAt) throw new Error("The parent must approve these exact image bytes before upload.");
  const r2 = new R2Client(loadR2ClientConfig());
  for (const image of prepared) {
    if (!await r2.hasObject(image.key)) await r2.putObject({ key: image.key, body: image.bytes, contentType: "image/webp", metadata: { sha256: image.sha256 } });
    const response = await fetch(image.url);
    if (!response.ok) throw new Error(`Hosted ${image.role} returned ${response.status}.`);
    const hosted = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(hosted).digest("hex") !== image.sha256) throw new Error(`Hosted ${image.role} bytes do not match.`);
  }
  const files = [path.resolve(path.dirname(manifestPath), manifest.gameFile), path.resolve(path.dirname(manifestPath), manifest.wikiFile)];
  const cover = prepared.find(image => image.role === "cover")!.url;
  const hero = prepared.find(image => image.role === "hero")!.url;
  const game = JSON.parse(await fs.readFile(files[0], "utf8"));
  const wiki = JSON.parse(await fs.readFile(files[1], "utf8"));
  game.cover_image = cover;
  game.hero_image = hero;
  wiki.cover_image = cover;
  await fs.writeFile(files[0], `${JSON.stringify(game, null, 2)}\n`);
  await fs.writeFile(files[1], `${JSON.stringify(wiki, null, 2)}\n`);
  await fs.writeFile(path.join(path.dirname(manifestPath), "hub-media-receipt.json"), `${JSON.stringify({ uploadedAt: new Date().toISOString(), images: prepared.map(({ role, url, sha256 }) => ({ role, url, sha256 })), files }, null, 2)}\n`);
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
