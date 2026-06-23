import type { Metadata } from "next";
import { StatsCreatorsView, StatsPageShell } from "../components/StatsViews";
import { listStatsCreators, parseStatsCreatorsSearchParams } from "@/lib/stats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const parsed = parseStatsCreatorsSearchParams(await searchParams);
  const typeLabel = parsed.creatorType === "group" ? "Group" : parsed.creatorType === "user" ? "User" : "";
  const title = typeLabel ? `Roblox ${typeLabel} Creator Stats | ${SITE_NAME}` : `Roblox Creator Stats | ${SITE_NAME}`;
  const description = typeLabel
    ? `Search and sort Roblox ${typeLabel.toLowerCase()} creators by current players, visits, favorites, tracked games, and group members.`
    : "Search and sort Roblox creators by current players, visits, favorites, tracked games, and group members.";
  const params = new URLSearchParams();
  if (parsed.creatorType !== "all") params.set("type", parsed.creatorType);
  if (parsed.sort !== "playing") params.set("sort", parsed.sort);

  return {
    title,
    description,
    alternates: buildAlternates(`${SITE_URL}/stats/creators${params.toString() ? `?${params.toString()}` : ""}`)
  };
}

export default async function StatsCreatorsPage({ searchParams }: PageProps) {
  const parsed = parseStatsCreatorsSearchParams(await searchParams);
  const data = await listStatsCreators({
    page: parsed.page,
    q: parsed.q,
    sort: parsed.sort,
    creatorType: parsed.creatorType
  });

  return (
    <StatsPageShell>
      <StatsCreatorsView data={data} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Creator Stats",
            description: "Roblox creator leaderboard based on public Bloxodes game stats.",
            url: `${SITE_URL}/stats/creators`
          })
        }}
      />
    </StatsPageShell>
  );
}
