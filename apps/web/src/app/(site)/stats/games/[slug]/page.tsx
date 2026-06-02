import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StatsGameDetailView, StatsPageShell } from "../../components/StatsViews";
import { getStatsGameBySlug, robloxGameUrl } from "@/lib/stats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStatsGameBySlug(slug);
  const canonical = `${SITE_URL}/stats/games/${data?.game.slug ?? slug}`;
  if (!data) return { alternates: buildAlternates(canonical) };

  const title = `${data.game.displayName} Stats | ${SITE_NAME}`;
  const description = `Track ${data.game.displayName} Roblox stats, current players, visits, favorites, rating, and public Bloxodes charts.`;
  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: data.game.iconUrl ? [data.game.iconUrl] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: data.game.iconUrl ? [data.game.iconUrl] : undefined
    }
  };
}

export default async function StatsGameDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getStatsGameBySlug(slug);
  if (!data) notFound();

  const game = data.game;
  if (slug !== game.slug) {
    redirect(`/stats/games/${game.slug}`);
  }

  return (
    <StatsPageShell>
      <StatsGameDetailView data={data} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoGame",
            name: game.displayName,
            url: `${SITE_URL}/stats/games/${game.slug}`,
            sameAs: robloxGameUrl(game),
            image: game.iconUrl ?? undefined,
            genre: game.genre ?? undefined,
            aggregateRating:
              game.ratingPercent != null
                ? {
                    "@type": "AggregateRating",
                    ratingValue: game.ratingPercent,
                    bestRating: 100,
                    worstRating: 0,
                    ratingCount: (game.likes ?? 0) + (game.dislikes ?? 0)
                  }
                : undefined
          })
        }}
      />
    </StatsPageShell>
  );
}
