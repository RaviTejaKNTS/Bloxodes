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

function formatKeyLabel(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildSubtitle(item: ForgeCatalogItem, config: ForgeCatalogConfig): string | null {
  if (!config.subtitleKeys?.length) return null;
  const parts = config.subtitleKeys
    .map((key) => normalizeValue(item[key]))
    .filter(Boolean)
    .slice(0, 2) as string[];
  if (!parts.length) return null;
  return parts.join(" • ");
}

function buildStatEntries(item: ForgeCatalogItem, config: ForgeCatalogConfig) {
  const statMap = new Map(
    (config.stats ?? []).map((stat) => [
      stat.key,
      {
        label: stat.label,
        value: normalizeValue(item[stat.key])
      }
    ])
  );

  const preferredKeys = CARD_STAT_OVERRIDES[config.slug] ?? (config.stats ?? []).map((stat) => stat.key);

  const stats = preferredKeys
    .map((key) => {
      const stat = statMap.get(key);
      const value = stat?.value ?? normalizeValue(item[key]);
      if (!value) return null;
      return {
        label: stat?.label ?? formatKeyLabel(key),
        value
      };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;

  if (!stats.length) return [];
  const maxStats = config.maxStats ?? stats.length;
  return stats.slice(0, maxStats);
}

function renderValue(value: string | null) {
  if (!value) {
    return <span className="text-xs text-muted">—</span>;
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

function ForgeItemCard({ item, config }: { item: ForgeCatalogItem; config: ForgeCatalogConfig }) {
  const badge = config.badgeKey ? normalizeValue(item[config.badgeKey]) : null;
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
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-2">
          {badge ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{badge}</p>
          ) : null}
          <h3 className="text-xl font-semibold leading-snug text-foreground">{item.name}</h3>
          {subtitle ? (
            <p className="text-sm leading-relaxed text-muted line-clamp-2">{subtitle}</p>
          ) : null}
          {description ? (
            <p className="text-sm leading-relaxed text-muted line-clamp-3">{description}</p>
          ) : null}
        </div>

        {stats.length ? (
          <dl className="mt-auto space-y-2">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-start justify-between gap-4">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{stat.label}</dt>
                <dd className="text-right text-sm font-semibold leading-snug text-foreground">{stat.value}</dd>
              </div>
            ))}
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
              const badgeValue = config.badgeKey ? normalizeValue(item[config.badgeKey]) : null;

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
                      {renderValue(normalizeValue(item[stat.key]))}
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
