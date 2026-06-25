import Image from "next/image";
import type { ReactNode } from "react";
import { PagePagination } from "@/components/PagePagination";
import type { CatalogPaginationInfo } from "./catalog-pagination";
import { CatalogImageLightbox } from "./CatalogImageLightbox";
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
  toolbar?: ReactNode;
};

type ForgeCatalogDisplayStat = {
  label: string;
  value: string;
  parts?: string[];
  tone?: "positive" | "negative" | "warning" | "neutral";
};

type CatalogFieldKind = "normal" | "highlight" | "chip" | "detail";

type CatalogPresentationFieldDefinition = {
  key: string;
  label: string;
  source: "badge" | "subtitle" | "stat" | "description";
};

type CatalogPresentationField = {
  key: string;
  label: string;
  value: string | null;
  kind: CatalogFieldKind;
  tone?: ForgeCatalogDisplayStat["tone"];
  parts?: string[];
};

type CatalogItemPresentation = {
  id: string;
  title: string;
  image: string | null;
  description: string | null;
  fields: CatalogPresentationField[];
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

function splitStatParts(label: string, value: string): string[] | null {
  const cleanedValue = normalizeDisplayText(value);
  const loweredLabel = label.toLowerCase();
  const semicolonParts = cleanedValue
    .split(/\s*;\s*/)
    .map((part) => normalizeDisplayText(part))
    .filter(Boolean);

  const shouldSplitSemicolonParts =
    semicolonParts.length > 1 &&
    (loweredLabel.includes("bonus") ||
      loweredLabel.includes("stat") ||
      semicolonParts.every((part) => /^[+-]?\d|\b(level|lv\.|rank|tier)\b|:/.test(part.toLowerCase())));

  if (shouldSplitSemicolonParts) {
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

function getFieldToneClass(field: CatalogPresentationField): string {
  if (field.kind === "highlight") return "text-emerald-300";
  if (field.tone === "negative") return "text-rose-300";
  if (field.tone === "warning") return "text-amber-300";
  return "text-foreground";
}

function addUniqueField(
  fields: CatalogPresentationFieldDefinition[],
  seen: Set<string>,
  definition: CatalogPresentationFieldDefinition | null
) {
  if (!definition || seen.has(definition.key)) return;
  seen.add(definition.key);
  fields.push(definition);
}

function getPrimaryDescriptionKey(config: ForgeCatalogConfig): string | null {
  return config.cardDescriptionKey ?? config.descriptionKey ?? null;
}

function buildFieldDefinitions(config: ForgeCatalogConfig): CatalogPresentationFieldDefinition[] {
  const fields: CatalogPresentationFieldDefinition[] = [];
  const seen = new Set<string>();
  const descriptionKey = getPrimaryDescriptionKey(config);
  const statMap = new Map((config.stats ?? []).map((stat) => [stat.key, stat.label]));
  const preferredKeys = CARD_STAT_OVERRIDES[config.slug] ?? (config.stats ?? []).map((stat) => stat.key);

  addUniqueField(
    fields,
    seen,
    config.badgeKey && config.badgeKey !== descriptionKey
      ? { key: config.badgeKey, label: formatKeyLabel(config.badgeKey), source: "badge" }
      : null
  );

  for (const key of config.subtitleKeys ?? []) {
    addUniqueField(
      fields,
      seen,
      key !== descriptionKey ? { key, label: formatKeyLabel(key), source: "subtitle" } : null
    );
  }

  for (const key of preferredKeys) {
    addUniqueField(
      fields,
      seen,
      key !== descriptionKey
        ? { key, label: statMap.get(key) ?? formatKeyLabel(key), source: "stat" }
        : null
    );
  }

  for (const stat of config.stats ?? []) {
    addUniqueField(
      fields,
      seen,
      stat.key !== descriptionKey ? { key: stat.key, label: stat.label, source: "stat" } : null
    );
  }

  if (config.descriptionKey && config.descriptionKey !== descriptionKey) {
    addUniqueField(fields, seen, {
      key: config.descriptionKey,
      label: getDescriptionLabel(config.descriptionKey),
      source: "description"
    });
  }

  if (config.cardDescriptionKey && config.cardDescriptionKey !== descriptionKey) {
    addUniqueField(fields, seen, {
      key: config.cardDescriptionKey,
      label: getDescriptionLabel(config.cardDescriptionKey),
      source: "description"
    });
  }

  return fields;
}

function getDescriptionLabel(key: string | null | undefined): string {
  if (!key) return "Description";
  const loweredKey = key.toLowerCase();
  if (["cardsummary", "card_summary", "summary", "description", "overview"].includes(loweredKey)) {
    return "Description";
  }
  return formatKeyLabel(key);
}

function getFieldDisplayStat(definition: CatalogPresentationFieldDefinition, item: ForgeCatalogItem) {
  return buildDisplayStat(definition.label, item[definition.key]);
}

function isChipField(key: string, label: string, value: string): boolean {
  const marker = `${key} ${label}`.toLowerCase();
  if (/\b(price|cost|robux|money|cash|duration|time|cooldown|level|chance|odds|rarity|tier|rank|stage|sea|speed|health|damage|xp|exp|seats|luck)\b/.test(marker)) {
    return true;
  }
  return /^[+-]?\d[\d,.\s%kxKMB]*$/.test(value) || /\b(robux|bucks|coins|cash|xp|sec|seconds|min|minutes|hours|%)\b/i.test(value);
}

function isLongSentenceValue(value: string): boolean {
  const words = value.split(/\s+/).filter(Boolean);
  return value.length > 92 || words.length > 14 || /[.!?]\s/.test(value);
}

function classifyFieldKind(
  definition: CatalogPresentationFieldDefinition,
  displayStat: ForgeCatalogDisplayStat | null
): CatalogFieldKind {
  if (!displayStat?.value) return "normal";
  if (isLongSentenceValue(displayStat.value)) return "detail";
  if (displayStat.parts?.length) return "detail";
  if (displayStat.tone === "positive") return "highlight";
  if (isChipField(definition.key, displayStat.label, displayStat.value)) return "chip";
  return "normal";
}

function buildPresentationField(
  definition: CatalogPresentationFieldDefinition,
  item: ForgeCatalogItem
): CatalogPresentationField {
  const displayStat = getFieldDisplayStat(definition, item);
  return {
    key: definition.key,
    label: displayStat?.label ?? definition.label,
    value: displayStat?.value ?? null,
    parts: displayStat?.parts,
    tone: displayStat?.tone,
    kind: classifyFieldKind(definition, displayStat)
  };
}

function buildItemPresentation(
  item: ForgeCatalogItem,
  config: ForgeCatalogConfig,
  fieldDefinitions: CatalogPresentationFieldDefinition[]
): CatalogItemPresentation {
  const descriptionKey = getPrimaryDescriptionKey(config);
  return {
    id: item.id,
    title: item.name,
    image: resolveImageSrc(item.image ?? null),
    description: descriptionKey ? normalizeValue(item[descriptionKey]) : null,
    fields: fieldDefinitions.map((definition) => buildPresentationField(definition, item))
  };
}

function presentationHasWideContent(presentation: CatalogItemPresentation): boolean {
  return (
    presentation.title.length > 34 ||
    Boolean(presentation.description && isLongSentenceValue(presentation.description)) ||
    presentation.fields.some((field) => field.kind === "detail" || Boolean(field.value && isLongSentenceValue(field.value)))
  );
}

function renderMissingValue() {
  return <span className="text-xs text-muted">-</span>;
}

function renderFieldValue(field: CatalogPresentationField, size: "card" | "table" = "card") {
  if (!field.value) return renderMissingValue();
  const textWrapClass =
    size === "table"
      ? "[word-break:normal] [overflow-wrap:break-word] [hyphens:none] [text-wrap:pretty]"
      : "[overflow-wrap:anywhere]";

  if (field.kind === "chip") {
    return (
      <span
        className={`inline-flex max-w-full items-center rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-semibold leading-snug text-foreground ${textWrapClass}`}
      >
        <span className="min-w-0 whitespace-normal">{field.value}</span>
      </span>
    );
  }

  if (field.parts?.length) {
    return (
      <ul className={size === "table" ? "space-y-1" : "space-y-1.5"}>
        {field.parts.map((part, index) => (
          <li key={`${field.key}-${part}-${index}`} className={`leading-snug ${textWrapClass} ${getFieldToneClass(field)}`}>
            {part}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <span
      className={`block leading-snug ${textWrapClass} ${
        field.kind === "detail" ? "text-sm font-medium" : "text-sm font-semibold"
      } ${getFieldToneClass(field)}`}
    >
      {field.value}
    </span>
  );
}

function shouldStackCardField(field: CatalogPresentationField): boolean {
  return field.kind === "detail" || Boolean(field.parts?.length);
}

function CatalogImagePlaceholder({ title, compact = false }: { title: string; compact?: boolean }) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => (word.match(/[A-Za-z0-9]/)?.[0] ?? "").toUpperCase())
    .filter(Boolean)
    .join("");

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-muted/70 px-4 text-center">
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-md border border-border/70 bg-background/80 font-semibold text-muted ${
          compact ? "h-14 w-14 text-base" : "h-20 w-20 text-2xl"
        }`}
      >
        {initials || "?"}
      </span>
      <span className={`${compact ? "sr-only" : "line-clamp-2 text-xs font-semibold leading-snug text-muted"}`}>
        {title}
      </span>
    </div>
  );
}

function CatalogImageFrame({
  presentation,
  showImage,
  compact = false
}: {
  presentation: CatalogItemPresentation;
  showImage: boolean;
  compact?: boolean;
}) {
  if (!showImage) return null;

  const frameClass = compact
    ? "flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl bg-surface-muted/70 p-3"
    : "relative aspect-[4/3] w-full overflow-hidden border-b border-border/60 bg-background/50";

  if (!presentation.image) {
    return (
      <div className={frameClass}>
        <CatalogImagePlaceholder title={presentation.title} compact={compact} />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <button
        type="button"
        data-catalog-image-preview
        data-catalog-image-src={presentation.image}
        data-catalog-image-alt={presentation.title}
        className="group/image relative flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        aria-label={`Open larger image for ${presentation.title}`}
      >
        {compact ? (
          <Image
            src={presentation.image}
            alt={presentation.title}
            width={160}
            height={160}
            className="h-36 w-36 object-contain transition duration-300 group-hover/image:scale-[1.04]"
            unoptimized
          />
        ) : (
          <Image
            src={presentation.image}
            alt={presentation.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1440px) 33vw, 25vw"
            className="object-contain p-5 transition duration-300 group-hover/image:scale-[1.03]"
            unoptimized
          />
        )}
      </button>
    </div>
  );
}

function ForgeItemCard({
  presentation,
  showImage
}: {
  presentation: CatalogItemPresentation;
  showImage: boolean;
}) {
  return (
    <article
      id={`item-${presentation.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:border-accent/55"
    >
      <CatalogImageFrame presentation={presentation} showImage={showImage} />
      <div className="flex flex-1 flex-col p-4">
        <div className="min-h-[5.75rem] space-y-2">
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-foreground [word-break:normal] [overflow-wrap:break-word] [hyphens:none] [text-wrap:balance]">
            {presentation.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">
            {presentation.description || "-"}
          </p>
        </div>

        <dl className="mt-4 space-y-3 border-t border-border/60 pt-4">
          {presentation.fields.map((field) => {
            const stackField = shouldStackCardField(field);
            return (
              <div
                key={field.key}
                className={
                  stackField
                    ? "space-y-1.5"
                    : "grid grid-cols-[minmax(6.5rem,0.4fr)_minmax(0,1fr)] gap-3"
                }
              >
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{field.label}</dt>
                <dd className="min-w-0 text-sm">{renderFieldValue(field)}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </article>
  );
}

const TINY_TABLE_FIELD_KEYS = new Set([
  "tier",
  "rank",
  "level",
  "stage",
  "sea",
  "status",
  "displayStage",
  "displayLevel",
  "visualStage"
]);

const COMPACT_TABLE_FIELD_KEYS = new Set([
  "rarity",
  "displayRarity",
  "type",
  "itemType",
  "family",
  "category",
  "sourceType",
  "availability",
  "available",
  "obtainable",
  "metaTier"
]);

const WIDE_TABLE_FIELD_KEYS = new Set([
  "obtainment",
  "obtainmentMethod",
  "unlock",
  "unlockRoute",
  "source",
  "sourceRoute",
  "requirements",
  "requirement",
  "bestUse",
  "bestFor",
  "huntBehavior",
  "weaknessTip",
  "idTip",
  "tips",
  "notes"
]);

function getTableFieldColumnClass(
  definition: CatalogPresentationFieldDefinition,
  presentations: CatalogItemPresentation[]
): string {
  const key = definition.key;
  const sampleFields = presentations
    .map((presentation) => presentation.fields.find((field) => field.key === key))
    .filter(Boolean) as CatalogPresentationField[];
  const hasDetail = definition.source === "description" || sampleFields.some((field) => field.kind === "detail");
  const hasLongValue = sampleFields.some((field) => Boolean(field.value && field.value.length > 54));
  const hasChip = sampleFields.some((field) => field.kind === "chip");

  if (TINY_TABLE_FIELD_KEYS.has(key)) {
    return "w-[5.75rem] min-w-[5.75rem] max-w-[5.75rem]";
  }

  if (COMPACT_TABLE_FIELD_KEYS.has(key)) {
    return "w-[8rem] min-w-[8rem] max-w-[8rem]";
  }

  if (WIDE_TABLE_FIELD_KEYS.has(key) || hasDetail || hasLongValue) {
    return "w-[13rem] min-w-[13rem] max-w-[17rem]";
  }

  if (hasChip) {
    return "w-[10rem] min-w-[10rem] max-w-[12rem]";
  }

  return "w-[10rem] min-w-[10rem] max-w-[14rem]";
}

function ForgeItemTable({
  presentations,
  fieldDefinitions,
  showImages,
  descriptionLabel
}: {
  presentations: CatalogItemPresentation[];
  fieldDefinitions: CatalogPresentationFieldDefinition[];
  showImages: boolean;
  descriptionLabel: string | null;
}) {
  const fieldColumnClasses = new Map(
    fieldDefinitions.map((definition) => [definition.key, getTableFieldColumnClass(definition, presentations)])
  );

  return (
    <div className="table-scroll-wrapper">
      <div className="table-scroll-inner game-copy">
        <table>
          <thead>
            <tr>
              {showImages ? <th className="table-col-compact">Image</th> : null}
              <th className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem]">Name</th>
              {descriptionLabel ? <th className="w-[13rem] min-w-[13rem] max-w-[18rem]">{descriptionLabel}</th> : null}
              {fieldDefinitions.map((field) => (
                <th key={field.key} className={fieldColumnClasses.get(field.key)}>
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {presentations.map((presentation) => {
              const fieldsByKey = new Map(presentation.fields.map((field) => [field.key, field]));

              return (
                <tr key={presentation.id} id={`item-${presentation.id}-row`}>
                  {showImages ? (
                    <td className="table-col-compact">
                      <div className="flex items-center justify-center">
                        <CatalogImageFrame presentation={presentation} showImage={showImages} compact />
                      </div>
                    </td>
                  ) : null}
                  <td className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem]">
                    <span className="block font-semibold text-foreground [word-break:normal] [overflow-wrap:break-word] [hyphens:none] [text-wrap:balance]">
                      {presentation.title}
                    </span>
                  </td>
                  {descriptionLabel ? (
                    <td className="w-[13rem] min-w-[13rem] max-w-[18rem]">
                      {presentation.description ? (
                        <span className="block text-sm text-muted [word-break:normal] [overflow-wrap:break-word] [hyphens:none] [text-wrap:pretty]">
                          {presentation.description}
                        </span>
                      ) : (
                        renderMissingValue()
                      )}
                    </td>
                  ) : null}
                  {fieldDefinitions.map((definition) => {
                    const field = fieldsByKey.get(definition.key);
                    return (
                      <td key={definition.key} className={fieldColumnClasses.get(definition.key)}>
                        {field ? renderFieldValue(field, "table") : renderMissingValue()}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ForgeCatalogView({ sections, config, pagination, toolbar }: ForgeCatalogViewProps) {
  const hasItems = sections.some((section) => section.items.length > 0);
  const totalItemCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const fieldDefinitions = buildFieldDefinitions(config);
  const descriptionKey = getPrimaryDescriptionKey(config);
  const descriptionLabel = descriptionKey ? getDescriptionLabel(descriptionKey) : null;
  const showImages = !config.hideImages;
  const sectionPresentations = sections.map((section) => ({
    section,
    items: section.items.map((item) => buildItemPresentation(item, config, fieldDefinitions))
  }));
  const hasWideCardContent = sectionPresentations.some(({ items }) => items.some(presentationHasWideContent));
  const renderCards = totalItemCount <= 600;
  const renderList = true;
  const defaultView = renderCards ? "cards" : "list";
  const cardGridClass = hasWideCardContent
    ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
    : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  if (!hasItems) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No {config.label.toLowerCase()} data has been collected yet. Check back soon.
      </div>
    );
  }

  return (
    <ForgeCatalogViewShell availableViews={renderCards ? ["cards", "list"] : ["list"]} defaultView={defaultView} toolbar={toolbar}>
      <CatalogImageLightbox containerId="game-catalog-items" />
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
      <div id="game-catalog-items" className="space-y-12">
        {sectionPresentations.map(({ section, items }) => (
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
                <div className={cardGridClass}>
                  {items.map((presentation) => (
                    <ForgeItemCard key={presentation.id} presentation={presentation} showImage={showImages} />
                  ))}
                </div>
              </div>
            ) : null}
            {renderList ? (
              <div className="forge-catalog-list-view">
                <ForgeItemTable
                  presentations={items}
                  fieldDefinitions={fieldDefinitions}
                  showImages={showImages}
                  descriptionLabel={descriptionLabel}
                />
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
