import Link from "next/link";
import type { Metadata } from "next";
import { PageNotFoundTracker } from "@/components/PageNotFoundTracker";
import { SITE_NAME } from "@/lib/seo";

// Replace inherited page metadata on every site 404. Next fills the social
// titles from this absolute document title after resolving the error boundary.
// A missing page has no canonical or Open Graph URL, even if its parent has one.
export const metadata: Metadata = {
  title: { absolute: `404 — Page Not Found | ${SITE_NAME}` },
  alternates: { canonical: null },
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME
  },
  twitter: { card: "summary" }
};

export default function SiteNotFound() {
  return (
    <section data-page-not-found className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center">
      <PageNotFoundTracker />
      <div className="space-y-4">
        <span className="inline-flex rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted">
          404 — Page Not Found
        </span>
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
          We couldn&apos;t find the page you were looking for.
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted md:text-lg">
          The link may be outdated, or the page might have moved. Explore the latest Roblox code drops, live stats, and in-depth articles, or head back to the {SITE_NAME} home page.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-border/60 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          Go home
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/codes"
            className="inline-flex items-center justify-center rounded-full border border-border/60 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            See Roblox codes
          </Link>
          <Link
            href="/stats"
            className="inline-flex items-center justify-center rounded-full border border-border/60 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            Browse game stats
          </Link>
          <Link
            href="/articles"
            className="inline-flex items-center justify-center rounded-full border border-border/60 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            Read latest articles
          </Link>
        </nav>
      </div>
    </section>
  );
}
