import type { Metadata } from "next";
import "@/styles/article-content.css";
import { SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";

const title = "Terms of Service";
const description =
  "Terms for using the Bloxodes website, mobile apps, browser extensions, accounts, comments, and synchronized features.";
const canonical = `${SITE_URL.replace(/\/$/, "")}/terms-of-service`;
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

export default function TermsOfServicePage() {
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
          <p className="text-base text-muted sm:text-lg">
            Effective Date: January 30, 2026 · Last Updated: July 28, 2026
          </p>
          <p className="text-base text-muted sm:text-lg">
            These Terms govern the Bloxodes website, mobile apps, browser extensions, APIs, accounts, comments, and synchronized features
            (together, the &quot;Bloxodes Services&quot;). By using the Bloxodes Services, you agree to these Terms and our{" "}
            <a href="/privacy-policy">Privacy Policy</a>.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">1. About Bloxodes</h2>
          <p>
            Bloxodes is an independent Roblox companion providing codes, guides, tools, checklists, quizzes, reference pages, game
            statistics, historical player data, and optional account features. Bloxodes is not affiliated with, endorsed by, or sponsored
            by Roblox Corporation or any Roblox game developer.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">2. Eligibility</h2>
          <p>
            You must be at least 13 years old to use the Bloxodes Services. If you are under the age of majority where you live, you must
            have permission from a parent or legal guardian. Do not use comments, feedback, or account features if you are not eligible to
            provide the requested information.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">3. Roblox Sign-In and Accounts</h2>
          <p>
            Account creation is optional and currently uses Roblox&apos;s official OAuth sign-in. Bloxodes never asks for or receives your
            Roblox password. By signing in, you authorize Bloxodes to use the Roblox profile information described in our Privacy Policy to
            create and maintain your account.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>You are responsible for activity performed through your authenticated sessions and devices.</li>
            <li>Do not impersonate another person or use an account you are not authorized to access.</li>
            <li>You can sign out to revoke an active session.</li>
            <li>
              You can initiate deletion of your Bloxodes account and associated account data through the{" "}
              <a href="/account-deletion">account deletion page</a>.
            </li>
          </ul>
          <p>Deleting a Bloxodes account does not delete or modify the separate Roblox account used to sign in.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">4. Progress and Synchronization</h2>
          <p>
            Signed-out progress can be saved locally on your browser or device. When you sign in, supported used-code, checklist, and quiz
            progress can be merged with your account and synchronized across the website, mobile apps, and browser extension.
          </p>
          <p>
            Synchronization is a convenience, not a guaranteed backup service. Progress can be delayed, merged, overwritten, or lost because
            of connectivity, device storage, browser sync, service changes, bugs, or account deletion. Keep any information you consider
            important outside Bloxodes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">5. Comments, Feedback, and User Content</h2>
          <p>
            You retain ownership of comments and feedback you submit. You grant Bloxodes a worldwide, non-exclusive, royalty-free license to
            host, store, reproduce, moderate, format, publish, and display that content as needed to operate and improve the Bloxodes
            Services. This license ends when the content is deleted, except for limited copies required for security, legal compliance, or
            backups.
          </p>
          <p>You must not submit content that:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Is unlawful, threatening, abusive, hateful, sexually explicit, deceptive, or intended to harass another person.</li>
            <li>Contains passwords, payment information, private contact details, or other sensitive personal information.</li>
            <li>Infringes intellectual property, privacy, publicity, or other rights.</li>
            <li>Contains spam, malware, malicious links, advertising, impersonation, or attempts to manipulate Bloxodes systems.</li>
          </ul>
          <p>
            Comments are moderated before publication. We may reject, hide, edit for formatting, or remove submissions and may restrict
            commenting where reasonably necessary for safety, quality, or compliance. Signed-in users can manage their comments through the
            website. Guest users can request removal using the email address submitted with the comment.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Bypass security controls, rate limits, access restrictions, moderation, or authentication.</li>
            <li>Scrape, automate, or send requests in a way that disrupts the Services or imposes unreasonable load.</li>
            <li>Reverse engineer or misuse private APIs, authentication tokens, or non-public data.</li>
            <li>Use Bloxodes content or systems for fraud, phishing, credential theft, fake rewards, or unlawful activity.</li>
            <li>Interfere with Roblox, another user, or any third-party service through Bloxodes.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">7. Browser Extension and Mobile App</h2>
          <p>
            The browser extension adds Bloxodes code and player-history widgets to supported Roblox game pages. It does not modify Roblox
            itself, redeem codes, control a Roblox account, or guarantee compatibility with future Roblox page changes.
          </p>
          <p>
            Mobile and browser distribution platforms can apply their own terms, permissions, content rules, and technical restrictions.
            We may update, suspend, or discontinue an app, extension, API, or feature when necessary for security, platform compatibility,
            or product changes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">8. Bloxodes Content and Intellectual Property</h2>
          <p>
            Bloxodes text, design, software, and original graphics are owned by Bloxodes or its contributors and are protected by applicable
            law. You may use the Services for personal, non-commercial purposes. You may not republish, resell, mirror, or commercially
            exploit substantial Bloxodes content or software without permission.
          </p>
          <p>
            Roblox names, logos, game assets, and related trademarks belong to Roblox Corporation, developers, or their respective owners
            and are used for identification, commentary, and informational purposes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">9. Third-Party Services</h2>
          <p>
            The Services interact with or link to third parties such as Roblox, browser stores, mobile app stores, developer communities,
            analytics providers, and advertising providers. Their services are governed by their own terms and privacy policies. Bloxodes
            does not control their availability, security, content, or decisions.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">10. Availability and Disclaimers</h2>
          <p>
            The Bloxodes Services are provided on an &quot;as is&quot; and &quot;as available&quot; basis. Codes can expire, game data and
            historical statistics can be delayed or inaccurate, and tools can depend on assumptions or third-party information. We do not
            guarantee uninterrupted access, error-free synchronization, continued support for a game or platform, or any particular
            in-game result.
          </p>
          <p>
            Nothing on Bloxodes is legal, financial, technical, investment, or professional advice. Review our{" "}
            <a href="/disclaimer">Disclaimer</a> for additional details.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">11. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Bloxodes and its contributors will not be liable for indirect, incidental, special,
            consequential, or punitive damages, or for loss of data, progress, access, opportunities, or profits arising from use of or
            inability to use the Services. Nothing in these Terms excludes liability that cannot legally be excluded.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">12. Suspension, Termination, and Deletion</h2>
          <p>
            You may stop using the Services at any time. We may restrict or terminate access when reasonably necessary to address violations,
            abuse, security risk, legal requirements, or discontinued features. Account deletion is handled as described on the{" "}
            <a href="/account-deletion">account deletion page</a> and in the Privacy Policy.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">13. Changes and Contact</h2>
          <p>
            We may update these Terms as the Services change. The latest version will remain on this page, and material changes will be
            communicated where required. Continued use after revised Terms take effect means you accept the revised Terms.
          </p>
          <p>
            <strong>Email:</strong> <a href="mailto:getbloxodes@gmail.com">getbloxodes@gmail.com</a>
            <br />
            <strong>Website:</strong>{" "}
            <a href="https://bloxodes.com" target="_blank" rel="noopener noreferrer">
              https://bloxodes.com
            </a>
          </p>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      </article>

      <aside aria-hidden className="hidden lg:block" />
    </div>
  );
}
