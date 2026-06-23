import type { Metadata } from "next";
import { StatsItemsView, StatsPageShell } from "../components/StatsViews";
import { listStatsItems, parseStatsItemsSearchParams } from "@/lib/stats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const parsed = parseStatsItemsSearchParams(await searchParams);
  const title = `Roblox Item Stats | ${SITE_NAME}`;
  const description = "Search and sort Roblox marketplace items by favorites, price, resale, category, creator, and recent catalog sightings.";
  const params = new URLSearchParams();
  if (parsed.category) params.set("category", parsed.category);
  if (parsed.subcategory) params.set("subcategory", parsed.subcategory);
  if (parsed.sale !== "all") params.set("sale", parsed.sale);
  if (parsed.creator !== "all") params.set("creator", parsed.creator);
  if (parsed.sort !== "favorites") params.set("sort", parsed.sort);

  return {
    title,
    description,
    alternates: buildAlternates(`${SITE_URL}/stats/items${params.toString() ? `?${params.toString()}` : ""}`)
  };
}

export default async function StatsItemsPage({ searchParams }: PageProps) {
  const parsed = parseStatsItemsSearchParams(await searchParams);
  const data = await listStatsItems({
    page: parsed.page,
    q: parsed.q,
    sort: parsed.sort,
    category: parsed.category,
    subcategory: parsed.subcategory,
    sale: parsed.sale,
    creator: parsed.creator
  });

  return (
    <StatsPageShell>
      <StatsItemsView data={data} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Item Stats",
            description: "Roblox marketplace item leaderboard based on public Bloxodes catalog data.",
            url: `${SITE_URL}/stats/items`
          })
        }}
      />
    </StatsPageShell>
  );
}
