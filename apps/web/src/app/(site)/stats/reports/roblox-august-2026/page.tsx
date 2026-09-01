import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import {
  AdoptMeChart,
  CoolDownGamesChart,
  EstablishedGamesChart,
  GenreMovementChart
} from "@/components/reports/RobloxAugust2026ReportCharts";
import { robloxAugust2026Report } from "@/data/reports/roblox-august-2026";
import { breadcrumbJsonLd, buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

const report = robloxAugust2026Report;
const canonicalUrl = SITE_URL + "/stats/reports/" + report.slug;
const featureImageUrl = SITE_URL + report.featureImage.src;

export const metadata: Metadata = {
  title: report.seoTitle,
  description: report.seoDescription,
  alternates: buildAlternates(canonicalUrl),
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
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

export default function RobloxAugust2026ReportPage() {
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
          <p className="text-sm text-muted">{report.dataWindowLabel} · Bloxodes player readings</p>
        </header>

        <div className="mt-8 space-y-5">
          <p className={body}>
            <GameLink href="/stats/games/adopt-me-383310974">Adopt Me!</GameLink>{" "}had August&rsquo;s clearest positive path
            among the larger games in this report. Its daily average was 219,399 players online at once. The strongest
            seven-day stretch, August 25–31, averaged 278,444, compared with 146,271 in the weakest stretch from
            August 1–7.
          </p>
          <p className={body}>
            That was not a straight climb. The daily average dipped to 109,596 on August 5, then reached 396,858 on
            August 29. Seven out of ten usable same-weekday comparisons were higher than the week before, giving the
            game a typical weekly change of +13.9%. The shape looks more like a series of waves than a new level that
            appeared overnight.
          </p>
        </div>

        <AdoptMeChart points={report.adoptMe.points} markers={report.adoptMe.markers} />

        <p className={body}>
          The timing also sits beside a busy event schedule. Roblox&rsquo;s listings show weekly{" "}
          <ExternalLink href="https://www.roblox.com/events/3855084496319808099">ADOPT ME NEW UPDATE!</ExternalLink>{" "}
          windows beginning on August 14 and{" "}
          <ExternalLink href="https://www.roblox.com/events/1348585996345803364">August 28</ExternalLink>, along with
          smaller recurring listings around them. Those windows overlap the rises, but the chart cannot tell us which
          update, if any, mattered most. A{" "}
          <ExternalLink href="https://about.roblox.com/newsroom/2026/08/optimize-testing-live-updates-roblox-analytics-experimentation-platform">
            Roblox newsroom feature
          </ExternalLink>{" "}
          about Uplift Games, the studio behind Adopt Me!, offers useful context: it says the team uses Roblox Analytics
          and Experiments to test features, and describes a revamped trading platform and a summer-event performance
          bug. That explains the studio&rsquo;s stated process, not the cause of this month&rsquo;s player path.
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Older games found more than one way to rise
        </h2>

        <div className="mt-5 space-y-5">
          <p className={body}>
            <GameLink href="/stats/games/doors-2440500124">DOORS</GameLink> and{" "}
            <GameLink href="/stats/games/tower-of-hell-703124385">Tower of Hell</GameLink> joined Adopt Me! on the
            positive side, even though their paths looked different. DOORS had a typical same-weekday change of
            +11.1%, with 83% of comparisons rising. Its strongest rolling week averaged 47,949 players online at
            once, against 17,735 in its weakest week.
          </p>
          <p className={body}>
            DOORS&rsquo; biggest move landed late. Its daily average reached 84,558 on August 29, one day after the official{" "}
            <ExternalLink href="https://www.roblox.com/events/2158475119163474563">THE ARCHIVES UPDATE</ExternalLink>{" "}
            listing began. The timing matches the late wave, but it does not establish that the event explains the full
            increase. Tower of Hell was quieter and steadier: its typical weekly change was +12.2%, 92% of its
            comparisons rose, and its strongest rolling week averaged 46,256 versus 32,617 in its weakest.
          </p>
          <p className={body}>
            <GameLink href="/stats/games/blox-fruits-994732206">Blox Fruits</GameLink> was a larger, milder example. Its
            typical weekly change was +4.8%, with 63% of comparisons higher, and its strongest rolling week averaged
            357,750 players online at once. Its official{" "}
            <ExternalLink href="https://www.roblox.com/events/5621792963953820284">Ultimate Balance Patch</ExternalLink>{" "}
            listing began on August 7, but the data does not isolate the patch from the normal week-to-week rhythm.
          </p>
        </div>

        <EstablishedGamesChart series={report.establishedGames.series} markers={report.establishedGames.markers} />

        <p className={body}>
          The broader game mix was less upbeat. Across 402 selected games with a steady presence through the month,
          RPG had a typical same-weekday change of +1.9% and Roleplay &amp; Avatar Sim was +1.6%. Simulation, the
          largest group in the set, was -7.3%, while Survival was -14.9%. Those group figures are useful for scale,
          but they do not overrule individual paths: Adopt Me! rose inside Roleplay &amp; Avatar Sim, while DOORS and
          Murder Mystery 2 moved in opposite directions inside Survival.
        </p>

        <GenreMovementChart data={report.genreMovement} />

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          The biggest hits did not move together
        </h2>

        <div className="mt-5 space-y-5">
          <p className={body}>
            <GameLink href="/stats/games/grow-a-garden-2">Grow a Garden 2</GameLink> shows how sharp the split could be.
            Its typical same-weekday change was -48.5%, with no usable comparison higher than the week before. Its
            strongest seven-day stretch averaged 482,533 players online at once; its weakest averaged 27,965. The
            official <ExternalLink href="https://www.roblox.com/events/320126472528462435">FALL HARVEST</ExternalLink>{" "}
            and <ExternalLink href="https://www.roblox.com/events/4429757377838973713">MUFFIN BAKE</ExternalLink>{" "}
            listings give the line some event context, but not a causal explanation.
          </p>
          <p className={body}>
            <GameLink href="/stats/games/murder-mystery-2-66654135">Murder Mystery 2</GameLink> had a different shape. The
            2014 game climbed into a strongest rolling week of 1,010,247 before cooling to 295,231 in its weakest
            week, with a typical weekly change of -29.3%. Its{" "}
            <ExternalLink href="https://www.roblox.com/events/2246431876220846708">Summer 2026 event</ExternalLink>{" "}
            ran through August 23, so the line overlaps a real in-game schedule without telling us what produced the
            mid-month crest. <GameLink href="/stats/games/animal-hospital">Animal Hospital</GameLink> added another
            younger-game comparison, moving from a strongest rolling week of 250,839 to a weakest of 116,897, with a
            typical weekly change of -14.1%.
          </p>
        </div>

        <CoolDownGamesChart series={report.coolDownGames.series} markers={report.coolDownGames.markers} />

        <p className={body}>
          There is one more reason to be careful with the late-month lines. In an August 19 Developer Forum post,
          Roblox said it had started a large-scale action against bot accounts and that player counts could fluctuate
          as accounts were removed. It also said known bot engagement was excluded from Recommended For You. That is
          an important platform-wide measurement caveat, not a verdict on any one game&rsquo;s August performance.{" "}
          <ExternalLink href="https://devforum.roblox.com/t/actioning-against-bot-accounts-on-roblox/4820656">
            Read the announcement
          </ExternalLink>
          .
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
