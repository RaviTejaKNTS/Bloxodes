import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { CatalogCard } from "@/components/CatalogCard";
import { resolveCatalogCardMeta, type CatalogIconKey } from "@/lib/catalog-card-meta";
import { IndexPageStats } from "@/components/IndexPageStats";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { listPublishedTopLevelCatalogPages } from "@/lib/catalog";
import {
  AVATAR_CATALOG_FAMILY_CODES,
  AVATAR_CATALOG_LEGACY_FAMILY_CODES,
  AVATAR_CATALOG_LEGACY_MASTER_CODE,
  AVATAR_CATALOG_MASTER_CODE,
  AVATAR_CATALOG_MASTER_TITLE
} from "@/lib/roblox-avatar-catalog";
import { formatUpdatedLabel } from "@/lib/updated-label";

export const revalidate = 21600;

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
const GENERAL_CATALOG_ORDER = [
  AVATAR_CATALOG_MASTER_CODE,
  "roblox-music-ids",
  "free-roblox-items",
  "roblox-promo-codes",
  "roblox-decal-ids",
  "roblox-font-ids",
  "roblox-mesh-ids",
  "roblox-color-codes",
  "admin-commands"
];
const AVATAR_CATALOG_CHILD_CODES = new Set<string>(
  [
    ...AVATAR_CATALOG_FAMILY_CODES.filter((code) => code !== AVATAR_CATALOG_MASTER_CODE),
    ...AVATAR_CATALOG_LEGACY_FAMILY_CODES
  ]
);

type CatalogIndexCard = {
  id: string;
  href: string;
  title: string;
  description: string;
  count: number | null;
  unit: string | null;
  iconKey: CatalogIconKey | null;
  coverImage: string | null;
  tone: (typeof CATALOG_CARD_TONES)[number];
  updatedLabel: string | null;
  updatedAt: string | null;
  universeId: number | null;
  universeName: string | null;
};

function normalizeCatalogIndexCode(code: string): string {
  return code === AVATAR_CATALOG_LEGACY_MASTER_CODE ? AVATAR_CATALOG_MASTER_CODE : code;
}

function shouldShowOnCatalogIndex(card: CatalogIndexCard): boolean {
  if (card.universeId) return false;
  return !AVATAR_CATALOG_CHILD_CODES.has(card.id);
}

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

function getOrderedCatalogCards(cards: CatalogIndexCard[], order: readonly string[]): CatalogIndexCard[] {
  const orderMap = new Map(order.map((code, index) => [code, index]));
  return [...cards].sort((a, b) => {
    const left = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const right = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (left !== right) return left - right;

    const leftUpdated = parseDate(a.updatedAt) ?? 0;
    const rightUpdated = parseDate(b.updatedAt) ?? 0;
    if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated;

    return a.title.localeCompare(b.title);
  });
}

async function buildCatalogCards() {
  const pages = await listPublishedTopLevelCatalogPages();
  const pagesWithMeta = await Promise.all(
    pages.map(async (entry, index) => ({
      entry,
      index,
      normalizedCode: normalizeCatalogIndexCode(entry.code),
      meta: await resolveCatalogCardMeta(normalizeCatalogIndexCode(entry.code))
    }))
  );
  const resultsById = new Map<string, CatalogIndexCard>();
  for (const { entry, index, normalizedCode, meta } of pagesWithMeta) {
    const updatedAt = entry.content_updated_at ?? entry.updated_at ?? entry.published_at ?? entry.created_at ?? null;
    const existing = resultsById.get(normalizedCode);
    const next: CatalogIndexCard = {
      id: normalizedCode,
      href: `/catalog/${normalizedCode}`,
      title:
        meta.shortLabel ??
        (normalizedCode === AVATAR_CATALOG_MASTER_CODE ? AVATAR_CATALOG_MASTER_TITLE : entry.title),
      description:
        normalizedCode === AVATAR_CATALOG_MASTER_CODE
          ? "Browse Roblox Marketplace items and bundles by type, price, creator, sale status, favorites, and limited state."
          : summarizeCatalogDescription(entry.meta_description),
      count: meta.count,
      unit: meta.unit,
      iconKey: meta.icon,
      coverImage: entry.thumb_url ?? null,
      tone: CATALOG_CARD_TONES[index % CATALOG_CARD_TONES.length],
      updatedLabel: formatUpdatedLabel(updatedAt),
      updatedAt,
      universeId: entry.universe_id ?? null,
      universeName: entry.universe_name ?? null
    };
    if (!existing || (parseDate(next.updatedAt) ?? 0) > (parseDate(existing.updatedAt) ?? 0)) {
      resultsById.set(normalizedCode, next);
    }
  }

  const results = Array.from(resultsById.values());

  const groupedItems: CatalogIndexCard[] = [];
  for (const entry of results) {
    if (entry.universeId) groupedItems.push(entry);
  }
  const visibleResults = results.filter((entry) => shouldShowOnCatalogIndex(entry) || entry.universeId);
  const latestUpdated = latestTimestamp(visibleResults.map((entry) => parseDate(entry.updatedAt)));
  const genericCards = getOrderedCatalogCards(
    results.filter(shouldShowOnCatalogIndex),
    GENERAL_CATALOG_ORDER
  );
  const groupedMap = new Map<
    string,
    {
      universeId: number;
      gameName: string;
      items: CatalogIndexCard[];
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
    total: genericCards.length + groupedItems.length,
    refreshedLabel:
      typeof latestUpdated === "number" ? formatDistanceToNow(new Date(latestUpdated), { addSuffix: true }) : null
  };
}

export default async function CatalogIndexPage() {
  const { genericCards, groupedCatalogs, total, refreshedLabel } = await buildCatalogCards();

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Roblox catalogs organized by item type
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Browse Roblox catalog pages for free items, music IDs, admin commands, promo codes, decal IDs, and more.
        </p>
        <IndexPageStats
          items={[
            { label: `${total} catalog hub${total === 1 ? "" : "s"}`, icon: "catalog", tone: "accent" },
            ...(refreshedLabel ? [{ label: `Updated ${refreshedLabel}`, icon: "clock" as const }] : [])
          ]}
        />
      </header>

      {genericCards.length ? (
        <section className="space-y-6">
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

              <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-surface/50">
                {group.items.map((card, itemIndex) => (
                  <Link
                    key={card.id}
                    href={card.href}
                    className="block px-5 py-4 transition hover:bg-surface-muted/45"
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
