import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as cheerio from "cheerio";

type DatasetRecord = Record<string, unknown>;

type DatasetFileConfig = {
  file: string;
  folder: string;
  pageTitles?: string[];
  allowCrossCategoryLocal?: boolean;
  candidateTitles?: (item: DatasetRecord) => string[];
  nameField?: "name" | "item";
};

type DatasetDocument = {
  meta?: {
    columns?: string[];
    [key: string]: unknown;
  };
  items: DatasetRecord[];
};

type AllImagesEntry = {
  name?: string;
  url?: string;
};

const USER_AGENT = "Mozilla/5.0";
const REPO_ROOT = process.cwd();
const DATA_DIR = path.join(REPO_ROOT, "data", "Grow a Garden");
const PUBLIC_ROOT = path.join(REPO_ROOT, "public", "Grow a Garden");
const FANDOM_API = "https://growagarden.fandom.com/api.php";

const FILE_PREFIX_OVERRIDES: Record<string, Record<string, string[]>> = {
  "weather.json": {
    "Albert Laser": ["Albert_Laser", "Albert_laser"],
    "DJ Onett": ["DJ_Onett", "Onett_DJ"],
    "Falling Flamingo": ["Flamingo_Admin_Abuse"],
    "Monster Mash": ["Monster_Mash_Event"],
    "Sheckle Rain": ["Sheckle_Rain", "Shecklerain"],
    "Travis Kelce Restock": ["Travis_KelcexGaG"]
  }
};

const EXTERNAL_IMAGE_OVERRIDES: Record<string, string> = {
  "pets.json::Rainbow Giraffe":
    "https://static.tradekitsune.com/product/pets/Rainbow%20Giraffe_1763111809051_Kpm8Du3pCG.png",
  "pets.json::Rainbow Rhino":
    "https://static.tradekitsune.com/product/pets/Rainbow%20Rhino_1763112202635_GsSrShKLrS.png"
};

const DATASET_CONFIGS: DatasetFileConfig[] = [
  {
    file: "crops.json",
    folder: "Crops",
    pageTitles: ["Crops"],
    allowCrossCategoryLocal: true,
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "seeds.json",
    folder: "Seeds",
    pageTitles: ["Seed_Shop"],
    allowCrossCategoryLocal: true,
    candidateTitles: (item) => [getText(item.crop), getText(item.seedName), getName(item)]
  },
  {
    file: "pets.json",
    folder: "Pets",
    pageTitles: ["Pets"],
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "eggs.json",
    folder: "Eggs",
    pageTitles: ["Eggs"],
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "gears.json",
    folder: "Gears",
    pageTitles: ["Gears"],
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "crop-mutations.json",
    folder: "Crop Mutations",
    pageTitles: ["Crop_Mutations"],
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "pet-mutations.json",
    folder: "Pet Mutations",
    pageTitles: ["Pet_Mutations"],
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "weather.json",
    folder: "Weather",
    pageTitles: ["Weather"],
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "merchants.json",
    folder: "Merchants",
    pageTitles: ["Merchants"],
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "npcs.json",
    folder: "NPCs",
    pageTitles: ["NPCs"],
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "shops.json",
    folder: "Shops",
    pageTitles: ["Seed_Shop", "Gear_Shop", "Pet_Eggs", "Cosmetics_Shop", "Limited_Time_Shop"],
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "seed-packs.json",
    folder: "Seed Packs",
    pageTitles: ["Category:Packs"],
    allowCrossCategoryLocal: true,
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "crafting-recipes.json",
    folder: "Crafting Recipes",
    pageTitles: ["Crafting"],
    allowCrossCategoryLocal: true,
    nameField: "item",
    candidateTitles: (item) => buildCraftingCandidates(getText(item.item))
  },
  {
    file: "food.json",
    folder: "Food",
    pageTitles: ["Food"],
    allowCrossCategoryLocal: true,
    candidateTitles: (item) => [getName(item)]
  },
  {
    file: "currencies.json",
    folder: "Currencies",
    pageTitles: ["Mechanics", "Sheckles", "Garden_Coins"],
    candidateTitles: (item) => [getName(item)]
  }
];

function getText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function getName(item: DatasetRecord, field: "name" | "item" = "name"): string {
  const primary = getText(item[field]);
  if (primary) return primary;
  return getText(item.name) || getText(item.item);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/×/g, "x")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildWordRegex(value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function curlText(url: string): string {
  return execFileSync("curl", ["-L", "-A", USER_AGENT, "--fail", "--silent", "--show-error", url], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
}

function curlDownload(url: string, outputPath: string) {
  ensureDir(path.dirname(outputPath));
  execFileSync("curl", ["-L", "-A", USER_AGENT, "--fail", "--silent", "--show-error", "-o", outputPath, url], {
    stdio: "pipe"
  });
}

function fetchJson<T>(url: string): T {
  return JSON.parse(curlText(url)) as T;
}

function buildApiUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `${FANDOM_API}?${search.toString()}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function canonicalizeImageUrl(value: string): string | null {
  if (!value) return null;
  let url = decodeHtmlEntities(value.trim());
  if (!url || url.startsWith("data:image")) return null;
  if (url.startsWith("//")) url = `https:${url}`;
  if (!/^https?:\/\//i.test(url)) return null;
  if (url.includes("Special:Upload")) return null;
  url = url.replace(/\/scale-to-width-down\/\d+/i, "");
  return url;
}

function isIgnoredImageName(value: string | undefined): boolean {
  const normalized = normalizeForMatch(value ?? "");
  return [
    "sheckle png",
    "robux 2019 logo black png",
    "trade token png",
    "honey png",
    "summer coin png",
    "flowerscurrency png",
    "gavel png",
    "commonicon png",
    "uncommonicon png",
    "rareicon png",
    "legendaryicon png",
    "mythicalicon png",
    "divineicon png",
    "prismaticicon png",
    "transcendenticon png"
  ].includes(normalized);
}

function scoreImageCandidate(candidate: { url: string; width: number; imageName?: string }) {
  if (isIgnoredImageName(candidate.imageName)) return -1;
  let score = 0;
  if (candidate.url.includes("static.wikia.nocookie.net")) score += 30;
  if (candidate.url.includes("files.9xbuddies.org")) score += 20;
  score += Math.min(candidate.width, 400);
  return score;
}

function pickBestImage($scope: cheerio.Cheerio<any>): string | null {
  const candidates: Array<{ url: string; width: number; imageName?: string }> = [];
  $scope.find("img").each((_, element) => {
    const attrs = (element as { attribs?: Record<string, string> }).attribs ?? {};
    const raw = attrs["data-src"] || attrs.src;
    const url = canonicalizeImageUrl(raw ?? "");
    if (!url) return;
    const width = Number.parseInt(attrs.width ?? "0", 10) || Number.parseInt(attrs["data-image-width"] ?? "0", 10) || 0;
    candidates.push({
      url,
      width,
      imageName: attrs["data-image-name"] ?? undefined
    });
  });

  candidates.sort((left, right) => scoreImageCandidate(right) - scoreImageCandidate(left));
  const best = candidates.find((entry) => scoreImageCandidate(entry) >= 0);
  return best?.url ?? null;
}

function buildRegexMap(names: string[]) {
  const normalizedEntries = names
    .map((name) => ({ raw: name, normalized: normalizeForMatch(name) }))
    .filter((entry) => entry.normalized.length > 0)
    .sort((left, right) => right.normalized.length - left.normalized.length);

  return normalizedEntries.map((entry) => ({
    ...entry,
    regex: buildWordRegex(entry.normalized)
  }));
}

function buildPageMatchMap(pageTitle: string, names: string[]): Map<string, string> {
  const url = buildApiUrl({
    action: "parse",
    page: pageTitle,
    prop: "text",
    format: "json",
    formatversion: "2"
  });
  const parsed = fetchJson<{ parse?: { text?: string } }>(url);
  const html = parsed.parse?.text ?? "";
  if (!html) return new Map();

  const $ = cheerio.load(html);
  const regexEntries = buildRegexMap(names);
  const map = new Map<string, string>();

  $("tr, li, .category-page__member").each((_, element) => {
    const $element = $(element);
    const image = pickBestImage($element);
    if (!image) return;
    const text = normalizeForMatch($element.text());
    if (!text) return;

    const titleValues = new Set<string>();
    $element.find("a[title], b, strong").each((__, child) => {
      const rawTitle = $(child).attr("title") || $(child).text();
      const normalized = normalizeForMatch(rawTitle);
      if (normalized) titleValues.add(normalized);
    });

    for (const entry of regexEntries) {
      if (map.has(entry.raw)) continue;
      if (titleValues.has(entry.normalized) || entry.regex.test(text)) {
        map.set(entry.raw, image);
      }
    }
  });

  return map;
}

function buildPageImageMap(titles: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(titles.filter(Boolean)));
  for (let index = 0; index < unique.length; index += 20) {
    const batch = unique.slice(index, index + 20);
    const url = buildApiUrl({
      action: "query",
      format: "json",
      prop: "pageimages",
      pithumbsize: "400",
      redirects: "1",
      titles: batch.join("|")
    });

    const response = fetchJson<{
      query?: {
        pages?: Record<string, { title?: string; thumbnail?: { source?: string } }>;
      };
    }>(url);

    for (const page of Object.values(response.query?.pages ?? {})) {
      const title = getText(page.title);
      const image = canonicalizeImageUrl(page.thumbnail?.source ?? "");
      if (title && image) {
        map.set(title, image);
      }
    }
  }

  return map;
}

const allImagesCache = new Map<string, AllImagesEntry[]>();

function listAllImages(prefix: string): AllImagesEntry[] {
  const cacheKey = prefix.trim();
  if (!cacheKey) return [];
  const cached = allImagesCache.get(cacheKey);
  if (cached) return cached;

  const url = buildApiUrl({
    action: "query",
    format: "json",
    list: "allimages",
    aiprefix: cacheKey,
    ailimit: "20"
  });

  const response = fetchJson<{ query?: { allimages?: AllImagesEntry[] } }>(url);
  const entries = response.query?.allimages ?? [];
  allImagesCache.set(cacheKey, entries);
  return entries;
}

function searchPageTitle(query: string): string | null {
  const url = buildApiUrl({
    action: "opensearch",
    format: "json",
    search: query,
    limit: "10"
  });

  const response = fetchJson<[string, string[], string[], string[]]>(url);
  const results = response[1] ?? [];
  const queryNormalized = normalizeForMatch(query);

  for (const title of results) {
    const normalizedTitle = normalizeForMatch(title);
    if (!normalizedTitle) continue;
    if (normalizedTitle === queryNormalized) return title;
    if (normalizedTitle.includes(queryNormalized) || queryNormalized.includes(normalizedTitle)) {
      return title;
    }
  }

  return null;
}

function buildFarmPetMap(): Map<string, string> {
  const html = curlText("https://grow-a-garden.farm/pets");
  const matches = [
    ...(html.match(/https:\/\/files\.9xbuddies\.org\/pet-webp\/[^"'\\s>]+\.webp/g) ?? []),
    ...(html.match(/https:\/\/static\.wikia\.nocookie\.net\/growagarden\/images\/[^"'\\s>]+\.(?:png|webp|jpg|jpeg)/g) ?? [])
  ];
  const map = new Map<string, string>();
  for (const match of matches) {
    const rawName = decodeURIComponent(path.basename(match, path.extname(match)));
    const normalized = normalizeForMatch(
      rawName
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    );
    if (normalized) {
      map.set(normalized, match.replace(/\\$/, ""));
    }
  }
  return map;
}

function fileExtFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".webp" || ext === ".svg") {
    return ext;
  }
  return ".png";
}

function encodeWebPath(...parts: string[]): string {
  return `/${parts.map((part) => part.replace(/ /g, "%20")).join("/")}`;
}

function scanLocalImageIndex() {
  const byFolderSlug = new Map<string, Map<string, string>>();
  const byAnySlug = new Map<string, string>();

  if (!fs.existsSync(PUBLIC_ROOT)) {
    return { byFolderSlug, byAnySlug };
  }

  const folders = fs.readdirSync(PUBLIC_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const folderEntry of folders) {
    const folderName = folderEntry.name;
    const folderPath = path.join(PUBLIC_ROOT, folderName);
    const map = new Map<string, string>();
    for (const file of fs.readdirSync(folderPath, { withFileTypes: true })) {
      if (!file.isFile()) continue;
      const slug = path.basename(file.name, path.extname(file.name));
      const webPath = encodeWebPath("Grow a Garden", folderName, file.name);
      map.set(slug, webPath);
      if (!byAnySlug.has(slug)) {
        byAnySlug.set(slug, webPath);
      }
    }
    byFolderSlug.set(folderName, map);
  }

  return { byFolderSlug, byAnySlug };
}

function buildCraftingCandidates(itemName: string): string[] {
  const value = itemName.replace(/×\s*\d+$/i, "").trim();
  const noSeed = value.replace(/\s+Seed$/i, "").trim();
  return Array.from(new Set([value, noSeed].filter(Boolean)));
}

function compactFilePrefix(value: string): string {
  return value.replace(/[’]/g, "'").replace(/[^A-Za-z0-9']/g, "");
}

function compactMatchKey(value: string): string {
  return value.replace(/[’']/g, "").replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
}

function buildFilePrefixCandidates(displayName: string) {
  const values = new Set<string>();
  const trimmed = displayName.trim();
  const apostropheNormalized = trimmed.replace(/[’]/g, "'");
  const giantTitleCase = apostropheNormalized.replace(/\bGIANT\b/g, "Giant");

  for (const candidate of [trimmed, apostropheNormalized, giantTitleCase]) {
    const compact = compactFilePrefix(candidate);
    if (compact) values.add(compact);
    const withoutApostrophes = compact.replace(/'/g, "");
    if (withoutApostrophes) values.add(withoutApostrophes);
  }

  return [...values];
}

function resolveFileImage(config: DatasetFileConfig, displayName: string): string | null {
  const target = compactMatchKey(displayName);
  const overridePrefixes = FILE_PREFIX_OVERRIDES[config.file]?.[displayName] ?? [];
  const overridePrefixSet = new Set(overridePrefixes);
  const prefixes = [...new Set([...overridePrefixes, ...buildFilePrefixCandidates(displayName)])];

  for (const prefix of prefixes) {
    const entries = listAllImages(prefix);
    if (overridePrefixSet.has(prefix)) {
      const overrideImage = entries
        .map((entry) => canonicalizeImageUrl(getText(entry.url)))
        .find((entry): entry is string => Boolean(entry));
      if (overrideImage) return overrideImage;
    }

    for (const entry of entries) {
      const fileName = getText(entry.name);
      const basename = path.basename(fileName, path.extname(fileName));
      if (!basename) continue;
      if (compactMatchKey(basename) !== target) continue;
      const imageUrl = canonicalizeImageUrl(getText(entry.url));
      if (imageUrl) return imageUrl;
    }

    for (const entry of entries) {
      const fileName = getText(entry.name);
      const basename = path.basename(fileName, path.extname(fileName));
      const compactName = compactMatchKey(basename);
      if (!basename || !compactName.startsWith(target)) continue;
      const imageUrl = canonicalizeImageUrl(getText(entry.url));
      if (imageUrl) return imageUrl;
    }
  }

  return null;
}

function readDataset(file: string): DatasetDocument {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as DatasetDocument;
}

function writeDataset(file: string, document: DatasetDocument) {
  fs.writeFileSync(path.join(DATA_DIR, file), `${JSON.stringify(document, null, 2)}\n`);
}

function resolveLocalPath(folderName: string, fileName: string) {
  return encodeWebPath("Grow a Garden", folderName, fileName);
}

function resolveCandidateTitles(config: DatasetFileConfig, item: DatasetRecord): string[] {
  const candidates = config.candidateTitles ? config.candidateTitles(item) : [getName(item, config.nameField)];
  return Array.from(new Set(candidates.map((value) => value.trim()).filter(Boolean)));
}

function main() {
  const localIndex = scanLocalImageIndex();
  const farmPetMap = buildFarmPetMap();

  for (const config of DATASET_CONFIGS) {
    console.log(`Processing ${config.file}...`);
    ensureDir(path.join(PUBLIC_ROOT, config.folder));
    if (!localIndex.byFolderSlug.has(config.folder)) {
      localIndex.byFolderSlug.set(config.folder, new Map());
    }
    const document = readDataset(config.file);
    if (!Array.isArray(document.meta?.columns)) {
      document.meta = { ...(document.meta ?? {}), columns: [] };
    }
    if (!document.meta?.columns?.includes("image")) {
      document.meta!.columns = [...(document.meta?.columns ?? []), "image"];
    }

    const names = document.items.map((item) => getName(item, config.nameField)).filter(Boolean);
    const pageMatchMap = new Map<string, string>();
    for (const pageTitle of config.pageTitles ?? []) {
      const partial = buildPageMatchMap(pageTitle, names);
      for (const [key, value] of partial) {
        if (!pageMatchMap.has(key)) pageMatchMap.set(key, value);
      }
    }

    const allCandidateTitles = document.items.flatMap((item) => resolveCandidateTitles(config, item));
    const pageImageMap = buildPageImageMap(allCandidateTitles);

    let localCount = 0;
    let downloadedCount = 0;
    let unresolvedCount = 0;

    for (const item of document.items) {
      const displayName = getName(item, config.nameField);
      const slug = slugify(displayName);
      const folderMap = localIndex.byFolderSlug.get(config.folder);
      const existingLocal =
        folderMap?.get(slug) ??
        (config.allowCrossCategoryLocal ? localIndex.byAnySlug.get(slug) : undefined) ??
        (config.file === "seeds.json" || config.file === "crafting-recipes.json" ? localIndex.byAnySlug.get(slugify(getText(item.crop) || displayName.replace(/\s+Seed$/i, ""))) : undefined);

      if (existingLocal) {
        item.image = existingLocal;
        localCount += 1;
        continue;
      }

      let sourceUrl =
        pageMatchMap.get(displayName) ??
        resolveCandidateTitles(config, item)
          .map((title) => pageImageMap.get(title))
          .find(Boolean) ??
        null;

      if (!sourceUrl && document.items.length <= 100) {
        const searchMatches = resolveCandidateTitles(config, item)
          .map((candidate) => searchPageTitle(candidate))
          .filter((value): value is string => Boolean(value));

        if (searchMatches.length) {
          const searchPageImages = buildPageImageMap(searchMatches);
          sourceUrl = searchMatches.map((title) => searchPageImages.get(title)).find(Boolean) ?? null;
        }
      }

      if (!sourceUrl && config.file === "pets.json") {
        sourceUrl = farmPetMap.get(normalizeForMatch(displayName)) ?? null;
      }

      if (!sourceUrl) {
        sourceUrl = resolveFileImage(config, displayName);
      }

      if (!sourceUrl) {
        sourceUrl = EXTERNAL_IMAGE_OVERRIDES[`${config.file}::${displayName}`] ?? null;
      }

      if (!sourceUrl) {
        unresolvedCount += 1;
        item.image = null;
        continue;
      }

      const ext = fileExtFromUrl(sourceUrl);
      const fileName = `${slug}${ext}`;
      const diskPath = path.join(PUBLIC_ROOT, config.folder, fileName);
      if (!fs.existsSync(diskPath)) {
        curlDownload(sourceUrl, diskPath);
      }
      const webPath = resolveLocalPath(config.folder, fileName);
      item.image = webPath;
      downloadedCount += 1;
      localIndex.byFolderSlug.get(config.folder)?.set(slug, webPath);
      if (!localIndex.byAnySlug.has(slug)) {
        localIndex.byAnySlug.set(slug, webPath);
      }
    }

    writeDataset(config.file, document);
    console.log(
      `${config.file}: local=${localCount} downloaded=${downloadedCount} unresolved=${unresolvedCount} total=${document.items.length}`
    );
  }
}

main();
