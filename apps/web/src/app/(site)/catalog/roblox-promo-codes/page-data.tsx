import Link from "next/link";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { MoreCatalogs } from "@/components/more-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { RobloxCatalogItemCard } from "@/components/RobloxCatalogItemCard";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { listFreeItems, type FreeItem } from "@/lib/db";
import { renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import { publicContentCache } from "@/lib/public-content-cache";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabase";
import { PromoRewardSections, type PromoRewardClaimType, type PromoRewardItem } from "./PromoRewardsBrowser";

export const BASE_PATH = "/catalog/roblox-promo-codes";
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;

type PromoRewardRow = {
  id: string;
  asset_id: number;
  reward_name: string;
  official_name: string | null;
  claim_type: PromoRewardClaimType;
  promo_code: string | null;
  event_name: string | null;
  requirement_text: string | null;
  destination_url: string | null;
  roblox_item_url: string | null;
  thumbnail_url: string | null;
  status: "source_listed_unverified" | "verified_claimable" | "unavailable" | "expired";
  sort_order: number;
};

function mapPromoReward(row: PromoRewardRow): PromoRewardItem {
  return {
    id: row.id,
    assetId: row.asset_id,
    rewardName: row.official_name?.trim() || row.reward_name,
    claimType: row.claim_type,
    promoCode: row.promo_code,
    eventName: row.event_name,
    requirementText: row.requirement_text,
    destinationUrl: row.destination_url,
    robloxItemUrl: row.roblox_item_url,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    sortOrder: row.sort_order
  };
}

const loadCachedPromoRewards = publicContentCache(
  async (): Promise<{ items: PromoRewardItem[] }> => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("roblox_promo_rewards")
      .select(
        "id, asset_id, reward_name, official_name, claim_type, promo_code, event_name, requirement_text, destination_url, roblox_item_url, thumbnail_url, status, sort_order"
      )
      .in("status", ["source_listed_unverified", "verified_claimable", "unavailable", "expired"])
      .order("sort_order", { ascending: true })
      .order("reward_name", { ascending: true });

    if (error) throw error;
    const rows = (data ?? []) as PromoRewardRow[];
    const publicRows = rows.filter(
      (row) =>
        row.status === "verified_claimable" ||
        row.status === "expired" ||
        row.status === "unavailable" ||
        row.claim_type === "experience_code"
    );

    return { items: publicRows.map(mapPromoReward) };
  },
  ["catalog:roblox-promo-codes:items"],
  { revalidate: 21600, tags: ["catalog-index", "catalog:roblox-promo-codes"] }
);

export async function loadPromoRewards() {
  return loadCachedPromoRewards();
}

export async function loadFreeItemsPreview(): Promise<FreeItem[]> {
  try {
    const { items } = await listFreeItems(1, 20, { sort: "featured" });
    return items;
  } catch (error) {
    console.error("Failed to load promo page free-item preview", error);
    return [];
  }
}

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildItemListSchema(title: string, description: string, items: PromoRewardItem[]) {
  const visibleItems = [...items].sort((left, right) => {
    const sectionRank = (item: PromoRewardItem) => {
      if (item.claimType === "web_promo_code" && item.status === "verified_claimable") return 0;
      if (item.claimType === "experience_code") {
        if (item.destinationUrl?.includes("/5306359293/")) return 1;
        if (item.destinationUrl?.includes("/6901029464/")) return 2;
        return 3;
      }
      return 4;
    };
    return sectionRank(left) - sectionRank(right) || left.sortOrder - right.sortOrder;
  });

  return serializeJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url: CANONICAL,
    numberOfItems: visibleItems.length,
    itemListElement: visibleItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Thing",
        name: item.rewardName,
        identifier: String(item.assetId),
        ...(item.thumbnailUrl ? { image: item.thumbnailUrl } : {}),
        ...(item.robloxItemUrl ? { url: item.robloxItemUrl } : {})
      }
    }))
  });
}

function buildFreeItemsSchema(items: FreeItem[]) {
  return serializeJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "More free Roblox items",
    url: `${SITE_URL.replace(/\/$/, "")}/catalog/free-roblox-items`,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Thing",
        name: item.name,
        url: item.roblox_url,
        ...(item.thumbnail_url ? { image: item.thumbnail_url } : {})
      }
    }))
  });
}

export function renderPromoRewardsPage({
  items,
  freeItems,
  contentHtml
}: {
  items: PromoRewardItem[];
  freeItems: FreeItem[];
  contentHtml: PageContentHtml | null;
}) {
  const title = contentHtml?.title?.trim() || "Roblox Promo Codes and Free Items";
  const description =
    "Find Roblox promo codes and in-game codes for free items, with direct links to the correct Roblox redemption page or experience.";
  const updatedAt = contentHtml?.updatedAt ?? null;
  const introNodes = contentHtml?.introHtml
    ? renderPageContentNodes(contentHtml.introHtml, "promo-rewards-intro")
    : null;
  const descriptionNodes = (contentHtml?.descriptionHtml ?? []).flatMap((entry) =>
    renderPageContentNodes(entry.html, `promo-rewards-description-${entry.key}`)
  );
  const howNodes = contentHtml?.howHtml
    ? renderPageContentNodes(contentHtml.howHtml, "promo-rewards-how")
    : null;
  const faqNodes = (contentHtml?.faqHtml ?? []).map((faq, index) => ({
    id: `${faq.q}-${index}`,
    question: faq.q,
    answer: renderPageContentNodes(faq.a, `promo-rewards-faq-${index}`)
  }));
  const pageSchema = serializeJsonLd(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: BASE_PATH.replace(/^\//, ""),
      title,
      description,
      image: `${SITE_URL}/Bloxodes.png`,
      author: null,
      publishedAt: contentHtml?.publishedAt ?? undefined,
      updatedAt: updatedAt ?? undefined
    })
  );
  const breadcrumbSchema = serializeJsonLd(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: title, url: CANONICAL }
    ])
  );

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Catalog", href: "/catalog" },
            { label: title, href: null }
          ]}
        />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={updatedAt} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes}
        <PromoRewardSections items={items} />
        <CatalogAdSlot />

        {descriptionNodes.length ? descriptionNodes : null}
        {howNodes}

        <section aria-labelledby="free-roblox-items" className="space-y-5">
          <div className="space-y-2">
            <h2 id="free-roblox-items" className="text-2xl font-semibold text-foreground">
              More free Roblox items
            </h2>
            <p>
              Promo codes are not the only way to dress up your avatar for free. Browse these free Marketplace items,
              or <Link href="/catalog/free-roblox-items">see all free Roblox items</Link>.
            </p>
          </div>
          {freeItems.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {freeItems.map((item) => (
                <RobloxCatalogItemCard
                  key={item.asset_id}
                  item={item}
                  categoryLabelMode="taxonomy"
                  nameHeadingLevel="h3"
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-6 text-muted">
              Free Marketplace items are temporarily unavailable here.
            </p>
          )}
          <div>
            <Link
              href="/catalog/free-roblox-items"
              className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
            >
              View all free Roblox items
            </Link>
          </div>
        </section>

        {faqNodes.length ? <ContentFaq items={faqNodes} /> : null}
        <CatalogAdSlot />
      </section>

      {contentHtml?.id ? <CommentsSection entityType="catalog" entityId={contentHtml.id} /> : null}
      <MoreCatalogs excludeCode="roblox-promo-codes" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildItemListSchema(title, description, items) }} />
      {freeItems.length ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildFreeItemsSchema(freeItems) }} />
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
