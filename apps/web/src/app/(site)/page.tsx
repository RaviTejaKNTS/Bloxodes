import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { loadHomePageData } from "@/lib/home-page-data";
import {
  HomeCatalog,
  HomeChecklists,
  HomeDirectory,
  HomeEvents,
  HomeFranchises,
  HomeGameShelf,
  HomeGuides,
  HomeHero,
  HomeNewCodes,
  HomePuzzles,
  HomeQuiz,
  HomeRecentWikis,
  HomeSectionTiles,
  HomeTodayStrip
} from "@/components/home/HomeBlocks";
import { HomeGameSwitcher } from "@/components/home/HomeGameSwitcher";
import { HomeRecent } from "@/components/home/HomeRecent";
import "@/styles/ads-hubs.css";

export const revalidate = 3600;

const PAGE_TITLE = `${SITE_NAME} | Roblox stats, wikis, codes, events, quizzes & checklists`;
const PAGE_DESCRIPTION = SITE_DESCRIPTION;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: buildAlternates(SITE_URL),
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: `${SITE_URL}/Bloxodes.png`, width: 1200, height: 675, alt: PAGE_TITLE }]
  },
  twitter: { card: "summary_large_image", title: PAGE_TITLE, description: PAGE_DESCRIPTION, images: [`${SITE_URL}/Bloxodes.png`] }
};

/**
 * Two blocks share a row from 1280px when both have content; a block whose partner is empty takes
 * the full row so dense grid flow never pulls a later block into the gap.
 */
function pair(hasFirst: boolean, hasSecond: boolean, first: string, second: string): [string, string] {
  return hasFirst && hasSecond ? [first, second] : ["", ""];
}

export default async function HomePage() {
  const data = await loadHomePageData();

  const [codesCol, eventsCol] = pair(
    data.newCodes.length > 0,
    Object.values(data.eventGroups).some((group) => group.length > 0),
    "home-col-7",
    "home-col-5"
  );
  const [wikisCol, shelfCol] = pair(data.recentWikis.length > 0, data.shelfGames.length > 0, "home-col-5", "home-col-7");
  const [quizCol, checklistsCol] = pair(Boolean(data.quiz), data.checklists.length > 0, "home-col-7", "home-col-5");
  const [franchiseCol, puzzlesCol] = pair(data.franchises.length > 0, data.puzzles.length > 0, "home-col-8", "home-col-4");

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: SITE_URL,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    hasPart: [
      {
        "@type": "ItemList",
        name: "Popular Roblox games on Bloxodes",
        itemListElement: data.gamePanels
          .filter((game) => game.wiki)
          .map((game, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: game.wiki!.label,
            url: `${SITE_URL}${game.wiki!.href}`
          }))
      }
    ]
  });

  return (
    <div className="space-y-6 md:space-y-8">
      <HomeHero data={data} />
      <HomeTodayStrip data={data} />
      <HomeRecent checklistTotals={data.checklistTotals} />

      {/* Mediavine places in-content ads between the direct children of #article-body. */}
      <div id="article-body" className="home-stream pt-4 md:pt-6">
        <HomeGameSwitcher games={data.gamePanels} />
        <HomeNewCodes data={data} className={codesCol} />
        <HomeEvents data={data} className={eventsCol} />
        <HomeSectionTiles data={data} />
        <HomeCatalog data={data} />
        <HomeGuides data={data} />
        <HomeRecentWikis data={data} className={wikisCol} />
        <HomeGameShelf data={data} className={shelfCol} />
        <HomeQuiz data={data} className={quizCol} />
        <HomeChecklists data={data} className={checklistsCol} />
        <HomeFranchises data={data} className={franchiseCol} />
        <HomePuzzles data={data} className={puzzlesCol} />
        <HomeDirectory data={data} />
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </div>
  );
}
