import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { MoreCatalogs } from "@/components/more-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import { publicContentCache } from "@/lib/public-content-cache";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabase";
import { PromoRewardsBrowser, type PromoRewardClaimType, type PromoRewardItem } from "./PromoRewardsBrowser";

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
  claim_instructions: string | null;
  destination_url: string | null;
  roblox_item_url: string | null;
  thumbnail_url: string | null;
  status: "source_listed_unverified" | "verified_claimable" | "unavailable" | "expired";
  sort_order: number;
  last_checked_at: string;
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
    claimInstructions: row.claim_instructions,
    destinationUrl: row.destination_url,
    robloxItemUrl: row.roblox_item_url,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    sortOrder: row.sort_order
  };
}

const loadCachedPromoRewards = publicContentCache(
  async (): Promise<{ items: PromoRewardItem[]; updatedAt: string | null }> => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("roblox_promo_rewards")
      .select(
        "id, asset_id, reward_name, official_name, claim_type, promo_code, event_name, requirement_text, claim_instructions, destination_url, roblox_item_url, thumbnail_url, status, sort_order, last_checked_at"
      )
      .in("status", ["source_listed_unverified", "verified_claimable", "unavailable", "expired"])
      .order("sort_order", { ascending: true })
      .order("reward_name", { ascending: true });

    if (error) throw error;
    const rows = (data ?? []) as PromoRewardRow[];
    const updatedAt = rows.reduce<string | null>((latest, row) => {
      if (!latest) return row.last_checked_at;
      return Date.parse(row.last_checked_at) > Date.parse(latest) ? row.last_checked_at : latest;
    }, null);

    return { items: rows.map(mapPromoReward), updatedAt };
  },
  ["catalog:roblox-promo-codes:items"],
  { revalidate: 21600, tags: ["catalog-index", "catalog:roblox-promo-codes"] }
);

export async function loadPromoRewards() {
  return loadCachedPromoRewards();
}

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildItemListSchema(title: string, description: string, items: PromoRewardItem[]) {
  return serializeJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url: CANONICAL,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
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

export function renderPromoRewardsPage({
  items,
  contentHtml,
  sourceUpdatedAt
}: {
  items: PromoRewardItem[];
  contentHtml: PageContentHtml | null;
  sourceUpdatedAt: string | null;
}) {
  const title = contentHtml?.title?.trim() || "Roblox Promo Codes and Reward Items";
  const description =
    "Browse Roblox promotional codes, experience codes, event rewards, and creator challenge items with their listed claim details.";
  const updatedAt = sourceUpdatedAt ?? contentHtml?.updatedAt ?? null;
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

        <aside className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-foreground">
          <span className="font-semibold">Availability note: </span>
          A source listing records how a reward was offered. It does not guarantee that an older code, event, or challenge can still be claimed. Check the status label and the linked Roblox page before spending time on it.
        </aside>

        <CatalogAdSlot />
        <PromoRewardsBrowser items={items} />
        <CatalogAdSlot />

        {descriptionNodes.length ? descriptionNodes : null}
        {howNodes}
        {faqNodes.length ? <ContentFaq items={faqNodes} /> : null}
      </section>

      {contentHtml?.id ? <CommentsSection entityType="catalog" entityId={contentHtml.id} /> : null}
      <MoreCatalogs excludeCode="roblox-promo-codes" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildItemListSchema(title, description, items) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
