import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import {
  AnimalHospitalChart,
  CoolingGamesChart,
  EventRhythmChart,
  GenreMomentumChart
} from "@/components/reports/RobloxMonthlyReportCharts";
import { robloxJune2026Report } from "@/data/reports/roblox-june-2026";
import { breadcrumbJsonLd, buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

const report = robloxJune2026Report;
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

export default function RobloxJune2026ReportPage() {
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
            On June 9, <GameLink href="/stats/games/animal-hospital">Animal Hospital</GameLink> had an average of 884 players
            online at the same time. It had been on Roblox for less than a month. By June 30, that number was 429,721,
            with a daily high of 563,664. In three weeks, a new game had become one of the biggest things on Roblox.
          </p>
          <p className={body}>
            The climb did not happen in one jump. Every single week-over-week comparison in the data was positive, and the
            game&rsquo;s strongest seven-day stretch averaged roughly fifty times its quietest one. Two updates landed while
            the game was already climbing hard: &ldquo;The Ambulance Arrives&rdquo; from June 12 to 15, and &ldquo;Class
            Update &amp; QoL Pt.1&rdquo; from June 19 to 22. The timing lines up with the climb. It does not prove the
            updates caused it.
          </p>
        </div>

        <AnimalHospitalChart points={report.animalHospital.points} markers={report.animalHospital.markers} />

        <p className={body}>
          Fan interest grew alongside the player count. <ExternalLink href="https://knowyourmeme.com/memes/subcultures/animal-hospital-roblox">Know Your Meme</ExternalLink> tracked
          a wave of fan art, memes, and lore discussion about the game through June and into July. That community buzz is a
          useful sign that people were genuinely invested, not proof of why the player count rose.
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Weekends kept reshaping the Roblox charts
        </h2>

        <div className="mt-5 space-y-5">
          <p className={body}>
            Animal Hospital was the biggest story, but it was not the only one. Across June, survival games kept beating
            their own numbers from the same weekday one week earlier, more often and by wider margins than any other genre.
            The 41 survival games Bloxodes tracked closely rose in 94% of those weekly comparisons, with a typical gain of
            16.4%. Adventure and sports-and-racing games came next, both rising in the large majority of their weekly
            comparisons. Roleplay games and simulation games, the two largest genres by raw player count, grew more slowly.
            RPG games were the clear laggard: only one in eighteen weekly comparisons rose all month.
          </p>
        </div>

        <GenreMomentumChart data={report.genreMomentum} />

        <div className="space-y-5">
          <p className={body}>
            Zoom into individual survival games and a pattern shows up: Saturdays. <GameLink href="/stats/games/99-nights-in-the-forest-7326934954">99 Nights in the Forest</GameLink>{" "}
            formed two distinct waves in June, one building around its &ldquo;The Forest Wakes Up&rdquo; event that began
            June 13, and a second around &ldquo;The Aliens Revenge&rdquo; that began June 27. Saturday was consistently its
            best day of the week.
          </p>
          <p className={body}>
            <GameLink href="/stats/games/steal-a-brainrot-7709344486">Steal a Brainrot</GameLink> shows the pattern most
            clearly. It ran a new event almost every Saturday in June, and its Saturday averages of 314,639, 322,547, and
            363,330 players each came in well above its overall June average of 212,350. <GameLink href="/stats/games/1-speed-keyboard-escape-candy-chocolate">
              +1 Speed Keyboard Escape
            </GameLink>{" "}
            ran on the same weekly rhythm, jumping to 771,768 average players on June 27 alone. Independent listings on{" "}
            <ExternalLink href="https://bloxodes.com/wiki/1-speed-keyboard-escape">Bloxodes&rsquo; wiki</ExternalLink> and{" "}
            <ExternalLink href="https://op.gg/roblox/games/9584852943">OP.GG</ExternalLink> both showed it still pulling
            hundreds of thousands of players in late July, so June&rsquo;s numbers were not a one-off fluke.
          </p>
          <p className={body}>
            <GameLink href="/stats/games/100-days-at-sea-9167377564">100 Days At Sea</GameLink> took a slower route to the
            same kind of result. Instead of one big spike, it climbed in steps through a run of updates: a Giant Squid
            event, then class leveling, an ice region, and finally a bonus-pearls weekend. Its average went from 10,280
            players on its quietest day to 42,606 on its best. The climb unfolded across that same four-week run rather
            than in one rush.
          </p>
        </div>

        <EventRhythmChart series={report.eventRhythm.series} saturdays={report.eventRhythm.saturdays} />

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Some hits kept climbing. Others burned through their moment.
        </h2>

        <div className="mt-5 space-y-5">
          <p className={body}>
            Not every June gain came with a matching event. <GameLink href="/stats/games/murder-mystery-2-66654135">Murder Mystery 2</GameLink>,
            a game that has been on Roblox for years, rose in every single weekly comparison in June with no matching
            event in the collected Roblox feed. That makes it a useful contrast: the public numbers show the climb, but
            they cannot explain why it happened.
          </p>
          <p className={body}>
            Older games had a good month more broadly. <GameLink href="/stats/games/build-a-boat-for-treasure-210851291">Build A Boat For Treasure</GameLink>,
            a game from 2016, rose in 17 of 18 weekly comparisons and grew nearly 90% from its quietest week to its
            strongest. <GameLink href="/stats/games/tower-of-hell-703124385">Tower of Hell</GameLink>, from 2018, rose in
            every single comparison and hit a June high on the very last day of the month. Roblox hits can apparently
            stick around for a very long time.
          </p>
          <p className={body}>
            Smaller games broke out too. <GameLink href="/stats/games/merge-a-nuke">Merge a Nuke!</GameLink> climbed from a
            June low of 4,498 players to a high of 49,741 as it added new rebirths and commander features.{" "}
            <GameLink href="/stats/games/san-diego-border-roleplay">San Diego Border Roleplay</GameLink> grew even faster in
            percentage terms, rising in 17 of 18 weekly comparisons while two recorded updates landed late in the month. Roblox&rsquo;s{" "}
            <ExternalLink href="https://www.roblox.com/games/136020512003847/San-Diego-Border-Roleplay">own listing</ExternalLink> describes
            it as still in active, live development.
          </p>
          <p className={body}>
            Other games that looked unstoppable earlier in the year lost momentum. <GameLink href="/stats/games/slime-rng">Slime RNG</GameLink> went
            from 133,525 average players on June 6 to 8,315 on June 30, and its events that month did not interrupt the
            slide. <GameLink href="/stats/games/build-a-ring-farm">Build A Ring Farm</GameLink>, <GameLink href="/stats/games/survive-zombie-arena">Survive Zombie Arena</GameLink>,
            and <GameLink href="/stats/games/kick-a-lucky-block">Kick a Lucky Block</GameLink> followed a similar path,
            each posting a much weaker seven-day stretch after its strongest one. Even{" "}
            <GameLink href="/stats/games/grow-a-garden-7436755782">Grow a Garden</GameLink> cooled, sliding from 161,418
            average players on June 6 to 48,292 on June 30 — a real drop, but still a very large game.
          </p>
        </div>

        <CoolingGamesChart series={report.coolingGames.series} />

        <p className={body}>
          It would be easy to read all of this as an RPG collapse, since RPG was June&rsquo;s weakest genre. But{" "}
          <GameLink href="/stats/games/blox-fruits-994732206">Blox Fruits</GameLink>, one of the biggest RPGs on the
          platform, barely moved all month: its strongest and weakest weeks were separated by just 8%. The wider RPG
          softness was not simply one giant game losing its audience.
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          What else changed on Roblox this June
        </h2>

        <div className="mt-5 space-y-5">
          <p className={body}>
            On June 15, Roblox <ExternalLink href="https://devforum.roblox.com/t/recommended-for-you-algorithm-improvements-that-better-value-long-term-retention/4684575">
              changed how its recommendations work
            </ExternalLink>. The &ldquo;Recommended For You&rdquo; feed now looks at a player&rsquo;s last 28 days instead
            of seven, and it factors in whether returning players keep playing and whether first-time players leave
            quickly. In plain terms, Roblox is trying to reward games people come back to, not just games that get a
            burst of early clicks. It is impossible to say from public player counts alone whether this change helped or
            hurt any specific game in June.
          </p>
          <p className={body}>
            A day later, Roblox made its age-based Kids and Select account experiences{" "}
            <ExternalLink href="https://about.roblox.com/newsroom/2026/06/age-based-roblox-kids-and-select-accounts-now-globally-available">
              available worldwide
            </ExternalLink>. Players under 16 now see games that receive additional Roblox review, along with more
            restrictive chat and messaging defaults. Age checks are used to move between account types. Child safety also
            stayed in the news: on June 23, Arkansas{" "}
            <ExternalLink href="https://www.axios.com/local/nw-arkansas/2026/06/23/arkansas-sues-roblox-discord-child-safety-lawsuit">
              sued Roblox and Discord
            </ExternalLink>{" "}
            over alleged child-safety failures, allegations Roblox disputed.
          </p>
        </div>

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
