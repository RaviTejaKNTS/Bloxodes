import type { Metadata } from "next";
import { StatsGamesView, StatsPageShell } from "../components/StatsViews";
import { listStatsGames, parseStatsSearchParams } from "@/lib/stats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const parsed = parseStatsSearchParams(await searchParams);
  const genre = parsed.genre && parsed.genre !== "all" ? parsed.genre : null;
  return {
    title: genre ? `${genre} Roblox Game Stats | ${SITE_NAME}` : `Roblox Game Stats | ${SITE_NAME}`,
    description: genre
      ? `Search and sort ${genre} Roblox games by live current players, visits, favorites, rating, and public Bloxodes trend data.`
      : "Search and sort Roblox games by live current players, visits, favorites, rating, and public Bloxodes trend data.",
    alternates: buildAlternates(
      genre ? `${SITE_URL}/stats/games?genre=${encodeURIComponent(genre)}` : `${SITE_URL}/stats/games`
    )
  };
}

export default async function StatsGamesPage({ searchParams }: PageProps) {
  const parsed = parseStatsSearchParams(await searchParams);
  const data = await listStatsGames({
    page: parsed.page,
    q: parsed.q,
    genre: parsed.genre,
    sort: parsed.sort,
    minPlayers: parsed.minPlaying
  });
  return (
    <StatsPageShell>
      <StatsGamesView data={data} />
    </StatsPageShell>
  );
}
