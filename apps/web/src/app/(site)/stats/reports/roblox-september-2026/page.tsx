import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import {
  AnimeDiceChart,
  CoolDownGamesChart,
  AnniversaryGamesChart,
  GenreMovementChart
} from "@/components/reports/RobloxSeptember2026ReportCharts";
import { robloxSeptember2026Report } from "@/data/reports/roblox-september-2026";
import { breadcrumbJsonLd, buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

const report = robloxSeptember2026Report;
const canonicalUrl = SITE_URL + "/stats/reports/" + report.slug;
const featureImageUrl = SITE_URL + report.featureImage.src;

export const metadata: Metadata = {
  title: report.seoTitle,
  description: report.seoDescription,
  alternates: buildAlternates(canonicalUrl),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  },
  openGraph: {
    type: "article",
    url: canonicalUrl,
    siteName: SITE_NAME,
    title: report.title,
    description: report.seoDescription,
    publishedTime: report.publishedAt,
    modifiedTime: report.updatedAt,
    images: [
      {
        url: featureImageUrl,
        width: 1200,
        height: 630,
        alt: report.featureImage.alt
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: report.title,
    description: report.seoDescription,
    images: [featureImageUrl]
  }
};

const articleStructuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": canonicalUrl
  },
  headline: report.title,
  description: report.seoDescription,
  image: [featureImageUrl],
  datePublished: report.publishedAt,
  dateModified: report.updatedAt,
  articleSection: "Roblox Stats",
  inLanguage: "en-US",
  isAccessibleForFree: true,
  author: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL
  },
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: SITE_URL + "/Bloxodes-dark.png"
    }
  }
};

const breadcrumbStructuredData = breadcrumbJsonLd([
  { name: "Home", url: SITE_URL },
  { name: "Roblox Stats", url: SITE_URL + "/stats" },
  { name: "Monthly reports", url: SITE_URL + "/stats/reports" },
  { name: report.title, url: canonicalUrl }
]);

function GameLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="font-semibold text-accent hover:underline" href={href}>
      {children}
    </Link>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="font-semibold text-accent hover:underline" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5" aria-hidden />
    </a>
  );
}

const body = "text-[1.05rem] leading-relaxed text-foreground md:text-[1.09rem]";

export default function RobloxSeptember2026ReportPage() {
  return (
    <main className="mx-auto w-full max-w-3xl">
      <PageBreadcrumb
        className="mb-6 text-xs uppercase tracking-[0.25em] text-muted"
        items={[
          { label: "Home", href: "/" },
          { label: "Roblox Stats", href: "/stats" },
          { label: "Reports", href: "/stats/reports" },
          { label: report.featureImage.month, href: null }
        ]}
      />
      <article id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--prose">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{report.title}</h1>
          <p className="text-lg leading-8 text-muted">{report.subtitle}</p>
          <p className="text-sm text-muted">{report.dataWindowLabel}</p>
        </header>

        <div className="mt-8 space-y-5">
          <p className={body}>
            <GameLink href="/stats/games/anime-dice">Anime Dice</GameLink> kept its gains through September.
            Its best seven-day stretch, September 24 through 30, averaged 57,130 players online at the same time.
            That was the strongest rolling week anywhere in its September 5 through 30 player path.
          </p>
          <p className={body}>
            The climb held up when we compared matching weekdays, too. All 19 comparisons against the same day
            a week earlier were higher. The typical increase was 43.5%. Its daily player counts rose across
            several weeks.
          </p>
          <p className={body}>
            There were pauses along the way. Daily averages hovered around 37,000 to 41,000 in mid-September
            before rising again. The highest daily average, 68,076, arrived on September 30. Those repeated gains
            made Anime Dice the clearest sustained climber among the larger rising games in this report.
          </p>
        </div>

        <AnimeDiceChart points={report.lead.points} markers={report.lead.markers} />

        <div className="space-y-5">
          <p className={body}>
            Anime Dice's official <ExternalLink href="https://www.roblox.com/events/5130353600144474748">Update 4 event</ExternalLink>{" "}
            began on September 12, and its scheduled <ExternalLink href="https://www.roblox.com/events/6257923988715078223">Update 6 event</ExternalLink>{" "}
            window began on September 27. Both sat alongside rises in the daily line. The timing does not tell us
            how much an update, returning players, or new arrivals contributed to those gains.
          </p>
          <p className={body}>
            <GameLink href="/stats/games/ball-vs-ball">Ball VS Ball</GameLink> had a similar result at a smaller scale.
            All 19 matching-weekday comparisons rose, with a typical increase of 48.2%. Its strongest rolling week
            also came on September 24 through 30, averaging 27,151 players online. Both games kept building beyond
            a single weekend, even though their daily paths were uneven.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          The anniversary brought older games back into view
        </h2>

        <div className="mt-5 space-y-5">
          <p className={body}>
            September also gave players a reason to revisit Roblox history. <ExternalLink href="https://about.roblox.com/newsroom/2026/09/join-the-hunt-roblox-20">The Hunt: Roblox 20</ExternalLink>{" "}
            ran from September 17 through 28. Roblox named <GameLink href="/stats/games/lumber-tycoon-2-2471084">Lumber Tycoon 2</GameLink>{" "}
            and <GameLink href="/stats/games/jailbreak-245662005">Jailbreak</GameLink> among its participating games,
            with quests that took players through different years of the platform.
          </p>
          <p className={body}>
            Both games had later waves. Lumber Tycoon 2 reached a daily average of 26,956 on September 26.
            Its strongest seven-day stretch, September 24 through 30, averaged 12,937 players online.
            Eighteen of its 19 matching-weekday comparisons rose. The typical increase was 51.6%, although its
            smaller starting audience makes that percentage easier to grow than in a much larger game.
          </p>
        </div>

        <AnniversaryGamesChart series={report.anniversaryGames.series} markers={report.anniversaryGames.markers} />

        <p className={body}>
          Jailbreak tells a different story. Its daily average reached 30,608 on September 19, inside The Hunt's
          event window. Its strongest rolling week averaged 18,613 players online, from September 18 through 24.
          But its typical matching-weekday change across the full analysis period was -7.5%. A visible event wave
          can coexist with a weaker weekly trend. The overlap is clear; it does not prove the event explains every
          rise, or that either game kept all of those players afterward.
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          A few climbers stood out in a cooler game mix
        </h2>

        <div className="mt-5 space-y-5">
          <p className={body}>
            Across 339 selected games with a steady presence in the September 5 through 30 readings,
            most named genre groups lost ground. Comparing each genre's combined player counts with the same
            weekday a week earlier gave RPG a typical change of -18.3%, Simulation -7.3%, and Survival -6.7%.
            These figures describe the selected games, not all of Roblox.
          </p>
          <p className={body}>
            Sports &amp; Racing moved the other way, at +3.6%. <GameLink href="/stats/games/illegal-soccer">Illegal Soccer</GameLink>{" "}
            was one clear climber in that group. Eighteen of its 19 matching-weekday comparisons rose, with a typical
            increase of 12.2%. Its strongest rolling week averaged 47,549 players online. A genre can gain ground
            even while much larger groups are cooling.
          </p>
        </div>

        <GenreMovementChart data={report.genreMovement} />

        <div className="space-y-5">
          <p className={body}>
            <GameLink href="/stats/games/blox-fruits-994732206">Blox Fruits</GameLink> had one of the clearest large
            cool-downs. Every comparable weekday was lower than the week before, and the typical change was -21.2%.
            Its daily average was 638,566 on September 5, when the official <ExternalLink href="https://www.roblox.com/events/1508048912529883734">Update 30 event</ExternalLink>{" "}
            began. It still had busy weekends afterward, but successive weeks were lower. Its strongest rolling week
            averaged 441,367 players online; its weakest averaged 220,890.
          </p>
          <p className={body}>
            <GameLink href="/stats/games/animal-hospital">Animal Hospital</GameLink> also fell on every comparable
            weekday, with a typical change of -23.6%. Its strongest rolling week averaged 106,662 players online,
            against 41,175 in its weakest. That happened in a month when Roblox named it <ExternalLink href="https://about.roblox.com/newsroom/2026/09/2026-roblox-innovation-awards">People's Choice and Best New Game</ExternalLink>{" "}
            at the Innovation Awards. Community recognition and a rising daily player count do not always arrive together.
          </p>
        </div>

        <CoolDownGamesChart series={report.coolDownGames.series} markers={report.coolDownGames.markers} />

        <p className={body}>
          <GameLink href="/stats/games/steal-a-brainrot-7709344486">Steal a Brainrot</GameLink> prevents that from
          becoming a story about every bigger game falling. It averaged 109,951 players online across the analysis
          period, and 13 of its 19 matching-weekday comparisons rose. Its typical weekly change was +5.9%.
          The daily line swung around, but the weekly result was positive. September had room for steady climbs,
          short waves, and large cool-downs at the same time.
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Roblox celebrated 20 years and announced ways to play
        </h2>

        <div className="mt-5 space-y-5">
          <p className={body}>
            The anniversary was also a moment for Roblox to describe what comes next. At its <ExternalLink href="https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play">September 11 developer conference</ExternalLink>,
            Roblox said players would be able to join games in Chrome without installing the app by the end of
            the year. It also described discovery becoming more age-aware and looking at whether players return
            beyond their first week. Those are Roblox's announcements; these player counts cannot show whether
            a recommendation change helped or hurt an individual game.
          </p>
          <p className={body}>
            Safety remained part of the month's news. In a <ExternalLink href="https://www.tn.gov/attorneygeneral/news/2026/9/22/pr26-37.html">September 22 announcement</ExternalLink>,
            Tennessee's attorney general said a court had allowed its consumer protection lawsuit against Roblox
            to proceed. The state alleges misleading safety promises. According to the release, Roblox sought
            dismissal on Section 230 and First Amendment grounds and challenged the allegations' detail.
            The ruling lets the case continue; it does not establish that the allegations are true.
          </p>
          <p className={body}>
            For players, September's clearest contrast was already visible in the games. Anime Dice kept adding
            to its daily audience, older games drew anniversary crowds, and several larger hits finished with
            weaker weekly trends. The anniversary waves and the most consistent climb were different stories.
          </p>
        </div>

        <footer className="mt-12 border-t border-border pt-5">
          <p className="text-xs leading-6 text-muted">{report.endnote}</p>
        </footer>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleStructuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }} />
    </main>
  );
}
