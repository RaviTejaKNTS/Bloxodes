import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import {
  ComebackGamesChart,
  CoolDownGamesChart,
  GenreMovementChart,
  MurderMystery2Chart
} from "@/components/reports/RobloxJuly2026ReportCharts";
import { robloxJuly2026Report } from "@/data/reports/roblox-july-2026";
import { breadcrumbJsonLd, buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

const report = robloxJuly2026Report;
const canonicalUrl = `${SITE_URL}/stats/reports/${report.slug}`;
const featureImageUrl = `${SITE_URL}${report.featureImage.src}`;

export const metadata: Metadata = {
  title: report.seoTitle,
  description: report.seoDescription,
  alternates: buildAlternates(canonicalUrl),
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
      url: `${SITE_URL}/Bloxodes-dark.png`
    }
  }
};

const breadcrumbStructuredData = breadcrumbJsonLd([
  { name: "Home", url: SITE_URL },
  { name: "Roblox Stats", url: `${SITE_URL}/stats` },
  { name: "Monthly reports", url: `${SITE_URL}/stats/reports` },
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

export default function RobloxJuly2026ReportPage() {
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
      <article
        id="article-body"
        itemProp="articleBody"
        className="journey-content-stream journey-content-stream--prose"
      >
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{report.title}</h1>
          <p className="text-lg leading-8 text-muted">{report.subtitle}</p>
          <p className="text-sm text-muted">{report.dataWindowLabel} · Bloxodes player readings</p>
        </header>

        <div className="mt-8 space-y-5">
          <p className={body}>
            For the first three weeks of July, <GameLink href="/stats/games/murder-mystery-2-66654135">Murder Mystery 2</GameLink> barely
            moved. Its daily average stayed in a tight band, roughly 252,000 to 301,000 players online at the same time,
            day after day. Then the line broke upward on July 23.
          </p>
          <p className={body}>
            That was the day Roblox&rsquo;s <ExternalLink href="https://www.roblox.com/events/2246431876220846708">Summer 2026 event</ExternalLink> opened
            inside the game at 21:00 UTC, adding a summer lobby, a summer map, a mystery box, a Godly item pack, and
            rewards for opening those boxes. The daily average jumped to 373,872 that same day, then stayed above
            511,000 every day through the end of the month. The game&rsquo;s strongest seven-day stretch, July 24 to
            30, averaged 596,960 players online at once, more than double its quietest week of 259,673 from July 2 to
            8. The timing matches the surge. It does not prove the event caused it.
          </p>
        </div>

        <MurderMystery2Chart points={report.murderMystery2.points} markers={report.murderMystery2.markers} />

        <p className={body}>
          <GameLink href="/stats/games/murder-mystery-2-66654135">Murder Mystery 2</GameLink> has been on Roblox since
          2014. A decade-old game posting the selected set&rsquo;s largest durable rise, with the sharpest jump landing
          right alongside an official event, made it the clearest story of the month.
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Older games found different routes back
        </h2>

        <div className="mt-5 space-y-5">
          <p className={body}>
            Murder Mystery 2 was not the only established game drawing a larger crowd in July. Three other older
            titles climbed too, each along a different path.
          </p>
          <p className={body}>
            <GameLink href="/stats/games/flee-the-facility-372226183">Flee the Facility</GameLink>, running on Roblox
            since 2017, was already climbing through most of the month before its own{" "}
            <ExternalLink href="https://www.roblox.com/events/4307181808962896528">summer event</ExternalLink> began on
            July 23. Its typical weekly gain, measured against the same weekday one week earlier, was 12.5%, with 87%
            of those comparisons positive. Its strongest seven-day stretch averaged 43,586 players online at once,
            versus 24,205 in its weakest week. The event landed right alongside the sharpest jump of the month.
          </p>
          <p className={body}>
            <GameLink href="/stats/games/shinobi-life-2-1511883870">Shindo Life</GameLink> told a steadier story. Every
            single usable same-weekday comparison in July was positive, and its typical weekly gain was a striking
            101.1%. It went from a quiet weakest week of 3,734 players online at once to a strongest week of 36,458,
            then held near that level through month&rsquo;s end. The line shows the shape of the return without telling
            us what caused it.
          </p>
          <p className={body}>
            <GameLink href="/stats/games/bee-swarm-simulator-601130232">Bee Swarm Simulator</GameLink>, out since 2018,
            moved the most quietly of all: a steady 5.0% typical weekly gain, every usable comparison positive, and a
            strongest week (20,158) only modestly ahead of its weakest (16,923).{" "}
            <GameLink href="/stats/games/tower-of-hell-703124385">Tower of Hell</GameLink>, also from 2018, posted a
            similar quiet gain of 10.4% with 96% of its comparisons positive, another sign that several long-running
            games found room to grow in July.
          </p>
        </div>

        <ComebackGamesChart series={report.comebackGames.series} eventMarker={report.comebackGames.eventMarker} />

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          The broader picture was moving the other way
        </h2>

        <div className="mt-5 space-y-5">
          <p className={body}>
            Zoom out to the wider set of games in this analysis, 356 titles with a steady presence across the month,
            and the picture looks different. Shooter games led with a typical same-weekday gain of 4.0%, the
            strongest of any genre, though still a modest number. Action, obby and platformer, RPG, and sports and
            racing games were only slightly positive. Survival games and roleplay and avatar-sim games each had a
            typical weekly change of -2.8%, simulation games -4.3%, party and casual games -7.3%, adventure games
            -19.1%, and strategy games -20.2%. This is movement among the selected games in this analysis, not a
            measurement of Roblox as a whole.
          </p>
        </div>

        <GenreMovementChart data={report.genreMovement} />

        <div className="space-y-5">
          <p className={body}>
            Inside that cooling picture were three clear full-period slides.{" "}
            <GameLink href="/stats/games/adopt-me-383310974">Adopt Me!</GameLink> had the largest cool-down: its
            typical weekly change was -13.3%, with only 22% of usable comparisons positive, sliding from a strongest
            week of 350,036 players online at once to a weakest week of 181,405.{" "}
            <GameLink href="/stats/games/animal-hospital">Animal Hospital</GameLink>, June&rsquo;s breakout game,
            stayed enormous but lost steam across July, with a typical weekly change of -7.3%, a strongest week of
            563,127, and a weakest week of 355,813, with a brief late-month bounce.{" "}
            <GameLink href="/stats/games/evomon">Evomon</GameLink> had the sharpest slide of the three: a typical
            weekly change of -28.4%, just 4% of comparisons positive, and a strongest week of 69,452 against a
            weakest week of 24,744.
          </p>
        </div>

        <CoolDownGamesChart series={report.coolDownGames.series} />

        <p className={body}>
          Two Roblox platform changes landed around the same time as these player-count shifts, though neither
          explains any single game&rsquo;s path. On July 16, Roblox{" "}
          <ExternalLink href="https://ir.roblox.com/news/news-details/2026/Roblox-Introduces-Build-A-New-Way-to-Create-on-the-Platform/default.aspx">
            announced Build
          </ExternalLink>
          , a mobile-first tool that turns a text prompt into a basic playable game, with a public alpha starting in
          New Zealand on July 28. And after creator pushback over its first proposal, Roblox revised its planned
          avatar-item fees before{" "}
          <ExternalLink href="https://devforum.roblox.com/t/building-stronger-protections-and-a-more-consistent-marketplace-unifying-2d-and-3d-avatar-item-publishing/4722717">
            introducing unified 2D and 3D marketplace publishing requirements
          </ExternalLink>{" "}
          on July 14. Roblox also{" "}
          <ExternalLink href="https://devforum.roblox.com/t/roblox-kids-and-select-global-launch-upcoming-updates-to-eligibility-ads-manager-and-expedited-review/4685717/1">
            loosened its Kids and Select eligibility rules
          </ExternalLink>{" "}
          on July 6 and July 16, a change Roblox said increased new games entering that catalog by about 33% a day.
        </p>

        <footer className="mt-12 border-t border-border pt-5">
          <p className="text-xs leading-6 text-muted">{report.endnote}</p>
        </footer>
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleStructuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />
    </main>
  );
}
