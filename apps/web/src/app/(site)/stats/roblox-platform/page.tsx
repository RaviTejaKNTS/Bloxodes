import type { Metadata } from "next";
import { StatsPageShell, StatsPlatformView } from "../components/StatsViews";
import { getStatsPlatformPage } from "@/lib/stats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 600;

export const metadata: Metadata = {
  title: `Roblox Platform Stats | ${SITE_NAME}`,
  description: "Track Roblox platform-level player counts, visits, top games, movers, and genre trends across games tracked by Bloxodes.",
  alternates: buildAlternates(`${SITE_URL}/stats/roblox-platform`)
};

export default async function StatsRobloxPlatformPage() {
  const data = await getStatsPlatformPage();
  return (
    <StatsPageShell>
      <StatsPlatformView data={data} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Platform Stats",
            description: metadata.description,
            url: `${SITE_URL}/stats/roblox-platform`
          })
        }}
      />
    </StatsPageShell>
  );
}
