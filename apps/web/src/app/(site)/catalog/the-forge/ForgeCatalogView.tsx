"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

const FALLBACK_IMAGE = "/og-image.png";

type ForgeCatalogStat = { key: string; label: string };

type ForgeCatalogConfig = {
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

type ForgeCatalogItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: unknown;
};

type ForgeCatalogSection = {
  id: string;
  label: string;
  items: ForgeCatalogItem[];
};

type ViewMode = "cards" | "list";

type ForgeCatalogViewProps = {
  sections: ForgeCatalogSection[];
  config: ForgeCatalogConfig;
};

type ForgeCatalogDisplayStat = {
  label: string;
  value: string;
  parts?: string[];
  tone?: "positive" | "negative" | "neutral";
};

type BooleanishValue = {
  value: boolean;
  detail?: string;
  exact: boolean;
};

const CARD_STAT_OVERRIDES: Record<string, string[]> = {
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

function resolveImageSrc(image: string | null | undefined): string {
  if (!image) return FALLBACK_IMAGE;
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
  return value.replace(/\s+/g, " ").trim();
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
  return {
    label,
    value: displayValue,
    parts: parts ?? undefined
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
  if (stat.tone === "positive") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (stat.tone === "negative") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  return "border-border/70 bg-background/45 text-foreground";
}

function renderValue(value: string | null) {
  if (!value) {
    return <span className="text-xs text-muted">—</span>;
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

function ForgeItemCard({ item, config }: { item: ForgeCatalogItem; config: ForgeCatalogConfig }) {
  const badge = config.badgeKey ? formatBadgeValue(config.badgeKey, item[config.badgeKey]) : null;
  const subtitle = buildSubtitle(item, config);
  const description = config.cardDescriptionKey ? normalizeValue(item[config.cardDescriptionKey]) : null;
  const stats = buildStatEntries(item, config);
  const image = resolveImageSrc(item.image ?? null);
  const showImage = !config.hideImages;

  return (
    <article
      id={`item-${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:border-accent/55"
    >
      {showImage ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-border/60 bg-background/50">
          <Image
            src={image}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1440px) 25vw, 20vw"
            className="object-contain p-5"
            unoptimized
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-2">
          {badge ? (
            <p className="w-fit rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
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
                <div key={`${stat.label}-${index}`} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{stat.label}</dt>
                    <dd className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                      {stat.parts.length.toLocaleString("en-US")}
                    </dd>
                  </div>
                  <dd className="flex flex-wrap gap-1.5">
                    {stat.parts.slice(0, 6).map((part, partIndex) => (
                      <span
                        key={`${part}-${partIndex}`}
                        className="rounded-full border border-border/70 bg-background/45 px-2 py-1 text-xs font-medium leading-snug text-foreground"
                      >
                        {part}
                      </span>
                    ))}
                    {stat.parts.length > 6 ? (
                      <span className="rounded-full border border-border/70 bg-background/45 px-2 py-1 text-xs font-medium leading-snug text-muted">
                        +{stat.parts.length - 6} more
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : (
                <div key={`${stat.label}-${index}`} className="grid grid-cols-[minmax(5rem,0.42fr)_minmax(0,1fr)] gap-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{stat.label}</dt>
                  <dd
                    className={`w-fit max-w-full rounded-full border px-2 py-0.5 text-sm font-semibold leading-snug ${getStatToneClass(stat)}`}
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

              return (
                <tr key={item.id} id={`item-${item.id}`}>
                  {showImages ? (
                    <td className="table-col-compact">
                      <div className="flex items-center justify-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-muted/70 p-1.5">
                          <Image
                            src={resolveImageSrc(item.image ?? null)}
                            alt={item.name}
                            width={80}
                            height={80}
                            className="h-18 w-18 object-contain"
                            unoptimized
                          />
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

export function ForgeCatalogView({ sections, config }: ForgeCatalogViewProps) {
  const [view, setView] = useState<ViewMode>("cards");
  const hasItems = useMemo(
    () => sections.some((section) => section.items.length > 0),
    [sections]
  );

  if (!hasItems) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No {config.label.toLowerCase()} data has been collected yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="catalog-surface space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">View</p>
        <div className="inline-flex rounded-md border border-border/60 bg-surface/70 p-1">
          {([
            { id: "cards", label: "Cards" },
            { id: "list", label: "List" }
          ] as const).map((option) => {
            const isActive = view === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                aria-pressed={isActive}
                className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  isActive
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-12">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="space-y-5 scroll-mt-28">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">{config.groupLabel}</p>
                <h2 className="text-2xl font-semibold text-foreground">{section.label}</h2>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {section.items.length.toLocaleString("en-US")} items
              </span>
            </div>

            {view === "cards" ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {section.items.map((item) => (
                  <ForgeItemCard key={item.id} item={item} config={config} />
                ))}
              </div>
            ) : (
              <ForgeItemTable section={section} config={config} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
