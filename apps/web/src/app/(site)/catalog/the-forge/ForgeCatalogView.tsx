import Image from "next/image";
import type { ReactNode } from "react";
import { PagePagination } from "@/components/PagePagination";
import type { CatalogPaginationInfo } from "./catalog-pagination";
import { ForgeCatalogViewShell } from "./ForgeCatalogViewShell";

type ForgeCatalogStat = { key: string; label: string };

export type ForgeCatalogConfig = {
  slug: string;
  label: string;
  groupLabel: string;
  stats?: ForgeCatalogStat[];
  maxStats?: number;
  badgeKey?: string;
  subtitleKeys?: string[];
  descriptionKey?: string;
  cardDescriptionKey?: string;
  hideImages?: boolean;
};

export type ForgeCatalogItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: unknown;
};

export type ForgeCatalogSection = {
  id: string;
  label: string;
  items: ForgeCatalogItem[];
  noteHtml?: string | null;
  noteNodes?: ReactNode[] | null;
  totalItemCount?: number;
  isContinuation?: boolean;
  startPage?: number;
  startHref?: string;
};

type ForgeCatalogViewProps = {
  sections: ForgeCatalogSection[];
  config: ForgeCatalogConfig;
  pagination?: CatalogPaginationInfo | null;
};

type ForgeCatalogDisplayStat = {
  label: string;
  value: string;
  parts?: string[];
  tone?: "positive" | "negative" | "warning" | "neutral";
};

type BooleanishValue = {
  value: boolean;
  detail?: string;
  exact: boolean;
};

const CARD_STAT_OVERRIDES: Record<string, string[]> = {
  "sell-lemons-income-sources": [
    "unlock",
    "role",
    "managerAutomation",
    "bestUse"
  ],
  "sell-lemons-powers": ["effect", "bestUse", "priority"],
  "sell-lemons-secret-unlocks": ["type", "location", "stepType", "rewardEffect"],
  "sell-lemons-evolution-stages": [
    "stage",
    "requirement",
    "multiplierEffect",
    "investorResetImpact"
  ],
  "sell-lemons-locations": [
    "stage",
    "unlock",
    "connectedSystem",
    "travelNote"
  ],
  "blox-fruits-accessories": ["displaySea", "bestFor", "damage", "defense", "mobility", "utility"],
  "blox-fruits-fruits": ["displayType", "moneyPrice", "permanentPrice", "awakeningCost", "status", "baseFruit"],
  "blox-fruits-swords": ["displaySea", "sourceRoute", "displayCost", "progressionUse"],
  "blox-fruits-fighting-styles": [
    "sourceTeacher",
    "costSummary",
    "masteryGate",
    "extraUnlock",
    "progressionRole",
    "bestFor"
  ],
  "blox-fruits-materials": ["displaySea", "sourceRoute", "use", "farmRoute", "craftCost"],
  "blox-fruits-races": ["unlockRoute", "rerollStatus", "bestFor", "mainStrength", "mainLimit"],
  "blox-fruits-bosses": ["displaySea", "location", "level", "respawnAccess", "dropsRewards", "routeUse"],
  "blox-fruits-enemies": ["seaStage", "level", "islandRegion", "questSource", "dropsRewards"],
  "blox-fruits-locations": ["displaySea", "levelRange", "locationType", "routeRole", "accessTravel"],
  "blox-fruits-quests": ["displaySea", "levelRequirement", "islandArea", "questGiverName", "objective"],
  "blox-fruits-sea-events": ["dangerLevel", "displayArea", "spawnAccess", "mainReward", "requiredSetup"],
  "blox-fruits-abilities": ["unlockRoute", "displayCost", "teacherSource", "levelMasteryRequirement", "keyUse"],
  "blox-fruits-aura-stages": ["displayStage", "coverage", "auraExpNeeded", "bonusEffect", "progressionNote"],
  "blox-fruits-aura-visuals": ["visualStage", "bodyCoverage", "armsVisual", "legsVisual", "statEffect", "equipUseNote"],
  "blox-fruits-boats": ["sourceAccess", "displayPrice", "displayHealth", "displaySeats", "displaySpeed"],
  "blox-fruits-guns": ["displaySea", "sourceRoute", "costOrDrop", "requirementMastery", "combatRole"],
  "blox-fruits-instinct-levels": ["displayLevel", "expRange", "baseDodges", "progressNote"],
  "blox-fruits-npcs": ["npcRole", "displaySea", "displayLocation", "purpose", "combatLevel"],
  "blox-fruits-titles": ["displayTitleNumber", "unlockRequirement", "unlockRoute", "relatedTarget", "availabilityNote"],
  "blox-fruits-special-titles": ["grantRoute", "holderTarget", "obtainmentNote", "normalPlayerRoute"],
  "blox-fruits-title-colors": ["unlockRequirement", "titleCountNeeded", "unlockStage", "visualRole"],
  "adopt-me-pets": ["source", "cost", "chance", "availability"],
  "sailor-piece-fruits": ["bestFor", "combatRole", "mainStrength", "mainLimit", "spinChance"],
  "sailor-piece-islands": ["bosses", "mainRole", "keyContent", "progressionUse"],
  "sailor-piece-accessories": ["defense", "damage", "damageReduction", "sourceRoute", "dropOrCost", "bestFor"],
  "sailor-piece-dungeons": ["runType", "level", "entryItem", "location", "mainRewards"],
  "sailor-piece-races": ["rollRarity", "bestFor", "coreBonus", "hasV4", "requiredFor"],
  "sailor-piece-traits": ["damageMultiplier", "defenseMultiplier", "cooldownReduction", "bestFor"],
  "sailor-piece-bloodlines": ["damage", "hp", "luck", "weaponBonus", "sourcePity"],
  "sailor-piece-bosses": ["difficulty", "level", "hp", "respawnAccess", "notableDrops"],
  "sailor-piece-swords": ["baseDamage", "attackSpeed", "masteryRequired", "sourceRoute", "bestFor", "unlockNote"],
  "sailor-piece-guilds": ["location", "encounter", "dropChance", "spawnRequirement", "maxBonus"],
  "sailor-piece-titles": ["tier", "bonus", "unlockRoute", "requirement", "dropOrPity"],
  "sailor-piece-melee-specs": ["statPriority", "unlockRoute", "sourceLocation", "abilityCount", "signatureMove"],
  "sailor-piece-runes": ["displayRarity", "source", "bonusType", "baseEffect", "maxEffect"],
  "sailor-piece-clans": ["rarity", "bestFor", "bonusSummary", "passive", "requirement"],
  "sailor-piece-relics": ["effect", "recipe", "partRoute", "bestFor"],
  "sailor-piece-haki": ["role", "unlockRoute", "requirements", "maxLevel", "maxEffect", "levelingRoute"],
  "rivals-wraps": ["source", "sourceType", "appliesTo", "sourceWeapon", "availability", "motion", "specialNote"],
  "rivals-finishers": ["source", "availability", "rarity"],
  "rivals-ugc": ["itemType", "price", "availability", "rewardSummary", "creatorName", "robloxId"],
  "jujutsu-shenanigans-characters": ["availability", "cost", "hp", "role"],
  "jujutsu-shenanigans-domains": ["availability", "character", "duration", "domainType"],
  "jujutsu-shenanigans-items": ["availability", "source", "price", "damageHeal", "location"],
  "jujutsu-shenanigans-gamemodes": ["availability", "access", "lives", "mapPool", "rewardSummary"],
  "jujutsu-shenanigans-maps": ["status", "modeAccess", "arenaType", "bestFor"],
  "jujutsu-shenanigans-emotes": ["availability", "source", "costObtainment", "movement"],
  "jujutsu-shenanigans-cosmetics": ["availability", "unlockRoute", "cost", "type", "audioStatus"],
  "jujutsu-shenanigans-titles": ["availability", "requirement", "titleType"],
  "jujutsu-shenanigans-interactables": ["availability", "location", "cost", "baseDamage", "type"],
  "jujutsu-shenanigans-achievements": ["availability", "requirement", "reward", "difficulty", "modeOrCharacter"],
  "jujutsu-shenanigans-build-blocks": ["availability", "category", "inputs", "outputs", "builderUse"],
  "jujutsu-shenanigans-skill-builder-nodes": ["status", "nodeType", "valueType", "defaultOrRange", "usedFor"],
  ores: ["dropChance", "multiplier", "sellPrice", "trait"],
  weapons: ["baseDamage", "attackSpeed", "range", "sellPrice"],
  armors: ["baseHealth", "sellPrice", "chance"],
  pickaxes: ["power", "speed", "luck", "cost"],
  runes: ["primaryDrop"],
  races: ["rollChance", "damage", "health", "speed"],
  essences: [],
  totems: ["cost"],
  potions: ["cost"],
  enemies: ["health", "damage", "gold", "experience"],
  npcs: [],
  locations: [],
  quests: [],
  skills: [],
  blueprints: []
};

function resolveImageSrc(image: string | null | undefined): string | null {
  if (!image) return null;
  if (image.startsWith("http")) return image;
  if (image.startsWith("/")) return image;
  return `/${image}`;
}

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const parts = value.map((entry) => normalizeValue(entry)).filter(Boolean) as string[];
    return parts.length ? parts.join("; ") : null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toLocaleString("en-US");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const lowered = trimmed.toLowerCase();
    if (["none", "n/a", "na", "null"].includes(lowered)) return null;
    return trimmed;
  }
  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        const normalized = normalizeValue(entry);
        if (!normalized) return null;
        const label = /^\d+$/.test(key) ? `Lv. ${key}` : formatKeyLabel(key);
        return `${label}: ${normalized}`;
      })
      .filter(Boolean) as string[];
    return parts.length ? parts.join("; ") : null;
  }
  return String(value);
}

function normalizeDisplayText(value: string): string {
  return value
    .replace(/\bsource-backed\b/gi, "listed")
    .replace(/\bsource estimate\b/gi, "estimate")
    .replace(/\bneeds in-game check\b/gi, "limited details")
    .replace(/\bcurrent source notes?\b/gi, "notes")
    .replace(/\bpartial cost source\b/gi, "partial cost")
    .replace(/\blower confidence\b/gi, "limited details")
    .replace(/\bduring planning\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatKeyLabel(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatSentenceFragment(value: string): string {
  const label = formatKeyLabel(value);
  return label ? label.charAt(0).toLowerCase() + label.slice(1) : "";
}

function normalizeBooleanDetail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = normalizeDisplayText(value)
    .replace(/^[\s:([{-]+/, "")
    .replace(/[\s.)\]}-]+$/, "");
  return cleaned || undefined;
}

function parseBooleanishValue(value: string): BooleanishValue | null {
  const normalized = normalizeDisplayText(value);
  const exact = normalized.replace(/[.!]+$/, "").toLowerCase();
  if (["yes", "true", "available", "enabled", "active", "obtainable", "✓", "✔", "✅"].includes(exact)) {
    return { value: true, exact: true };
  }
  if (["no", "false", "unavailable", "disabled", "inactive", "not available", "not obtainable", "✗", "✘", "❌"].includes(exact)) {
    return { value: false, exact: true };
  }

  const yesMatch = normalized.match(/^(yes|true)\b(.+)$/i);
  if (yesMatch) {
    return { value: true, detail: normalizeBooleanDetail(yesMatch[2]), exact: false };
  }

  const noMatch = normalized.match(/^(no|false)\b(.+)$/i);
  if (noMatch) {
    return { value: false, detail: normalizeBooleanDetail(noMatch[2]), exact: false };
  }

  return null;
}

function withBooleanDetail(value: string, detail: string | undefined): string {
  return detail ? `${value} (${detail})` : value;
}

function formatBooleanStat(label: string, value: string): ForgeCatalogDisplayStat | null {
  const parsed = parseBooleanishValue(value);
  if (!parsed) return null;

  const normalizedLabel = label.trim();
  const loweredLabel = normalizedLabel.toLowerCase();
  const booleanValue = parsed.value;
  if (["available", "availability"].includes(loweredLabel)) {
    return {
      label: "Status",
      value: withBooleanDetail(booleanValue ? "Available" : "Not available", parsed.detail),
      tone: booleanValue ? "positive" : "negative"
    };
  }

  if (loweredLabel === "obtainable") {
    return {
      label: "Status",
      value: withBooleanDetail(booleanValue ? "Obtainable" : "Not obtainable", parsed.detail),
      tone: booleanValue ? "positive" : "negative"
    };
  }

  if (loweredLabel.startsWith("has ")) {
    const subject = formatSentenceFragment(normalizedLabel.slice(4));
    return {
      label: "Status",
      value: withBooleanDetail(booleanValue ? `Has ${subject}` : `No ${subject}`, parsed.detail),
      tone: booleanValue ? "positive" : "negative"
    };
  }

  if (loweredLabel.startsWith("is ")) {
    const subject = normalizedLabel.slice(3);
    return {
      label: "Status",
      value: withBooleanDetail(booleanValue ? formatKeyLabel(subject) : `Not ${formatSentenceFragment(subject)}`, parsed.detail),
      tone: booleanValue ? "positive" : "negative"
    };
  }

  if (loweredLabel.startsWith("part of ")) {
    const subject = formatSentenceFragment(normalizedLabel.slice(8));
    return {
      label: "Status",
      value: withBooleanDetail(booleanValue ? `Part of ${subject}` : `Not part of ${subject}`, parsed.detail),
      tone: booleanValue ? "positive" : "negative"
    };
  }

  if (["tradable", "tradeable", "limited", "craftable", "obtainable"].includes(loweredLabel)) {
    return {
      label: "Status",
      value: withBooleanDetail(
        booleanValue ? formatKeyLabel(normalizedLabel) : `Not ${formatSentenceFragment(normalizedLabel)}`,
        parsed.detail
      ),
      tone: booleanValue ? "positive" : "negative"
    };
  }

  if (loweredLabel.startsWith("can ")) {
    const subject = formatSentenceFragment(normalizedLabel.slice(4));
    return {
      label: "Status",
      value: withBooleanDetail(booleanValue ? `Can ${subject}` : `Cannot ${subject}`, parsed.detail),
      tone: booleanValue ? "positive" : "negative"
    };
  }

  if (!parsed.exact) {
    return null;
  }

  return {
    label: normalizedLabel,
    value: booleanValue ? "Yes" : "No",
    tone: booleanValue ? "positive" : "negative"
  };
}

function getStatusTone(label: string, value: string): ForgeCatalogDisplayStat["tone"] | null {
  const loweredLabel = label.trim().toLowerCase();
  if (!["availability", "available", "status"].includes(loweredLabel)) return null;

  const loweredValue = value.toLowerCase();
  if (/\b(retired|removed|unavailable|not available|trade only|unobtainable|not obtainable|disabled|inactive)\b/.test(loweredValue)) {
    return "negative";
  }
  if (/\b(event|limited|seasonal|early access|exclusive|shop pool|random roll|maintain)\b/.test(loweredValue)) {
    return "warning";
  }
  if (/\b(available|current|free|default|source-backed|public|private server|obtainable|complete)\b/.test(loweredValue)) {
    return "positive";
  }

  return null;
}

function getStatusLabel(label: string): string {
  const loweredLabel = label.trim().toLowerCase();
  return ["availability", "available", "status"].includes(loweredLabel) ? "Status" : label;
}

function formatBadgeValue(key: string, value: unknown): string | null {
  const normalized = normalizeValue(value);
  if (!normalized) return null;

  const displayStat = buildDisplayStat(formatKeyLabel(key), value);
  if (displayStat?.label === "Status") return displayStat.value;

  return normalized;
}

function formatSubtitleValue(key: string, value: unknown): string | null {
  const normalized = normalizeValue(value);
  if (!normalized) return null;

  const booleanValue = parseBooleanishValue(normalized);
  const loweredKey = key.toLowerCase();
  if (["available", "availability"].includes(loweredKey) && booleanValue) {
    return withBooleanDetail(booleanValue.value ? "Available" : "Not available", booleanValue.detail);
  }

  if (loweredKey === "obtainable" && booleanValue) {
    return withBooleanDetail(booleanValue.value ? "Obtainable" : "Not obtainable", booleanValue.detail);
  }

  if (loweredKey === "sea" && /^\d/.test(normalized)) {
    return `Sea ${normalized}`;
  }

  if (loweredKey === "level" && !/^level\b/i.test(normalized)) {
    return `Level ${normalized}`;
  }

  if (["sourceType", "source_type"].includes(key) || ["category", "type", "status", "source", "location", "building"].includes(loweredKey)) {
    return normalized;
  }

  return `${formatKeyLabel(key)} ${normalized}`;
}

function buildSubtitle(item: ForgeCatalogItem, config: ForgeCatalogConfig): string | null {
  if (!config.subtitleKeys?.length) return null;
  const parts = config.subtitleKeys
    .map((key) => formatSubtitleValue(key, item[key]))
    .filter(Boolean)
    .slice(0, 2) as string[];
  if (!parts.length) return null;
  return parts.join(" • ");
}

function splitStatParts(label: string, value: string): string[] | null {
  const cleanedValue = normalizeDisplayText(value);
  const loweredLabel = label.toLowerCase();
  const semicolonParts = cleanedValue
    .split(/\s*;\s*/)
    .map((part) => normalizeDisplayText(part))
    .filter(Boolean);

  if (semicolonParts.length > 1) {
    return semicolonParts;
  }

  const signedMatches = cleanedValue
    .replace(/\s+-\s+/g, " ")
    .match(/[+-]\s*\d[\s\S]*?(?=\s+[+-]\s*\d|$)/g)
    ?.map((part) => normalizeDisplayText(part.replace(/\s+-\s+/g, " ")))
    .filter(Boolean);

  if (
    signedMatches &&
    signedMatches.length > 1 &&
    (loweredLabel.includes("bonus") || loweredLabel.includes("stat") || cleanedValue.length > 56)
  ) {
    return signedMatches;
  }

  return null;
}

function buildDisplayStat(label: string, value: unknown): ForgeCatalogDisplayStat | null {
  const normalized = normalizeValue(value);
  if (!normalized) return null;

  const booleanStat = formatBooleanStat(label, normalized);
  if (booleanStat) return booleanStat;

  const displayValue = normalizeDisplayText(normalized);
  const parts = splitStatParts(label, displayValue);
  const statusTone = getStatusTone(label, displayValue);
  return {
    label: statusTone ? getStatusLabel(label) : label,
    value: displayValue,
    parts: parts ?? undefined,
    tone: statusTone ?? undefined
  };
}

function buildStatEntries(item: ForgeCatalogItem, config: ForgeCatalogConfig) {
  const statMap = new Map(
    (config.stats ?? []).map((stat) => [
      stat.key,
      {
        label: stat.label,
        value: item[stat.key]
      }
    ])
  );

  const preferredKeys = CARD_STAT_OVERRIDES[config.slug] ?? (config.stats ?? []).map((stat) => stat.key);

  const stats = preferredKeys
    .map((key) => {
      const stat = statMap.get(key);
      return buildDisplayStat(stat?.label ?? formatKeyLabel(key), stat?.value ?? item[key]);
    })
    .filter(Boolean) as ForgeCatalogDisplayStat[];

  if (!stats.length) return [];
  const maxStats = config.maxStats ?? stats.length;
  return stats.slice(0, maxStats);
}

function getStatToneClass(stat: ForgeCatalogDisplayStat): string {
  if (stat.tone === "positive") return "text-emerald-300";
  if (stat.tone === "negative") return "text-rose-300";
  if (stat.tone === "warning") return "text-amber-300";
  return "text-foreground";
}

function renderValue(value: string | null) {
  if (!value) {
    return <span className="text-xs text-muted">—</span>;
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

function formatCompactNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function parseRobuxValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = normalizeValue(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRobuxPrice(item: ForgeCatalogItem): string | null {
  const priceRobux = parseRobuxValue(item.priceRobux);
  if (priceRobux !== null) {
    return priceRobux === 0 ? "Free" : `${formatCompactNumber(priceRobux)} Robux`;
  }

  return normalizeValue(item.price);
}

function buildRobloxCatalogUrl(item: ForgeCatalogItem): string | null {
  const directUrl = normalizeValue(item.robloxUrl);
  if (directUrl?.startsWith("https://www.roblox.com/")) return directUrl;

  const robloxId = normalizeValue(item.robloxId);
  if (robloxId) return `https://www.roblox.com/catalog/${robloxId}`;

  return null;
}

function RivalsUgcItemCard({ item }: { item: ForgeCatalogItem }) {
  const image = resolveImageSrc(item.image ?? null);
  const price = formatRobuxPrice(item);
  const creator = normalizeValue(item.creatorName);
  const itemType = normalizeValue(item.itemType);
  const availability = normalizeValue(item.availability);
  const rewardSummary = normalizeValue(item.rewardSummary);
  const robloxId = normalizeValue(item.robloxId);
  const robloxUrl = buildRobloxCatalogUrl(item);

  return (
    <article
      id={`item-${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:border-accent/55"
    >
      <div className="relative aspect-square w-full overflow-hidden border-b border-border/60 bg-background/70">
        {image ? (
          <Image
            src={image}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-3"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-muted/60">
            <span className="sr-only">Image unavailable for {item.name}</span>
          </div>
        )}
        {price ? (
          <div className="absolute left-2 top-2 inline-flex rounded-md bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
            {price}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-3">
        <div>
          <h3 className="text-sm font-semibold leading-4 text-foreground line-clamp-2">{item.name}</h3>
          {creator ? (
            <p className="-mt-0.5 block truncate text-xs leading-none text-muted">
              by <span className="font-semibold text-foreground">{creator}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {itemType ? (
            <span className="inline-flex items-center rounded-md border border-border/60 bg-background/50 px-2.5 py-1 text-[10px] font-medium text-foreground/85">
              {itemType}
            </span>
          ) : null}
          {availability ? (
            <span className="inline-flex items-center rounded-md border border-border/60 bg-background/50 px-2.5 py-1 text-[10px] font-medium text-foreground/85">
              {availability}
            </span>
          ) : null}
        </div>

        <dl className="space-y-2 rounded-md border border-border/60 bg-background/40 px-3 py-2.5">
          {rewardSummary ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Reward progress</dt>
              <dd className="mt-1 text-sm font-semibold leading-snug text-foreground">{rewardSummary}</dd>
            </div>
          ) : null}
          {robloxId ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Roblox ID</dt>
              <dd className="mt-1 text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
                {robloxId}
              </dd>
            </div>
          ) : null}
        </dl>

        {robloxUrl ? (
          <a
            href={robloxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
          >
            Open on Roblox
          </a>
        ) : null}
      </div>
    </article>
  );
}

function ForgeItemCard({ item, config }: { item: ForgeCatalogItem; config: ForgeCatalogConfig }) {
  if (config.slug === "rivals-ugc") {
    return <RivalsUgcItemCard item={item} />;
  }

  const badge = config.badgeKey ? formatBadgeValue(config.badgeKey, item[config.badgeKey]) : null;
  const subtitle = buildSubtitle(item, config);
  const description = config.cardDescriptionKey ? normalizeValue(item[config.cardDescriptionKey]) : null;
  const stats = buildStatEntries(item, config);
  const image = resolveImageSrc(item.image ?? null);
  const showImage = !config.hideImages;
  const primaryStatIndex = stats.findIndex((stat) => !stat.tone);

  return (
    <article
      id={`item-${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:border-accent/55"
    >
      {showImage ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-border/60 bg-background/50">
          {image ? (
            <Image
              src={image}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1440px) 25vw, 20vw"
              className="object-contain p-5"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-muted/60">
              <span className="sr-only">Image unavailable for {item.name}</span>
            </div>
          )}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-2">
          {badge ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {badge}
            </p>
          ) : null}
          <h3 className="text-lg font-semibold leading-snug text-foreground">{item.name}</h3>
          {subtitle ? (
            <p className="text-sm leading-relaxed text-muted">{subtitle}</p>
          ) : null}
          {description ? (
            <p className="text-sm leading-relaxed text-muted line-clamp-3">{description}</p>
          ) : null}
        </div>

        {stats.length ? (
          <dl className="mt-auto space-y-3 border-t border-border/60 pt-4">
            {stats.map((stat, index) =>
              stat.parts?.length ? (
                <div key={`${stat.label}-${index}`} className="grid grid-cols-[minmax(5rem,0.42fr)_minmax(0,1fr)] gap-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{stat.label}</dt>
                  <dd className="min-w-0">
                    <ul className="space-y-1">
                      {stat.parts.slice(0, 6).map((part, partIndex) => (
                        <li
                          key={`${part}-${partIndex}`}
                          className={`leading-snug [overflow-wrap:anywhere] ${
                            index === primaryStatIndex ? "text-[0.94rem] font-bold" : "text-sm font-semibold"
                          } ${getStatToneClass(stat)}`}
                        >
                          {part}
                        </li>
                      ))}
                      {stat.parts.length > 6 ? (
                        <li className="text-xs font-medium leading-snug text-muted">
                          +{stat.parts.length - 6} more
                        </li>
                      ) : null}
                    </ul>
                  </dd>
                </div>
              ) : (
                <div key={`${stat.label}-${index}`} className="grid grid-cols-[minmax(5rem,0.42fr)_minmax(0,1fr)] gap-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{stat.label}</dt>
                  <dd
                    className={`min-w-0 leading-snug [overflow-wrap:anywhere] ${
                      index === primaryStatIndex ? "text-[0.94rem] font-bold" : "text-sm font-semibold"
                    } ${getStatToneClass(stat)}`}
                  >
                    {stat.value}
                  </dd>
                </div>
              )
            )}
          </dl>
        ) : null}
      </div>
    </article>
  );
}

function ForgeItemTable({ section, config }: { section: ForgeCatalogSection; config: ForgeCatalogConfig }) {
  const stats = (config.stats ?? []).slice(0, config.maxStats ?? (config.stats?.length ?? 0));
  const badgeLabel = config.badgeKey ? formatKeyLabel(config.badgeKey) : null;
  const showImages = !config.hideImages;
  const subtitleLabel = config.subtitleKeys?.length
    ? config.subtitleKeys.length === 1
      ? formatKeyLabel(config.subtitleKeys[0])
      : "Details"
    : null;
  const descriptionLabel = config.descriptionKey ? formatKeyLabel(config.descriptionKey) : null;

  return (
    <div className="table-scroll-wrapper">
      <div className="table-scroll-inner game-copy">
        <table>
          <thead>
            <tr>
              {showImages ? <th className="table-col-compact">Image</th> : null}
              <th>Name</th>
              {badgeLabel ? <th className="table-col-compact">{badgeLabel}</th> : null}
              {subtitleLabel ? <th>{subtitleLabel}</th> : null}
              {stats.map((stat) => (
                <th key={stat.key} className="table-col-compact">
                  {stat.label}
                </th>
              ))}
              {descriptionLabel ? <th className="table-col-flex">{descriptionLabel}</th> : null}
            </tr>
          </thead>
          <tbody>
            {section.items.map((item) => {
              const subtitle = buildSubtitle(item, config);
              const description = config.descriptionKey ? normalizeValue(item[config.descriptionKey]) : null;
              const badgeValue = config.badgeKey ? formatBadgeValue(config.badgeKey, item[config.badgeKey]) : null;
              const image = resolveImageSrc(item.image ?? null);

              return (
                <tr key={item.id} id={`item-${item.id}-row`}>
                  {showImages ? (
                    <td className="table-col-compact">
                      <div className="flex items-center justify-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-muted/70 p-1.5">
                          {image ? (
                            <Image
                              src={image}
                              alt={item.name}
                              width={80}
                              height={80}
                              className="h-18 w-18 object-contain"
                              unoptimized
                            />
                          ) : (
                            <span className="sr-only">Image unavailable for {item.name}</span>
                          )}
                        </div>
                      </div>
                    </td>
                  ) : null}
                  <td>
                    <span className="font-semibold text-foreground">{item.name}</span>
                  </td>
                  {badgeLabel ? <td className="table-col-compact">{renderValue(badgeValue)}</td> : null}
                  {subtitleLabel ? <td>{renderValue(subtitle)}</td> : null}
                  {stats.map((stat) => (
                    <td key={stat.key} className="table-col-compact">
                      {renderValue(buildDisplayStat(stat.label, item[stat.key])?.value ?? null)}
                    </td>
                  ))}
                  {descriptionLabel ? (
                    <td className="table-col-flex">
                      {description ? (
                        <span className="text-sm text-muted line-clamp-2">{description}</span>
                      ) : (
                        renderValue(null)
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ForgeCatalogView({ sections, config, pagination }: ForgeCatalogViewProps) {
  const hasItems = sections.some((section) => section.items.length > 0);
  const totalItemCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const renderCards = totalItemCount <= 600;
  const renderList = true;

  if (!hasItems) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No {config.label.toLowerCase()} data has been collected yet. Check back soon.
      </div>
    );
  }

  return (
    <ForgeCatalogViewShell availableViews={renderCards ? ["cards", "list"] : ["list"]}>
      {pagination && pagination.totalPages > 1 ? (
        <div className="space-y-3 border-b border-border/60 pb-6">
          <p className="text-sm text-muted">
            Showing {pagination.pageItemCount.toLocaleString("en-US")} of{" "}
            {pagination.totalItems.toLocaleString("en-US")} items.
          </p>
          <PagePagination
            basePath={pagination.basePath}
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
          />
        </div>
      ) : null}
      <div className="space-y-12">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="space-y-5 scroll-mt-28">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">{config.groupLabel}</p>
                <h2 className="text-2xl font-semibold text-foreground">{section.label}</h2>
                {section.isContinuation ? (
                  <p className="text-sm font-medium text-muted">Continued from previous page</p>
                ) : null}
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {(section.totalItemCount ?? section.items.length).toLocaleString("en-US")} items
              </span>
            </div>
            {section.isContinuation ? (
              <p className="text-sm text-muted">Showing {section.items.length.toLocaleString("en-US")} items on this page.</p>
            ) : null}

            {section.noteNodes?.length ? <div className="max-w-3xl">{section.noteNodes}</div> : null}

            {!section.noteNodes?.length && section.noteHtml ? (
              <div
                className="md-copy-node md-copy-p max-w-3xl [&_a]:text-accent [&_a]:underline-offset-4 [&_a:hover]:underline [&_p]:m-0 [&_strong]:text-foreground"
                dangerouslySetInnerHTML={{ __html: section.noteHtml }}
              />
            ) : null}

            {renderCards ? (
              <div className="forge-catalog-cards-view">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {section.items.map((item) => (
                    <ForgeItemCard key={item.id} item={item} config={config} />
                  ))}
                </div>
              </div>
            ) : null}
            {renderList ? (
              <div className="forge-catalog-list-view">
                <ForgeItemTable section={section} config={config} />
              </div>
            ) : null}
          </section>
        ))}
      </div>
      {pagination && pagination.totalPages > 1 ? (
        <PagePagination
          basePath={pagination.basePath}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-6"
        />
      ) : null}
    </ForgeCatalogViewShell>
  );
}
