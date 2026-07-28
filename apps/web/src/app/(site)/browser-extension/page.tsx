import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiGooglechrome } from "react-icons/si";
import { SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";

const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/bloxodes-%E2%80%93-roblox-game-co/mammkedlehmpechknaicfakljaogcmhc";
const title = "Bloxodes Browser Extension for Roblox";
const description =
  "See active Roblox game codes and seven-day player history without leaving the game. Sign in to sync the codes you have used across Bloxodes.";
const canonical = `${SITE_URL.replace(/\/$/, "")}/browser-extension`;
const previewImage = `${SITE_URL.replace(/\/$/, "")}/browser-extension/active-codes.webp`;

export const metadata: Metadata = {
  title,
  description,
  alternates: buildAlternates(canonical),
  openGraph: {
    type: "website",
    url: canonical,
    title,
    description,
    siteName: SITE_NAME,
    images: [
      {
        url: previewImage,
        width: 1600,
        height: 1213,
        alt: "Bloxodes active RIVALS codes shown on the Roblox game page"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [previewImage]
  }
};

export default function BrowserExtensionPage() {
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Bloxodes - Roblox Game Codes",
    description,
    url: canonical,
    installUrl: CHROME_STORE_URL,
    applicationCategory: "BrowserApplication",
    operatingSystem: "Google Chrome",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL
    }
  });

  return (
    <article className="container py-6 md:py-8 xl:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl space-y-5 pb-10 md:pb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Bloxodes for Chrome</p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Roblox codes, without leaving the game.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted">
            See active codes and seven-day player history on the Roblox game page. Sign in to keep your used codes in sync.
          </p>
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 dark:text-background"
          >
            <SiGooglechrome className="h-4 w-4" aria-hidden />
            Add to Chrome
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </header>

        <figure className="space-y-3">
          <Image
            src="/browser-extension/active-codes.webp"
            alt="Bloxodes active RIVALS codes displayed on the Roblox game page in dark mode"
            width={1600}
            height={1213}
            priority
            sizes="(max-width: 1024px) 100vw, 960px"
            className="h-auto w-full"
          />
          <figcaption className="text-sm text-muted">RIVALS codes, fully visible without leaving the game page.</figcaption>
        </figure>

        <section className="my-12 grid gap-8 border-y border-border/60 py-10 md:my-16 md:grid-cols-3">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Active codes</h2>
            <p className="leading-relaxed text-muted">See verified codes for supported games and copy them in one click.</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Player history</h2>
            <p className="leading-relaxed text-muted">View the last seven days of player activity below Roblox&apos;s game stats.</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Synced progress</h2>
            <p className="leading-relaxed text-muted">Sign in to keep used codes matched across the extension, website, and your devices.</p>
          </div>
        </section>

        <figure className="space-y-3">
          <Image
            src="/browser-extension/player-history.webp"
            alt="Bloxodes seven-day RIVALS player history displayed below Roblox game statistics in dark mode"
            width={1600}
            height={736}
            sizes="(max-width: 1024px) 100vw, 960px"
            className="h-auto w-full"
          />
          <figcaption className="text-sm text-muted">Seven-day player history, placed below Roblox&apos;s own game stats.</figcaption>
        </figure>

        <section className="mt-12 grid items-center gap-8 border-t border-border/60 pt-10 md:mt-16 md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] md:gap-14">
          <div className="max-w-xl space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Your game-page setup, one click away.</h2>
            <p className="leading-relaxed text-muted">
              Open Bloxodes from the Chrome toolbar to sign in and choose whether active codes or player history appear.
              Changes apply immediately.
            </p>
          </div>
          <figure className="space-y-3">
            <Image
              src="/browser-extension/options.webp"
              alt="Bloxodes extension popup in dark mode with active codes and player history enabled"
              width={672}
              height={910}
              sizes="(max-width: 767px) 100vw, 420px"
              className="h-auto w-full"
            />
            <figcaption className="text-sm text-muted">Sign in and control both widgets from the extension popup.</figcaption>
          </figure>
        </section>

        <footer className="mt-12 border-t border-border/60 pt-10 md:mt-16">
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Free on Google Chrome.</p>
              <p className="text-sm text-muted">
                Bloxodes never sees your Roblox password. Read our{" "}
                <Link href="/privacy-policy" className="text-foreground underline underline-offset-4 hover:text-accent">
                  privacy policy
                </Link>
                .
              </p>
            </div>
            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline hover:underline-offset-4"
            >
              Add Bloxodes to Chrome
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </footer>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </article>
  );
}
