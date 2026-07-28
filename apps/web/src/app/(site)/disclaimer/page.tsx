import type { Metadata } from "next";
import "@/styles/article-content.css";
import { SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";

const title = "Disclaimer";
const description =
  "Important limitations for Bloxodes codes, guides, tools, statistics, mobile apps, browser extensions, and synchronized features.";
const canonical = `${SITE_URL.replace(/\/$/, "")}/disclaimer`;
const ogImage = `${SITE_URL}/Bloxodes.png`;

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
    images: [ogImage]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage]
  }
};

export default function DisclaimerPage() {
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: canonical,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL
    }
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
      <article className="article-content prose dark:prose-invert max-w-none game-copy">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{title}</h1>
          <p className="text-base text-muted sm:text-lg">Effective Date: January 31, 2026 · Last Updated: July 28, 2026</p>
          <p className="text-base text-muted sm:text-lg">
            This Disclaimer applies to the Bloxodes website, mobile apps, browser extensions, APIs, accounts, and synchronized features.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Independent Roblox Companion</h2>
          <p>
            Bloxodes is a fan-made, independent service. It is not affiliated with, endorsed by, sponsored by, or operated by Roblox
            Corporation, Roblox game developers, Google, Microsoft, or Apple. Roblox names, game assets, logos, and trademarks belong to
            their respective owners and are used for identification and informational purposes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Codes and Editorial Information</h2>
          <p>
            Codes are created and controlled by game developers and can expire, change, become region- or account-specific, or stop working
            without notice. Guides and reference pages can become outdated after game updates. We verify and update information, but cannot
            guarantee that every code, reward, instruction, value, or source remains accurate at the time you use it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Statistics and Historical Data</h2>
          <p>
            Bloxodes game statistics and historical player charts depend on Roblox data, scheduled collection, processing, and network
            availability. Values can be delayed, incomplete, unavailable, rounded, or affected by collection gaps. Historical charts are for
            general comparison and discovery, not a guarantee of present or future game activity.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Tools, Calculators, and Quizzes</h2>
          <p>
            Calculators and tools use published data, formulas, assumptions, and user input. Results are estimates unless clearly stated
            otherwise. Quizzes are for entertainment and learning. None of these results are professional, financial, investment, legal, or
            technical advice.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Browser Extension</h2>
          <p>
            The Bloxodes extension displays codes and historical player information on supported Roblox game pages. It does not redeem
            codes, operate your Roblox account, change Roblox game data, or form part of Roblox. Roblox page changes, browser updates,
            permissions, network failures, or another installed extension can cause widgets to move, display incorrectly, or stop working.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Accounts, Local Data, and Synchronization</h2>
          <p>
            Bloxodes accounts and synchronization are convenience features. Local or synchronized used-code, checklist, quiz, theme, and
            other progress can be delayed, merged, overwritten, or lost because of device storage, connectivity, software changes, account
            deletion, or service errors. Bloxodes is not a permanent backup service.
          </p>
          <p>
            Roblox authentication is handled through Roblox&apos;s official OAuth flow. Bloxodes never asks for or receives your Roblox
            password. You remain responsible for your Roblox account and authenticated devices.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Availability and External Services</h2>
          <p>
            Bloxodes relies on third-party platforms, APIs, hosting, app stores, browsers, and network services. We do not control their
            availability, policies, security, content, or decisions. The Bloxodes Services may be interrupted, changed, restricted, or
            discontinued without notice where necessary.
          </p>
          <p>
            External links are provided for reference. Review the terms and privacy practices of third-party destinations before using them
            or submitting information.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">User Responsibility</h2>
          <p>
            Use Bloxodes information at your own discretion and verify important details through official game or platform sources. Never
            share passwords, authentication tokens, payment information, or sensitive personal information with anyone claiming to offer
            codes, Robux, rewards, support, or account access.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Bloxodes and its contributors are not liable for indirect, incidental, special,
            consequential, or punitive damages, or for loss of data, progress, access, opportunities, or profits arising from use of or
            reliance on the Bloxodes Services. Nothing in this Disclaimer limits rights or liability that cannot legally be limited.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Contact</h2>
          <p>
            Questions about this Disclaimer can be sent to{" "}
            <a href="mailto:getbloxodes@gmail.com">getbloxodes@gmail.com</a>. Also review our{" "}
            <a href="/terms-of-service">Terms of Service</a> and <a href="/privacy-policy">Privacy Policy</a>.
          </p>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      </article>

      <aside aria-hidden className="hidden lg:block" />
    </div>
  );
}
