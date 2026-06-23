import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatsItemDetailView, StatsPageShell } from "../../components/StatsViews";
import { getStatsItemDetail } from "@/lib/stats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ assetId: string }>;
};

function parseAssetId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? Math.trunc(parsed) : null;
}

function itemRouteId(item: { assetId: number; itemType: string }) {
  return item.itemType === "Bundle" ? Math.abs(item.assetId) : item.assetId;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const assetId = parseAssetId((await params).assetId);
  if (!assetId) return { title: `Roblox Item Stats | ${SITE_NAME}` };
  const data = await getStatsItemDetail(assetId);
  if (!data) return { title: `Roblox Item Stats | ${SITE_NAME}` };
  const routeId = itemRouteId(data.item);
  const title = `${data.item.name} Roblox Item Stats | ${SITE_NAME}`;
  const description = `${data.item.name} price, favorites, resale, creator, and Roblox marketplace history tracked by Bloxodes.`;
  return {
    title,
    description,
    alternates: buildAlternates(`${SITE_URL}/stats/items/${routeId}`),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/stats/items/${routeId}`,
      images: data.item.thumbnailUrl ? [{ url: data.item.thumbnailUrl }] : undefined
    }
  };
}

export default async function StatsItemDetailPage({ params }: PageProps) {
  const assetId = parseAssetId((await params).assetId);
  if (!assetId) notFound();
  const data = await getStatsItemDetail(assetId);
  if (!data) notFound();
  const routeId = itemRouteId(data.item);

  return (
    <StatsPageShell>
      <StatsItemDetailView data={data} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: data.item.name,
            description: data.item.description,
            image: data.item.thumbnailUrl,
            url: `${SITE_URL}/stats/items/${routeId}`,
            sameAs: data.item.robloxUrl,
            brand: {
              "@type": "Brand",
              name: "Roblox"
            },
            offers: data.item.priceRobux != null
              ? {
                  "@type": "Offer",
                  price: data.item.priceRobux,
                  priceCurrency: "ROBUX",
                  availability: data.item.isForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                  url: data.item.robloxUrl
                }
              : undefined
          })
        }}
      />
    </StatsPageShell>
  );
}
