import fs from "node:fs/promises";
import path from "node:path";
import { repoPath } from "@/lib/paths";

const API_URL = "https://slime-rng.fandom.com/api.php";
const ACCESS_DATE = "2026-05-24";
const DATA_DIR = repoPath("data", "Slime RNG");
const PUBLIC_DIR = repoPath("apps", "web", "public", "Slime RNG");
const PUBLIC_ROOT = "/Slime%20RNG";
const USER_AGENT =
  process.env.BLOXODES_SOURCE_UA ?? "BloxodesSlimeRngCollector/1.0 (+https://bloxodes.com)";

const skipImages = process.argv.includes("--skip-images");
const imageRefCache = new Map<string, Promise<ImageRef>>();

type Source = {
  label: string;
  url: string;
  accessed: string;
};

type DatasetFile<T> = {
  meta: {
    title: string;
    updatedAt: string;
    sources: Source[];
    columns: string[];
  };
  items: T[];
};

type ImageRef = {
  image: string | null;
  sourceImageUrl: string | null;
};

type SlimeRow = {
  name: string;
  slug: string;
  family: string;
  variant: string;
  catalogSection: string;
  rarity: string;
  odds: string;
  power: string | null;
  health: string | null;
  image: string | null;
  sortOrder: number;
  sourcePage: string;
  sourceImageUrl: string | null;
};

type ZoneRow = {
  name: string;
  slug: string;
  zoneName: string;
  zoneNumber: number;
  stage: string;
  cost: string;
  totalZoneLuck: string;
  enemyHealth: string | null;
  goopPerKill: string | null;
  machineUnlocks: string[];
  image: string | null;
  sortOrder: number;
  sourcePage: string;
  sourceImageUrl: string | null;
};

type CraftingRow = {
  name: string;
  slug: string;
  craftingStage: string;
  area: string;
  zone: string;
  resultChance: string;
  resultRarity: string;
  requiredSlimeOne: string;
  requiredSlimeTwo: string;
  requiredSlimeThree: string;
  requiredSummary: string;
  ingredientOddsText: string;
  image: string | null;
  sortOrder: number;
  sourcePage: string;
  sourceImageUrl: string | null;
};

type ItemRow = {
  name: string;
  slug: string;
  itemType: "Food" | "Potions" | "Dice";
  effect: string;
  xp: string | null;
  buff: string | null;
  nextRoll: string | null;
  duration: string | null;
  rule: string | null;
  image: string | null;
  sortOrder: number;
  sourcePage: string;
  sourceImageUrl: string | null;
};

type PowerFruitRow = {
  name: string;
  slug: string;
  catalogSection: string;
  spawnChance: string;
  spawnChanceDenominator: number;
  power: string;
  abilityOne: string | null;
  abilityTwo: string | null;
  upgradeNote: string;
  restrictions: string;
  image: string | null;
  sortOrder: number;
  sourcePage: string;
  sourceImageUrl: string | null;
};

type RebirthRow = {
  name: string;
  slug: string;
  rebirthNumber: number;
  rebirthRange: string;
  catalogSection: string;
  goopRequired: string;
  luckMultiplier: string;
  resetNote: string;
  image: string | null;
  sortOrder: number;
  sourcePage: string;
  sourceImageUrl: string | null;
};

type IndexRewardRow = {
  name: string;
  slug: string;
  mutationType: string;
  catalogSection: string;
  slimesNeeded: number;
  rewardOne: string | null;
  rewardTwo: string | null;
  rewardThree: string | null;
  rewardFocus: string;
  rewardSummary: string;
  image: string | null;
  sortOrder: number;
  sourcePage: string;
};

const source = (page: string): Source => ({
  label: `Slime RNG Wiki - ${page.replace(/_/g, " ")}`,
  url: `https://slime-rng.fandom.com/wiki/${page}`,
  accessed: ACCESS_DATE
});

async function fetchText(url: URL | string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": USER_AGENT
    }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status}: ${url.toString()}`);
  }
  return response.text();
}

async function fetchWikiText(page: string): Promise<string> {
  const url = new URL(API_URL);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", page);
  url.searchParams.set("prop", "wikitext");
  url.searchParams.set("format", "json");
  const payload = JSON.parse(await fetchText(url)) as { parse?: { wikitext?: { "*": string } } };
  const text = payload.parse?.wikitext?.["*"];
  if (!text) throw new Error(`No wikitext returned for ${page}`);
  return text;
}

async function resolveImageUrl(fileName: string): Promise<string | null> {
  const normalized = normalizeWikiFileName(fileName);
  if (!normalized) return null;
  const url = new URL(API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", `File:${normalized}`);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url");
  url.searchParams.set("format", "json");

  try {
    const payload = JSON.parse(await fetchText(url)) as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ url?: string | null }> }> };
    };
    const pages = payload.query?.pages ?? {};
    const first = Object.values(pages)[0];
    return first?.imageinfo?.[0]?.url ?? null;
  } catch (error) {
    console.warn(`Unable to resolve image ${fileName}:`, error);
    return null;
  }
}

async function downloadImage(fileName: string | null, folder: string, preferredSlug?: string): Promise<ImageRef> {
  if (!fileName) return { image: null, sourceImageUrl: null };
  const cacheKey = `${folder}:${normalizeWikiFileName(fileName) ?? fileName}`;
  const cached = imageRefCache.get(cacheKey);
  if (cached) return cached;

  const promise = downloadImageUncached(fileName, folder, preferredSlug);
  imageRefCache.set(cacheKey, promise);
  return promise;
}

async function downloadImageUncached(fileName: string, folder: string, preferredSlug?: string): Promise<ImageRef> {
  const sourceImageUrl = await resolveImageUrl(fileName);
  if (!sourceImageUrl) return { image: null, sourceImageUrl: null };

  const baseName = preferredSlug ? slugify(preferredSlug) : slugify(stripImageExtension(fileName));
  let extension = imageExtension(fileName) ?? imageExtension(sourceImageUrl) ?? "png";
  let file = `${baseName}.${extension}`;

  if (!skipImages) {
    const targetDir = path.join(PUBLIC_DIR, folder);
    await fs.mkdir(targetDir, { recursive: true });

    const response = await fetch(sourceImageUrl, {
      headers: {
        "user-agent": USER_AGENT,
        accept: buildImageAcceptHeader(extension)
      }
    });
    if (!response.ok) {
      console.warn(`Unable to download image ${sourceImageUrl}: ${response.status}`);
    } else {
      extension = extensionFromContentType(response.headers.get("content-type")) ?? extension;
      file = `${baseName}.${extension}`;
      const target = path.join(targetDir, file);
      try {
        await fs.access(target);
      } catch {
        await fs.writeFile(target, Buffer.from(await response.arrayBuffer()));
      }
    }
  }

  const publicPath = `${PUBLIC_ROOT}/${encodePathSegment(folder)}/${encodeURIComponent(file)}`;
  return { image: publicPath, sourceImageUrl };
}

function buildImageAcceptHeader(extension: string): string {
  switch (extension.toLowerCase()) {
    case "png":
      return "image/png,image/jpeg,image/webp,image/*,*/*";
    case "jpg":
    case "jpeg":
      return "image/jpeg,image/png,image/webp,image/*,*/*";
    case "webp":
      return "image/webp,image/png,image/jpeg,image/*,*/*";
    default:
      return "image/png,image/jpeg,image/webp,image/*,*/*";
  }
}

function extensionFromContentType(value: string | null): string | null {
  const contentType = value?.split(";")[0]?.trim().toLowerCase();
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
  return null;
}

function normalizeWikiFileName(value: string | null | undefined): string | null {
  const cleaned = (value ?? "")
    .replace(/^File:/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function stripImageExtension(value: string): string {
  let next = value.replace(/^File:/i, "").trim();
  while (/\.(png|jpe?g|webp|gif)$/i.test(next)) {
    next = next.replace(/\.(png|jpe?g|webp|gif)$/i, "");
  }
  return next;
}

function imageExtension(value: string): string | null {
  const match = value.match(/\.(png|jpe?g|webp|gif)(?:$|[?#/])/i);
  if (!match?.[1]) return null;
  const extension = match[1].toLowerCase();
  return extension === "jpeg" ? "jpg" : extension;
}

function encodePathSegment(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\[\[File:[^\]]+\]\]/gi, " ")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''/g, "")
    .replace(/''/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&times;/gi, "x")
    .replace(/×/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCase(value: string): string {
  const cleaned = cleanText(value);
  if (!cleaned) return cleaned;
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}

function parseNumberValue(value: string | null): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/[\d.]+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function variantFromName(name: string, explicit: string | undefined): string {
  const normalized = (explicit ?? "").toLowerCase();
  if (normalized.includes("big")) return "Big";
  if (normalized.includes("huge")) return "Huge";
  if (normalized.includes("shiny")) return "Shiny";
  if (normalized.includes("inverted")) return "Inverted";
  if (/^Big\s+/i.test(name)) return "Big";
  if (/^Huge\s+/i.test(name)) return "Huge";
  if (/^Shiny\s+/i.test(name)) return "Shiny";
  if (/^Inverted\s+/i.test(name)) return "Inverted";
  return "Base";
}

function familyFromName(name: string): string {
  return name.replace(/^(Big|Huge|Shiny|Inverted)\s+/i, "").trim();
}

function parseStats(value: string): { power: string | null; health: string | null } {
  const power = value.match(/💪\s*([^\s❤]+)/u)?.[1] ?? null;
  const health = value.match(/(?:❤️|❤)\s*([^\s]+)/u)?.[1] ?? null;
  return { power, health };
}

function extractTemplates(text: string, templateName: string): string[] {
  const result: string[] = [];
  const needle = `{{${templateName}`;
  let index = 0;

  while (index < text.length) {
    const start = text.indexOf(needle, index);
    if (start === -1) break;
    let depth = 0;
    for (let cursor = start; cursor < text.length - 1; cursor += 1) {
      const pair = text.slice(cursor, cursor + 2);
      if (pair === "{{") {
        depth += 1;
        cursor += 1;
      } else if (pair === "}}") {
        depth -= 1;
        cursor += 1;
        if (depth === 0) {
          result.push(text.slice(start + 2, cursor - 1));
          index = cursor + 1;
          break;
        }
      }
    }
    if (index <= start) break;
  }

  return result;
}

function parseTemplateParams(template: string): Record<string, string> {
  const body = template.replace(/^[^|]+\|?/, "");
  const params: Record<string, string> = {};
  for (const part of body.split(/\n\|/g)) {
    const cleaned = part.replace(/^\|/, "").trim();
    if (!cleaned) continue;
    const eq = cleaned.indexOf("=");
    if (eq === -1) continue;
    const key = cleaned.slice(0, eq).trim();
    const value = cleaned.slice(eq + 1).trim();
    params[key] = value;
  }
  return params;
}

async function collectSlimes(): Promise<SlimeRow[]> {
  const text = await fetchWikiText("Slimes");
  const templates = extractTemplates(text, "SlimeCardTest");
  const rows: SlimeRow[] = [];

  for (const [index, template] of templates.entries()) {
    const parts = template.replace(/^SlimeCardTest\|/, "").split("|");
    const name = cleanText(parts[0]);
    if (!name) continue;
    const fileName = cleanText(parts[1]);
    const odds = cleanText(parts[3]);
    const statText = cleanText(parts[4]);
    const rarity = cleanText(parts[5]);
    const variant = variantFromName(name, parts[7] || parts[6]);
    const family = familyFromName(name);
    const stats = parseStats(statText);
    const image = await downloadImage(fileName, "Slimes", stripImageExtension(fileName));

    rows.push({
      name,
      slug: slugify(name),
      family,
      variant,
      catalogSection: variant,
      rarity,
      odds,
      power: stats.power,
      health: stats.health,
      image: image.image,
      sortOrder: index + 1,
      sourcePage: source("Slimes").url,
      sourceImageUrl: image.sourceImageUrl
    });
  }

  return rows;
}

async function collectZones(): Promise<ZoneRow[]> {
  const text = await fetchWikiText("Zones");
  const marker = /<!--\s*=+\s*ZONE\s+(\d+):\s*([^=]+?)\s*=+\s*-->/gi;
  const matches = Array.from(text.matchAll(marker));
  const rows: ZoneRow[] = [];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const next = matches[i + 1];
    const block = text.slice(match.index ?? 0, next?.index ?? text.length);
    const zoneNumber = Number(match[1]);
    const name = cleanText(match[2]);
    if (/IN PROGRESS/i.test(block) || zoneNumber > 33) continue;
    const zoneImage = block.match(/class="zone-bg"[\s\S]*?\[\[File:([^|\]]+)/i)?.[1] ?? null;
    const enemyHealth = cleanText(block.match(/(?:❤️|❤)\s*([^<\n]+)/u)?.[1] ?? "");
    const cost = cleanText(block.match(/Cost:\s*<b>([^<]+)<\/b>/i)?.[1] ?? "");
    const totalZoneLuck = cleanText(block.match(/Total Zone Luck:\s*<b>([^<]+)<\/b>/i)?.[1] ?? "");
    const goopPerKill = cleanText(block.match(/Goop Per Kill:\s*'''([^']+)'''/i)?.[1] ?? "");
    const stage = cleanText(block.match(/border-radius:\s*999px[^>]*>([^<]+)<\/span>/i)?.[1] ?? "");
    const machineUnlocks = [
      /Crafting Machine/i.test(block) ? "Crafting Machine" : null,
      /XP[ _]Transfer Machine/i.test(block) ? "XP Transfer Machine" : null
    ].filter((value): value is string => Boolean(value));
    const image = await downloadImage(zoneImage, "Zones", name);

    rows.push({
      name: `Zone ${zoneNumber}: ${name}`,
      slug: `zone-${zoneNumber}-${slugify(name)}`,
      zoneName: name,
      zoneNumber,
      stage: stage || "Zones",
      cost: cost || "Not listed",
      totalZoneLuck: totalZoneLuck || `+${zoneNumber}`,
      enemyHealth: enemyHealth || null,
      goopPerKill: goopPerKill || null,
      machineUnlocks,
      image: image.image,
      sortOrder: zoneNumber,
      sourcePage: source("Zones").url,
      sourceImageUrl: image.sourceImageUrl
    });
  }

  return rows;
}

async function collectCrafting(slimes: SlimeRow[]): Promise<CraftingRow[]> {
  const text = await fetchWikiText("Crafting");
  const slimeImageByFamily = new Map(slimes.filter((row) => row.variant === "Base").map((row) => [row.family, row]));
  const templates = extractTemplates(text, "Crafting");

  return templates.map((template, index) => {
    const params = parseTemplateParams(template);
    const name = cleanText(params.Element);
    const required = [params.Element1, params.Element2, params.Element3].map(cleanText);
    const slimeImage = slimeImageByFamily.get(name);
    const area = cleanText(params.Area);
    const zone = craftingZoneByArea(area);
    const craftingStage = craftingStageByArea(area);
    const ingredientOddsText = [
      cleanText(params.Chance1),
      cleanText(params.Chance2),
      cleanText(params.Chance3)
    ]
      .filter(Boolean)
      .map((value) => `1 / ${value}`)
      .join(", ");

    return {
      name,
      slug: slugify(name),
      craftingStage,
      area,
      zone,
      resultChance: `1 / ${cleanText(params.Chance)}`,
      resultRarity: cleanText(params.Rarity),
      requiredSlimeOne: formatRequiredSlime(params.Element1, params.Chance1, params.Rarity1),
      requiredSlimeTwo: formatRequiredSlime(params.Element2, params.Chance2, params.Rarity2),
      requiredSlimeThree: formatRequiredSlime(params.Element3, params.Chance3, params.Rarity3),
      requiredSummary: required.filter(Boolean).join(", "),
      ingredientOddsText,
      image: slimeImage?.image ?? null,
      sortOrder: index + 1,
      sourcePage: source("Crafting").url,
      sourceImageUrl: slimeImage?.sourceImageUrl ?? null
    };
  });
}

function craftingZoneByArea(area: string): string {
  const zones: Record<string, string> = {
    Cave: "Zone 6",
    Jungle: "Zone 8",
    "Mushroom Forest": "Zone 10",
    "Redwood Forest": "Zone 12",
    Candyland: "Zone 14",
    "Crystal Cavern": "Zone 16",
    Atlantis: "Zone 18",
    Graveyard: "Zone 21",
    "Winter Wonderland": "Zone 26"
  };
  return zones[area] ?? "Not listed";
}

function craftingStageByArea(area: string): string {
  if (["Cave", "Jungle"].includes(area)) return "Early crafting recipes";
  if (["Mushroom Forest", "Redwood Forest", "Candyland"].includes(area)) return "Midgame crafting recipes";
  if (["Crystal Cavern", "Atlantis"].includes(area)) return "Late crafting recipes";
  return "Endgame crafting recipes";
}

function formatRequiredSlime(name: string | undefined, chance: string | undefined, rarity: string | undefined): string {
  const cleanName = cleanText(name);
  if (!cleanName) return "";
  const parts = [cleanName];
  const cleanChance = cleanText(chance);
  const cleanRarity = cleanText(rarity);
  if (cleanChance) parts.push(`1 / ${cleanChance}`);
  if (cleanRarity) parts.push(cleanRarity);
  return parts.join(" - ");
}

async function collectItems(): Promise<ItemRow[]> {
  const text = await fetchWikiText("Items");
  const sections: Array<{ itemType: ItemRow["itemType"]; text: string }> = [
    { itemType: "Food", text: tabberSection(text, "FOOD", "POTIONS") },
    { itemType: "Potions", text: tabberSection(text, "POTIONS", "DICE") },
    { itemType: "Dice", text: tabberSection(text, "DICE", "POWER FRUITS") }
  ];
  const rows: ItemRow[] = [];

  for (const section of sections) {
    const blocks = section.text.split(/<div class="items-grid-item/gi).slice(1);
    for (const block of blocks) {
      const fullBlock = `<div class="items-grid-item${block}`;
      const fileName = fullBlock.match(/\[\[File:([^|\]]+)/i)?.[1] ?? null;
      const name = cleanText(
        fullBlock.match(/font-size:13px;[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
          fullBlock.match(/\]\]\s*<div[^>]*>([^<]+)/i)?.[1] ??
          ""
      );
      const effect = cleanText(fullBlock.match(/font-size:11px;[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
      if (!name || !effect) continue;
      const image = await downloadImage(fileName, "Items", name);
      const xp = section.itemType === "Food" ? effect.match(/\+\s*\d+\s*XP/i)?.[0] ?? null : null;
      const rule =
        section.itemType === "Dice" && /Big|Huge|Shiny|Inverted/i.test(name)
          ? "Mutation dice do not stack"
          : section.itemType === "Dice" && /Jackpot/i.test(name)
            ? "Grants a guaranteed Jackpot Wheel spin"
            : null;

      rows.push({
        name,
        slug: slugify(name),
        itemType: section.itemType,
        effect,
        xp,
        buff: section.itemType === "Potions" ? effect : null,
        nextRoll: section.itemType === "Dice" ? effect : null,
        duration: section.itemType === "Potions" ? "3 minutes" : null,
        rule,
        image: image.image,
        sortOrder: rows.length + 1,
        sourcePage: source("Items").url,
        sourceImageUrl: image.sourceImageUrl
      });
    }
  }

  return rows;
}

function tabberSection(text: string, label: string, nextLabel: string): string {
  const start = text.indexOf(`${label}=`);
  const end = text.indexOf(`${nextLabel}=`, start + label.length);
  if (start === -1) return "";
  return text.slice(start, end === -1 ? text.length : end);
}

async function collectPowerFruits(): Promise<PowerFruitRow[]> {
  const text = await fetchWikiText("Power_Fruits");
  const rows: PowerFruitRow[] = [];
  const listMatches = Array.from(text.matchAll(/\[\[([^|\]]+)\|([^|\]]+?)\s+1\/([0-9,]+)\]\]/g));

  for (const [index, match] of listMatches.entries()) {
    const page = match[1].trim();
    const name = cleanText(match[2]);
    const spawnChance = `1 / ${match[3]} per second`;
    const detailText = await fetchWikiText(page);
    const abilities = parsePowerFruitAbilities(detailText);
    const fileName = detailText.match(/\[\[File:([^|\]]*Fruit\.(?:png|webp|jpg|jpeg))/i)?.[1] ?? `${name.replace(/\s+/g, "")}.png`;
    const image = await downloadImage(fileName, "Power Fruits", name);

    rows.push({
      name,
      slug: slugify(name),
      catalogSection: "Power Fruits",
      spawnChance,
      spawnChanceDenominator: Number(match[3].replace(/,/g, "")),
      power: name.replace(/\s+Fruit$/i, ""),
      abilityOne: abilities[0] ?? null,
      abilityTwo: abilities[1] ?? null,
      upgradeNote: "Fruits unlock a power first, then upgrades use fruit copies or upgrade points where listed",
      restrictions: "One fruit per slime; fruited slimes cannot be used in crafting; fruit must be claimed within 2-3 minutes",
      image: image.image,
      sortOrder: index + 1,
      sourcePage: source(page).url,
      sourceImageUrl: image.sourceImageUrl
    });
  }

  return rows;
}

function parsePowerFruitAbilities(text: string): string[] {
  const matches = Array.from(
    text.matchAll(
      /<div style="font-weight:bold;\s*font-size:24px;">([^<]+)<\/div>\s*<div style="font-size:18px;\s*margin-top:10px;">([^<]+)<\/div>/g
    )
  );
  return matches
    .map((match) => {
      const name = cleanText(match[1]);
      const description = cleanText(match[2]);
      if (!name || /^\?+$/.test(name) || !description || /^\?+$/.test(description)) return null;
      return `${name}: ${description}`;
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 2);
}

async function collectRebirths(): Promise<RebirthRow[]> {
  const text = await fetchWikiText("Rebirths");
  const marker = /<!--\s*Rebirth\s+(\d+)\s*-->/gi;
  const matches = Array.from(text.matchAll(marker));

  return matches.map((match, index) => {
    const next = matches[index + 1];
    const block = text.slice(match.index ?? 0, next?.index ?? text.length);
    const rebirthNumber = Number(match[1]);
    const goopRequired = cleanText(block.match(/GoopImage\.png[^\]]*\]\]\s*([^<]+)/i)?.[1] ?? "");
    const luckMultiplier = cleanText(block.match(/Luck1\.png[^\]]*\]\]\s*([^<]+)/i)?.[1] ?? "");

    return {
      name: `Rebirth ${rebirthNumber}`,
      slug: `rebirth-${rebirthNumber}`,
      rebirthNumber,
      rebirthRange:
        rebirthNumber <= 10 ? "Rebirths 1-10" : rebirthNumber <= 20 ? "Rebirths 11-20" : "Rebirths 21-30",
      catalogSection:
        rebirthNumber <= 10 ? "Rebirths 1-10" : rebirthNumber <= 20 ? "Rebirths 11-20" : "Rebirths 21-30",
      goopRequired,
      luckMultiplier,
      resetNote: "Rebirth resets coins and unlocked zones, while higher rebirths increase the luck multiplier",
      image: null,
      sortOrder: rebirthNumber,
      sourcePage: source("Rebirths").url,
      sourceImageUrl: null
    };
  });
}

async function collectIndexRewards(): Promise<IndexRewardRow[]> {
  const text = await fetchWikiText("Index_Rewards");
  const tabMatches = Array.from(text.matchAll(/\|-?\|?([A-Za-z]+)=/g));
  const starts = [{ label: "Basic", index: text.indexOf("Basic=") }, ...tabMatches.map((match) => ({
    label: match[1],
    index: match.index ?? 0
  }))].filter((entry, index, array) => entry.index >= 0 && array.findIndex((item) => item.label === entry.label) === index);
  const rows: IndexRewardRow[] = [];
  const fallbackSections = ["Basic", "Big", "Huge", "Shiny", "Inverted"];

  for (let sectionIndex = 0; sectionIndex < fallbackSections.length; sectionIndex += 1) {
    const label = fallbackSections[sectionIndex];
    const start = text.indexOf(`${label}=`);
    if (start === -1) continue;
    const nextStarts = fallbackSections
      .slice(sectionIndex + 1)
      .map((nextLabel) => text.indexOf(`${nextLabel}=`, start + label.length))
      .filter((value) => value !== -1);
    const end = nextStarts.length ? Math.min(...nextStarts) : text.length;
    const sectionText = text.slice(start, end);
    const templates = extractTemplates(sectionText, "Indexr");

    for (const template of templates) {
      const params = parseTemplateParams(template);
      const need = Number(cleanText(params.Need));
      const rewards = [params.Reward1, params.Reward2, params.Reward3].map((value) => cleanReward(value));
      const presentRewards = rewards.filter((value): value is string => Boolean(value));

      rows.push({
        name: `${label} ${need} slimes`,
        slug: slugify(`${label}-${need}-slimes`),
        mutationType: label,
        catalogSection: label,
        slimesNeeded: need,
        rewardOne: rewards[0] ?? null,
        rewardTwo: rewards[1] ?? null,
        rewardThree: rewards[2] ?? null,
        rewardFocus: presentRewards.join("; "),
        rewardSummary: presentRewards.join("; "),
        image: null,
        sortOrder: rows.length + 1,
        sourcePage: source("Index_Rewards").url
      });
    }
  }

  if (!rows.length && starts.length) {
    throw new Error("Index Rewards page structure changed; no rows parsed");
  }

  return rows;
}

function cleanReward(value: string | undefined): string | null {
  const cleaned = sentenceCase(value ?? "")
    .replace(/\s+x\s*/gi, " x")
    .replace(/\s+×\s*/g, " x")
    .trim();
  return cleaned || null;
}

async function writeDataset<T>(file: string, title: string, columns: string[], sources: Source[], items: T[]) {
  const dataset: DatasetFile<T> = {
    meta: {
      title,
      updatedAt: ACCESS_DATE,
      sources,
      columns
    },
    items
  };
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(`${file}: ${items.length} items`);
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  const slimes = await collectSlimes();
  await writeDataset(
    "slimes.json",
    "Slime RNG slimes data",
    ["family", "variant", "catalogSection", "rarity", "odds", "power", "health", "image"],
    [source("Slimes")],
    slimes
  );

  const zones = await collectZones();
  await writeDataset(
    "zones.json",
    "Slime RNG zones data",
    ["zoneName", "zoneNumber", "stage", "cost", "totalZoneLuck", "enemyHealth", "goopPerKill", "machineUnlocks", "image"],
    [source("Zones")],
    zones
  );

  const crafting = await collectCrafting(slimes);
  await writeDataset(
    "crafting-recipes.json",
    "Slime RNG crafting recipes data",
    [
      "area",
      "zone",
      "craftingStage",
      "resultChance",
      "resultRarity",
      "requiredSlimeOne",
      "requiredSlimeTwo",
      "requiredSlimeThree",
      "requiredSummary",
      "ingredientOddsText",
      "image"
    ],
    [source("Crafting"), source("Slimes")],
    crafting
  );

  const items = await collectItems();
  await writeDataset(
    "items.json",
    "Slime RNG items data",
    ["itemType", "effect", "xp", "buff", "nextRoll", "duration", "rule", "image"],
    [source("Items")],
    items
  );

  const powerFruits = await collectPowerFruits();
  await writeDataset(
    "power-fruits.json",
    "Slime RNG power fruits data",
    ["catalogSection", "spawnChance", "power", "abilityOne", "abilityTwo", "upgradeNote", "restrictions", "image"],
    [
      source("Power_Fruits"),
      source("Lightning_Fruit"),
      source("Fire_Fruit"),
      source("Ice_Fruit"),
      source("Sword_Fruit"),
      source("Magician_Fruit"),
      source("Universe_Fruit")
    ],
    powerFruits
  );

  const rebirths = await collectRebirths();
  await writeDataset(
    "rebirths.json",
    "Slime RNG rebirths data",
    ["rebirthNumber", "rebirthRange", "catalogSection", "goopRequired", "luckMultiplier", "resetNote"],
    [source("Rebirths")],
    rebirths
  );

  const indexRewards = await collectIndexRewards();
  await writeDataset(
    "index-rewards.json",
    "Slime RNG index rewards data",
    [
      "mutationType",
      "catalogSection",
      "slimesNeeded",
      "rewardOne",
      "rewardTwo",
      "rewardThree",
      "rewardFocus",
      "rewardSummary"
    ],
    [source("Index_Rewards")],
    indexRewards
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
