import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { CatalogCard } from "@/components/CatalogCard";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { listPublishedTopLevelCatalogPages } from "@/lib/catalog";
import { formatUpdatedLabel } from "@/lib/updated-label";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Roblox Catalogs | ${SITE_NAME}`,
  description: CATALOG_DESCRIPTION,
  alternates: buildAlternates(`${SITE_URL}/catalog`),
  openGraph: {
    type: "website",
    url: `${SITE_URL}/catalog`,
    title: `Roblox Catalogs | ${SITE_NAME}`,
    description: CATALOG_DESCRIPTION,
    siteName: SITE_NAME
  },
  twitter: {
    card: "summary_large_image",
    title: `Roblox Catalogs | ${SITE_NAME}`,
    description: CATALOG_DESCRIPTION
  }
};

const CATALOG_CARD_TONES = ["indigo", "amber", "emerald"] as const;

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function latestTimestamp(values: Array<number | null>): number | null {
  let latest: number | null = null;
  for (const value of values) {
    if (typeof value !== "number") continue;
    if (latest === null || value > latest) {
      latest = value;
    }
  }
  return latest;
}

function summarizeCatalogDescription(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Open this Roblox catalog hub for the latest published content.";
}

async function buildCatalogCards() {
  const pages = await listPublishedTopLevelCatalogPages();
  const results = pages.map((entry, index) => {
    const updatedAt = entry.content_updated_at ?? entry.updated_at ?? entry.published_at ?? entry.created_at ?? null;
    return {
      id: entry.code,
      href: `/catalog/${entry.code}`,
      title: entry.title,
      description: summarizeCatalogDescription(entry.meta_description),
      category: "Catalog",
      metricLabel: null,
      metricValue: null,
      tileLabel: entry.title,
      coverImage: entry.thumb_url ?? null,
      tone: CATALOG_CARD_TONES[index % CATALOG_CARD_TONES.length],
      updatedLabel: formatUpdatedLabel(updatedAt),
      updatedAt,
      universeId: entry.universe_id ?? null,
      universeName: entry.universe_name ?? null
    };
  });

  const latestUpdated = latestTimestamp(results.map((entry) => parseDate(entry.updatedAt)));
  const genericCards = results.filter((entry) => !entry.universeId);
  const groupedMap = new Map<
    string,
    {
      universeId: number;
      gameName: string;
      items: typeof results;
      latestUpdatedAt: number | null;
    }
  >();

  for (const entry of results) {
    if (!entry.universeId || !entry.universeName) continue;
    const key = `${entry.universeId}:${entry.universeName}`;
    const existing = groupedMap.get(key);
    const updatedTimestamp = parseDate(entry.updatedAt);

    if (existing) {
      existing.items.push(entry);
      existing.latestUpdatedAt = latestTimestamp([existing.latestUpdatedAt, updatedTimestamp]);
      continue;
    }

    groupedMap.set(key, {
      universeId: entry.universeId,
      gameName: entry.universeName,
      items: [entry],
      latestUpdatedAt: updatedTimestamp
    });
  }

  const groupedCatalogs = Array.from(groupedMap.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => {
        const left = parseDate(a.updatedAt) ?? 0;
        const right = parseDate(b.updatedAt) ?? 0;
        return right - left;
      })
    }))
    .sort((a, b) => a.gameName.localeCompare(b.gameName));

  return {
    genericCards,
    groupedCatalogs,
    total: results.length,
    refreshedLabel:
      typeof latestUpdated === "number" ? formatDistanceToNow(new Date(latestUpdated), { addSuffix: true }) : null
  };
}

export default async function CatalogIndexPage() {
  const { genericCards, groupedCatalogs, total, refreshedLabel } = await buildCatalogCards();

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Catalog</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Roblox catalogs organized by item type
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Browse Roblox catalog pages for free items, music IDs, admin commands, promo codes, decal IDs, and more.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
            {total} catalog hub{total === 1 ? "" : "s"}
          </span>
          {refreshedLabel ? (
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
              Updated {refreshedLabel}
            </span>
          ) : null}
        </div>
      </header>

      {genericCards.length ? (
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Catalogs</h2>
            <p className="text-sm text-muted">General catalog hubs that are not tied to a specific game.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {genericCards.map(({ id, updatedAt: _updatedAt, universeId: _universeId, universeName: _universeName, ...card }, index) => (
              <div
                key={id}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="catalog_index"
                data-analytics-item-id={id}
                data-analytics-item-name={card.title}
                data-analytics-position={index + 1}
                data-analytics-content-type="catalog"
              >
                <CatalogCard {...card} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {groupedCatalogs.length ? (
        <section className="space-y-10">
          {groupedCatalogs.map((group) => (
            <div key={`${group.universeId}-${group.gameName}`} className="space-y-5 border-t border-border/60 pt-8 first:border-t-0 first:pt-0">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-foreground">{group.gameName}</h2>
                {typeof group.latestUpdatedAt === "number" ? (
                  <p className="text-sm text-muted">
                    Updated {formatDistanceToNow(new Date(group.latestUpdatedAt), { addSuffix: true })}
                  </p>
                ) : null}
              </div>

              <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-surface/50">
                {group.items.map((card, itemIndex) => (
                  <Link
                    key={card.id}
                    href={card.href}
                    className="block px-5 py-4 transition hover:bg-surface-muted/60"
                    data-analytics-event="select_item"
                    data-analytics-item-list-name={`catalog_index_${group.gameName}`}
                    data-analytics-item-id={card.id}
                    data-analytics-item-name={card.title}
                    data-analytics-position={itemIndex + 1}
                    data-analytics-content-type="catalog"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-6">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
                        <p className="max-w-3xl text-sm text-muted">{card.description}</p>
                      </div>
                      {card.updatedLabel ? (
                        <p className="shrink-0 text-sm text-muted md:text-right">Updated {card.updatedLabel}</p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Catalogs",
            description: CATALOG_DESCRIPTION,
            url: `${SITE_URL}/catalog`
          })
        }}
      />
    </div>
  );
}
