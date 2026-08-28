import Image from "next/image";
import { Fragment, type ReactNode } from "react";
import { PagePagination } from "@/components/PagePagination";
import type { CollectionPaginationInfo } from "./collection-pagination";
import { CollectionImageLightbox } from "./CollectionImageLightbox";
import { GameCollectionViewShell } from "./GameCollectionViewShell";

type GameCollectionStat = { key: string; label: string };

export type CollectionFieldKind = "normal" | "highlight" | "chip" | "detail";
export type CollectionFieldTone = "positive" | "negative" | "warning" | "neutral";
export type CollectionFieldPresentation = {
  kind: CollectionFieldKind;
  label?: string;
  tone?: CollectionFieldTone;
  omitWhenEmpty?: boolean;
};

export type GameCollectionViewConfig = {
  slug: string;
  label: string;
  groupLabel: string;
  stats?: GameCollectionStat[];
  maxStats?: number;
  badgeKey?: string;
  subtitleKeys?: string[];
  descriptionKey?: string;
  cardDescriptionKey?: string;
  cardFields?: string[];
  fieldPresentation?: Record<string, CollectionFieldPresentation | CollectionFieldKind>;
  hideImages?: boolean;
};

export type GameCollectionItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: unknown;
};

export type GameCollectionSection = {
  id: string;
  label: string;
  items: GameCollectionItem[];
  noteHtml?: string | null;
  noteNodes?: ReactNode[] | null;
  totalItemCount?: number;
  isContinuation?: boolean;
  startPage?: number;
  startHref?: string;
};

type GameCollectionViewProps = {
  sections: GameCollectionSection[];
  config: GameCollectionViewConfig;
  pagination?: CollectionPaginationInfo | null;
  toolbar?: ReactNode;
};

type GameCollectionDisplayStat = {
  label: string;
  value: string;
  parts?: string[];
  tone?: CollectionFieldTone;
};

type CollectionPresentationFieldDefinition = {
  key: string;
  label: string;
  source: "badge" | "subtitle" | "stat" | "description";
  presentation?: CollectionFieldPresentation;
};

type CollectionPresentationField = {
  key: string;
  label: string;
  value: string | null;
  kind: CollectionFieldKind;
  tone?: GameCollectionDisplayStat["tone"];
  parts?: string[];
  omitWhenEmpty?: boolean;
};

type CollectionItemPresentation = {
  id: string;
  title: string;
  image: string | null;
  description: string | null;
  fields: CollectionPresentationField[];
};

type BooleanishValue = {
  value: boolean;
  detail?: string;
  exact: boolean;
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

function formatBooleanStat(label: string, value: string): GameCollectionDisplayStat | null {
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

function getStatusTone(label: string, value: string): GameCollectionDisplayStat["tone"] | null {
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

function buildDisplayStat(label: string, value: unknown): GameCollectionDisplayStat | null {
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

function getFieldToneClass(field: CollectionPresentationField): string {
  if (field.tone === "negative") return "text-rose-300";
  if (field.tone === "warning") return "text-amber-300";
  if (field.kind === "highlight") return "text-emerald-300";
  return "text-foreground";
}

function normalizeFieldPresentation(value: CollectionFieldPresentation | CollectionFieldKind | undefined): CollectionFieldPresentation | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? { kind: value } : value;
}

function getConfiguredFieldPresentation(config: GameCollectionViewConfig, key: string): CollectionFieldPresentation | undefined {
  return normalizeFieldPresentation(config.fieldPresentation?.[key]);
}

function addUniqueField(
  fields: CollectionPresentationFieldDefinition[],
  seen: Set<string>,
  definition: CollectionPresentationFieldDefinition | null
) {
  if (!definition || seen.has(definition.key)) return;
  seen.add(definition.key);
  fields.push(definition);
}

function getPrimaryDescriptionKey(config: GameCollectionViewConfig): string | null {
  return config.cardDescriptionKey ?? config.descriptionKey ?? null;
}

function buildFieldDefinitions(config: GameCollectionViewConfig): CollectionPresentationFieldDefinition[] {
  const fields: CollectionPresentationFieldDefinition[] = [];
  const seen = new Set<string>();
  const descriptionKey = getPrimaryDescriptionKey(config);
  const statMap = new Map((config.stats ?? []).map((stat) => [stat.key, stat.label]));
  const preferredKeys = config.cardFields ?? (config.stats ?? []).map((stat) => stat.key);

  addUniqueField(
    fields,
    seen,
    config.badgeKey && config.badgeKey !== descriptionKey
      ? {
          key: config.badgeKey,
          label: getConfiguredFieldPresentation(config, config.badgeKey)?.label ?? formatKeyLabel(config.badgeKey),
          source: "badge",
          presentation: getConfiguredFieldPresentation(config, config.badgeKey)
        }
      : null
  );

  for (const key of config.subtitleKeys ?? []) {
    addUniqueField(
      fields,
      seen,
      key !== descriptionKey
        ? {
            key,
            label: getConfiguredFieldPresentation(config, key)?.label ?? formatKeyLabel(key),
            source: "subtitle",
            presentation: getConfiguredFieldPresentation(config, key)
          }
        : null
    );
  }

  for (const key of preferredKeys) {
    const presentation = getConfiguredFieldPresentation(config, key);
    addUniqueField(
      fields,
      seen,
      key !== descriptionKey
        ? { key, label: presentation?.label ?? statMap.get(key) ?? formatKeyLabel(key), source: "stat", presentation }
        : null
    );
  }

  for (const stat of config.stats ?? []) {
    const presentation = getConfiguredFieldPresentation(config, stat.key);
    addUniqueField(
      fields,
      seen,
      stat.key !== descriptionKey
        ? { key: stat.key, label: presentation?.label ?? stat.label, source: "stat", presentation }
        : null
    );
  }

  if (config.descriptionKey && config.descriptionKey !== descriptionKey) {
    const presentation = getConfiguredFieldPresentation(config, config.descriptionKey);
    addUniqueField(fields, seen, {
      key: config.descriptionKey,
      label: presentation?.label ?? getDescriptionLabel(config.descriptionKey),
      source: "description",
      presentation
    });
  }

  if (config.cardDescriptionKey && config.cardDescriptionKey !== descriptionKey) {
    const presentation = getConfiguredFieldPresentation(config, config.cardDescriptionKey);
    addUniqueField(fields, seen, {
      key: config.cardDescriptionKey,
      label: presentation?.label ?? getDescriptionLabel(config.cardDescriptionKey),
      source: "description",
      presentation
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

function getFieldDisplayStat(definition: CollectionPresentationFieldDefinition, item: GameCollectionItem) {
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
  definition: CollectionPresentationFieldDefinition,
  displayStat: GameCollectionDisplayStat | null
): CollectionFieldKind {
  if (!displayStat?.value) return "normal";
  if (definition.presentation?.kind) return definition.presentation.kind;
  if (isLongSentenceValue(displayStat.value)) return "detail";
  if (displayStat.parts?.length) return "detail";
  if (displayStat.tone === "positive") return "highlight";
  if (isChipField(definition.key, displayStat.label, displayStat.value)) return "chip";
  return "normal";
}

function buildPresentationField(
  definition: CollectionPresentationFieldDefinition,
  item: GameCollectionItem
): CollectionPresentationField {
  const displayStat = getFieldDisplayStat(definition, item);
  const configured = Boolean(definition.presentation);
  return {
    key: definition.key,
    label: definition.presentation?.label ?? displayStat?.label ?? definition.label,
    value: displayStat?.value ?? null,
    parts: configured ? undefined : displayStat?.parts,
    tone: definition.presentation?.tone ?? displayStat?.tone,
    kind: classifyFieldKind(definition, displayStat),
    omitWhenEmpty: definition.presentation?.omitWhenEmpty
  };
}

function buildItemPresentation(
  item: GameCollectionItem,
  config: GameCollectionViewConfig,
  fieldDefinitions: CollectionPresentationFieldDefinition[]
): CollectionItemPresentation {
  const descriptionKey = getPrimaryDescriptionKey(config);
  return {
    id: item.id,
    title: item.name,
    image: resolveImageSrc(item.image ?? null),
    description: descriptionKey ? normalizeValue(item[descriptionKey]) : null,
    fields: fieldDefinitions.map((definition) => buildPresentationField(definition, item))
  };
}

function presentationHasWideContent(presentation: CollectionItemPresentation): boolean {
  return (
    presentation.title.length > 34 ||
    Boolean(presentation.description && isLongSentenceValue(presentation.description)) ||
    presentation.fields.some((field) => field.kind === "detail" || Boolean(field.value && isLongSentenceValue(field.value)))
  );
}

function renderMissingValue() {
  return <span className="text-xs text-muted">-</span>;
}

function getCardFieldRowClass(field: CollectionPresentationField) {
  const base = "grid grid-cols-[minmax(7.75rem,0.42fr)_minmax(0,1fr)] items-start gap-4";
  if (field.kind === "detail") return `${base} min-h-[4.75rem]`;
  return `${base} min-h-[2.75rem]`;
}

function renderFieldValue(field: CollectionPresentationField, size: "card" | "table" = "card") {
  if (!field.value) return renderMissingValue();
  const textWrapClass =
    size === "table"
      ? "[word-break:normal] [overflow-wrap:break-word] [hyphens:none] [text-wrap:pretty]"
      : "[overflow-wrap:anywhere]";
  const clampClass = size === "card" ? (field.kind === "detail" ? "line-clamp-3" : "line-clamp-2") : "";

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
      className={`block leading-snug ${textWrapClass} ${clampClass} ${
        field.kind === "detail" ? "text-sm font-medium" : "text-sm font-semibold"
      } ${getFieldToneClass(field)}`}
    >
      {field.value}
    </span>
  );
}

function CollectionImagePlaceholder({ title, compact = false }: { title: string; compact?: boolean }) {
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

function CollectionImageFrame({
  presentation,
  showImage,
  compact = false
}: {
  presentation: CollectionItemPresentation;
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
        <CollectionImagePlaceholder title={presentation.title} compact={compact} />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <button
        type="button"
        data-collection-image-preview
        data-collection-image-src={presentation.image}
        data-collection-image-alt={presentation.title}
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
  presentation: CollectionItemPresentation;
  showImage: boolean;
}) {
  return (
    <article
      id={`item-${presentation.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:border-accent/55"
    >
      <CollectionImageFrame presentation={presentation} showImage={showImage} />
      <div className="flex flex-1 flex-col p-4">
        <div className="min-h-[5.75rem] space-y-2">
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-foreground [word-break:normal] [overflow-wrap:break-word] [hyphens:none] [text-wrap:balance]">
            {presentation.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">
            {presentation.description || "-"}
          </p>
        </div>

        <dl className="mt-4 space-y-3 border-t border-border/60 pt-4">
          {presentation.fields
            .filter((field) => !(field.omitWhenEmpty && !field.value))
            .map((field) => (
              <div key={field.key} className={getCardFieldRowClass(field)}>
                <dt className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted [overflow-wrap:break-word]">
                  {field.label}
                </dt>
                <dd className="min-w-0 text-sm">{renderFieldValue(field)}</dd>
              </div>
            ))}
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
  definition: CollectionPresentationFieldDefinition,
  presentations: CollectionItemPresentation[]
): string {
  const key = definition.key;
  const sampleFields = presentations
    .map((presentation) => presentation.fields.find((field) => field.key === key))
    .filter(Boolean) as CollectionPresentationField[];
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
  presentations: CollectionItemPresentation[];
  fieldDefinitions: CollectionPresentationFieldDefinition[];
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
                        <CollectionImageFrame presentation={presentation} showImage={showImages} compact />
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

export function GameCollectionView({ sections, config, pagination, toolbar }: GameCollectionViewProps) {
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

  if (!hasItems) {
    return (
      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--collection">
        <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No {config.label.toLowerCase()} data has been collected yet. Check back soon.
        </div>
      </section>
    );
  }

  return (
    <GameCollectionViewShell availableViews={renderCards ? ["cards", "list"] : ["list"]} defaultView={defaultView} toolbar={toolbar}>
      <CollectionImageLightbox containerId="article-body" />
      <section
        id="article-body"
        itemProp="articleBody"
        className={`journey-content-stream journey-content-stream--collection${hasWideCardContent ? " journey-content-stream--collection-wide" : ""}`}
      >
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

        {sectionPresentations.map(({ section, items }) => (
          <Fragment key={section.id}>
            <div id={section.id} className="space-y-5 scroll-mt-28">
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
            </div>

            {renderCards
              ? items.map((presentation) => (
                  <div key={presentation.id} data-journey-item className="game-collection-card-item h-full">
                    <ForgeItemCard presentation={presentation} showImage={showImages} />
                  </div>
                ))
              : null}

            {renderList ? (
              <div className="game-collection-list-view">
                <ForgeItemTable
                  presentations={items}
                  fieldDefinitions={fieldDefinitions}
                  showImages={showImages}
                  descriptionLabel={descriptionLabel}
                />
              </div>
            ) : null}
          </Fragment>
        ))}

        {pagination && pagination.totalPages > 1 ? (
          <PagePagination
            basePath={pagination.basePath}
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-6"
          />
        ) : null}
      </section>
    </GameCollectionViewShell>
  );
}
