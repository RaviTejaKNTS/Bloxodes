import type { Metadata } from "next";
import { StatsHomeView, StatsPageShell } from "./components/StatsViews";
import { getStatsHome } from "@/lib/stats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 600;

export const metadata: Metadata = {
  title: `Roblox Stats | ${SITE_NAME}`,
  description: "Live Roblox game stats, player counts, visits, ratings, trends, and charts tracked by Bloxodes.",
  alternates: buildAlternates(`${SITE_URL}/stats`)
};

export default async function StatsPage() {
  const data = await getStatsHome();
  return (
    <StatsPageShell>
      <StatsHomeView data={data} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Stats",
            description: metadata.description,
            url: `${SITE_URL}/stats`
          })
        }}
      />
    </StatsPageShell>
  );
}
