import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "Grow a Garden 2");
const PUBLIC_DIR = path.join(ROOT, "apps", "web", "public", "Grow a Garden 2");

const SOURCES = {
  plants: "https://beebom.com/grow-a-garden-2-plants-and-seeds/",
  pets: "https://beebom.com/grow-a-garden-2-pets/",
  gears: "https://beebom.com/grow-a-garden-gear-shop-guide/",
  sprinklers: "https://beebom.com/grow-a-garden-2-sprinklers/",
  crates: "https://beebom.com/grow-a-garden-2-crates/",
  mutations: "https://beebom.com/grow-a-garden-2-mutations/",
  guilds: "https://beebom.com/grow-a-garden-2-guilds-guide/"
};

const COLLECTIONS = [
  { file: "seeds.json", folder: "Crops", source: "plants" },
  { file: "crops.json", folder: "Crops", source: "plants" },
  { file: "pets.json", folder: "Pets", source: "pets" },
  { file: "gears.json", folder: "Gears", source: "gears" },
  { file: "sprinklers.json", folder: "Sprinklers", source: "sprinklers" },
  { file: "crates.json", folder: "Crates", source: "crates" },
  { file: "mutations.json", folder: "Mutations", source: "mutations" }
];

const SHOP_IMAGE_BY_ID = {
  "seed-shop": { folder: "Crops", name: "Carrot" },
  "gears-shop": { folder: "Gears", name: "Common Watering Can" },
  "props-shop": { folder: "Crates", name: "Ladder Crate" },
  "lobby-pet-spawns": { folder: "Pets", name: "Frog" },
  "guilds-counter": { folder: "Shops", source: "guilds", name: "Guilds Counter" }
};

const NIGHT_IMAGE_BY_ID = {
  raccoon: { folder: "Pets", name: "Raccoon" },
  owl: { folder: "Pets", name: "Owl" },
  bee: { folder: "Pets", name: "Bee" },
  "black-dragon": { folder: "Pets", name: "Black Dragon" },
  "ice-serpent": { folder: "Pets", name: "Ice Serpent" },
  lantern: { folder: "Gears", name: "Lantern" },
  gnome: { folder: "Gears", name: "Gnome" },
  flashbang: { folder: "Gears", name: "Flashbang" },
  "invisibility-mushroom": { folder: "Gears", name: "Invisibility Mushroom" },
  teleporter: { folder: "Gears", name: "Teleporter" },
  "owner-door-crate": { folder: "Crates", name: "Owner Door Crate" },
  "bear-trap-crate": { folder: "Crates", name: "Bear Trap Crate" },
  "fence-crate": { folder: "Crates", name: "Fence Crate" }
};

function stripTags(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return value
    .replace(/&#8217;/g, "'")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function normalizeName(value) {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeName(value).replace(/\s+/g, "-");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
    }
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

function extractImagesByName(html) {
  const map = new Map();
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const imageMatch = row.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (!imageMatch) continue;
    const cells = row.match(/<td[\s\S]*?<\/td>/gi) ?? [];
    if (!cells.length) continue;
    const firstCell = cells[0];
    const imageUrl = decodeHtml(imageMatch[1]);
    const nameText = decodeHtml(stripTags(firstCell));
    const candidates = [
      nameText,
      nameText.replace(/^[-–—]\s*/, ""),
      firstCell.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1],
      firstCell.match(/<br\s*\/?>([\s\S]*?)<\/td>/i)?.[1]
    ]
      .filter(Boolean)
      .map((value) => stripTags(decodeHtml(String(value))));
    for (const candidate of candidates) {
      const key = normalizeName(candidate);
      if (key && !map.has(key)) map.set(key, imageUrl);
    }
  }
  return map;
}

function extractHeroImage(html) {
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']([^"']+)["']/i);
  return match ? decodeHtml(match[1]) : null;
}

async function downloadImage(sourceUrl, folder, name) {
  if (!sourceUrl) return null;
  const outputDir = path.join(PUBLIC_DIR, folder);
  await fs.mkdir(outputDir, { recursive: true });
  const outputName = `${slugify(name)}.webp`;
  const outputPath = path.join(outputDir, outputName);
  const response = await fetch(sourceUrl, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      referer: "https://beebom.com/"
    }
  });
  if (!response.ok) {
    console.warn(`WARN failed image ${name}: ${response.status} ${sourceUrl}`);
    return null;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await sharp(buffer, { animated: false })
    .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(outputPath);
  return `/Grow%20a%20Garden%202/${encodeURIComponent(folder)}/${encodeURIComponent(outputName)}`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf8"));
}

async function writeJson(file, data) {
  await fs.writeFile(path.join(DATA_DIR, file), `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  const htmlBySource = new Map();
  const imageMaps = new Map();
  const localImageByFolderAndName = new Map();

  for (const [key, url] of Object.entries(SOURCES)) {
    const html = await fetchText(url);
    htmlBySource.set(key, html);
    imageMaps.set(key, extractImagesByName(html));
  }

  for (const collection of COLLECTIONS) {
    const data = await readJson(collection.file);
    const map = imageMaps.get(collection.source);
    let matched = 0;
    for (const item of data.items) {
      const sourceUrl = map.get(normalizeName(item.name));
      if (!sourceUrl) continue;
      const image = await downloadImage(sourceUrl, collection.folder, item.name);
      if (!image) continue;
      item.image = image;
      item.sourceImageUrl = sourceUrl;
      localImageByFolderAndName.set(`${collection.folder}:${normalizeName(item.name)}`, image);
      matched += 1;
    }
    await writeJson(collection.file, data);
    console.log(`${collection.file}: ${matched}/${data.items.length} images`);
  }

  const shops = await readJson("shops.json");
  const guildHero = extractHeroImage(htmlBySource.get("guilds") ?? "");
  for (const item of shops.items) {
    const rule = SHOP_IMAGE_BY_ID[item.id];
    if (!rule) continue;
    let image = localImageByFolderAndName.get(`${rule.folder}:${normalizeName(rule.name)}`) ?? null;
    let sourceImageUrl = null;
    if (!image && rule.source === "guilds") {
      image = await downloadImage(guildHero, rule.folder, rule.name);
      sourceImageUrl = guildHero;
    }
    if (image) {
      item.image = image;
      if (sourceImageUrl) item.sourceImageUrl = sourceImageUrl;
    }
  }
  await writeJson("shops.json", shops);

  const night = await readJson("night-stealing.json");
  for (const item of night.items) {
    const rule = NIGHT_IMAGE_BY_ID[item.id];
    if (!rule) continue;
    const image = localImageByFolderAndName.get(`${rule.folder}:${normalizeName(rule.name)}`) ?? null;
    if (image) item.image = image;
  }
  await writeJson("night-stealing.json", night);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
