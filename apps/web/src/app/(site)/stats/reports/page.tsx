import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { robloxJuly2026Report } from "@/data/reports/roblox-july-2026";
import { robloxJune2026Report } from "@/data/reports/roblox-june-2026";
import { breadcrumbJsonLd, buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

const pageUrl = `${SITE_URL}/stats/reports`;

export const metadata: Metadata = {
  title: `Roblox Stats Reports | ${SITE_NAME}`,
  description: "Monthly Roblox reports about the games, genres, events, and community stories moving the platform.",
  alternates: buildAlternates(pageUrl),
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: SITE_NAME,
    title: `Roblox Stats Reports | ${SITE_NAME}`,
    description: "Monthly Roblox reports about the games, genres, events, and community stories moving the platform."
  }
};

const reports = [
  {
    href: `/stats/reports/${robloxJuly2026Report.slug}`,
    month: robloxJuly2026Report.featureImage.month,
    title: robloxJuly2026Report.title,
    description: robloxJuly2026Report.subtitle,
    image: robloxJuly2026Report.featureImage
  },
  {
    href: `/stats/reports/${robloxJune2026Report.slug}`,
    month: robloxJune2026Report.featureImage.month,
    title: robloxJune2026Report.title,
    description: robloxJune2026Report.subtitle,
    image: robloxJune2026Report.featureImage
  }
] as const;

const breadcrumbStructuredData = breadcrumbJsonLd([
  { name: "Home", url: SITE_URL },
  { name: "Roblox Stats", url: `${SITE_URL}/stats` },
  { name: "Monthly reports", url: pageUrl }
]);

export default function StatsReportsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl">
      <PageBreadcrumb
        className="mb-6 text-xs uppercase tracking-[0.25em] text-muted"
        items={[
          { label: "Home", href: "/" },
          { label: "Roblox Stats", href: "/stats" },
          { label: "Reports", href: null }
        ]}
      />
      <header className="max-w-2xl">
        <p className="text-sm font-semibold text-accent">Roblox stats</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Monthly reports</h1>
        <p className="mt-3 text-lg leading-8 text-muted">
          The games, genres, events, and community stories that shaped each month on Roblox.
        </p>
      </header>

      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--reports mt-10 border-t border-border">
        {reports.map((report) => (
          <div key={report.href} data-journey-item className="h-full">
            <article className="border-b border-border py-6">
              <div className="grid gap-5 sm:grid-cols-[260px_minmax(0,1fr)] sm:items-start">
                <Link
                  className="relative block aspect-[1200/630] overflow-hidden rounded-lg border border-border bg-surface-muted"
                  href={report.href}
                  aria-label={`Read ${report.title}`}
                >
                  <Image
                    src={report.image.src}
                    alt={report.image.alt}
                    fill
                    priority
                    sizes="(max-width: 639px) calc(100vw - 2rem), 260px"
                    className="object-cover transition-transform duration-300 hover:scale-[1.01]"
                  />
                </Link>
                <div>
                  <p className="text-sm text-muted">{report.month}</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                    <Link className="hover:text-accent hover:underline" href={report.href}>
                      {report.title}
                    </Link>
                  </h2>
                  <p className="mt-2 text-base leading-7 text-muted">{report.description}</p>
                  <Link
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
                    href={report.href}
                  >
                    Read the report
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </article>
          </div>
        ))}
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />
    </main>
  );
}
