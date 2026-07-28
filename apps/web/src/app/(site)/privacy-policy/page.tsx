import type { Metadata } from "next";
import "@/styles/article-content.css";
import { SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";

const title = "Privacy Policy";
const description =
  "How Bloxodes handles data across its website, mobile apps, browser extensions, accounts, comments, and synced features.";
const canonical = `${SITE_URL.replace(/\/$/, "")}/privacy-policy`;
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

export default function PrivacyPolicyPage() {
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "PrivacyPolicy",
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
          <p className="text-base text-muted sm:text-lg">{description}</p>
        </header>

        <section className="space-y-4">
          <p>
            <strong>Effective Date:</strong> January 31, 2026
            <br />
            <strong>Last Updated:</strong> July 28, 2026
          </p>
          <p>
            This policy applies to Bloxodes.com, Bloxodes mobile apps, Bloxodes browser extensions, and the APIs and account features that
            support them (together, the &quot;Bloxodes Services&quot;). Most content can be used without signing in. Roblox sign-in is optional
            and is used when you want an account, public account identity, or progress that follows you across supported devices.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">1. Information We Collect</h2>

          <p className="font-medium">Roblox account and session information</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              When you sign in with Roblox, we receive your Roblox user ID, username, display name, avatar, and profile URL through
              Roblox&apos;s official OAuth service.
            </li>
            <li>
              We create a Bloxodes account and session associated with that Roblox identity. Session records can include creation, update,
              expiration and revocation times, sign-in source, return path, IP address, and user agent.
            </li>
            <li>We never receive or store your Roblox password.</li>
          </ul>

          <p className="font-medium">Progress and preferences</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Codes you mark as used or restore, organized by game.</li>
            <li>Checklist items you complete, organized by checklist.</li>
            <li>
              Quiz activity, including seen questions, most recent score and total, difficulty breakdown, and last-attempt time.
            </li>
            <li>Theme and interface preferences.</li>
            <li>
              When signed out, progress is generally kept on your device. When signed in, supported progress is merged with your account
              and synchronized through Bloxodes APIs.
            </li>
          </ul>

          <p className="font-medium">Comments and other submissions</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Signed-in comments are associated with your Bloxodes account. Your display name and, where shown, Roblox username and avatar
              can appear publicly with an approved comment.
            </li>
            <li>
              Guest comments require a name, email address, and comment. The name and approved comment are public; the email address is not
              public and is used for moderation, safety, and handling requests about the comment.
            </li>
            <li>
              Comment text is checked using OpenAI&apos;s Moderation API before publication. We store the moderation decision and related
              categories or scores with the comment record.
            </li>
            <li>
              Feedback submissions can include your message, optional email, current page URL and path, viewport size, user agent, IP
              address, submission time, and status.
            </li>
            <li>If you email us, we receive your email address, message, and any information you choose to include.</li>
          </ul>

          <p className="font-medium">Technical, usage, and advertising information</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Requests to Bloxodes can include IP address, browser or app type, operating system, referral information, requested endpoint,
              timestamps, and security or performance information.
            </li>
            <li>
              Website analytics can record page views, approximate location, device and referrer information, performance measurements, and
              selected interactions such as searches, copied codes, checklist activity, quiz completion, and outbound clicks.
            </li>
            <li>
              Website advertising partners can use cookies or similar identifiers for ad delivery, measurement, frequency control, and
              fraud prevention.
            </li>
            <li>We do not collect payment information, physical addresses, phone numbers, or government-issued identification.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">2. Website, Mobile, and Extension Storage</h2>
          <p>
            <strong>Website:</strong> We use an essential session cookie for sign-in. Theme, consent choices, and signed-out code,
            checklist, quiz, or tool progress can be kept in cookies or browser local storage. Google Analytics and Mediavine Journey can
            set non-essential cookies or similar identifiers when permitted by the consent tools active for your region.
          </p>
          <p>
            <strong>Mobile apps:</strong> Authentication tokens are stored using the operating system&apos;s secure storage where available.
            Theme and signed-out progress are stored locally on the device. The mobile apps currently contain no Bloxodes advertising or
            third-party analytics SDKs, but their requests to Bloxodes APIs produce routine server and security logs.
          </p>
          <p>
            <strong>Browser extensions:</strong> Authentication tokens and signed-out used-code progress are stored in local extension
            storage. The Active codes and Player history widget settings are stored through the browser&apos;s sync storage so your browser
            can carry those choices to other signed-in browser installations. Authentication tokens are never placed in browser sync.
          </p>
          <p>
            Clearing cookies, app data, or local extension storage can sign you out or remove progress that has not been synchronized to an
            account. Browser vendors and operating systems control their own backup and synchronization services.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">3. Browser Extension Data</h2>
          <p>
            The current Chrome and Edge extension runs on Roblox game pages. It reads the public Roblox place ID and visible game name and
            sends those values to a Bloxodes extension API to find codes and player-history data. If the game is not tracked, Bloxodes can
            use that public place ID and game name to begin verified universe discovery and future tracking.
          </p>
          <p>
            Chrome version 4.1 and current Edge releases do not send the full page URL, URL query parameters, private-server links, Roblox
            credentials, unrelated page content, or browsing history. Older installed Chrome releases may send the public game URL as a
            compatibility fallback; users should update to the current release.
          </p>
          <p>
            Extension sign-in opens Bloxodes and Roblox&apos;s official OAuth flow. The extension receives a Bloxodes app-session token after
            sign-in and uses it only for account identification and used-code synchronization. Signing out revokes that extension session.
            The extension currently contains no advertising, analytics, or cross-site tracking code.
          </p>
          <p>
            Bloxodes&apos;s use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including its
            Limited Use requirements. Extension data is used only to provide and improve the extension&apos;s disclosed game-companion
            features, maintain security, and comply with law.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">4. How We Use Information</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Provide accounts, authentication, comments, feedback, preferences, and cross-device progress.</li>
            <li>Identify Roblox games and provide codes, historical player counts, tools, and other requested content.</li>
            <li>Moderate submissions, prevent abuse, enforce rate limits, and protect users and the Bloxodes Services.</li>
            <li>Measure website usage, diagnose errors, maintain performance, and improve content and features.</li>
            <li>Display and measure website advertising where permitted.</li>
            <li>Respond to support, privacy, deletion, legal, and safety requests.</li>
          </ul>
          <p>
            Depending on where you live, we rely on consent, performance of our agreement with you, our legitimate interests in operating
            and securing the Bloxodes Services, and compliance with legal obligations.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">5. Analytics and Advertising</h2>
          <p>
            The website uses Google Analytics 4 and self-hosted Umami to understand usage and performance. We use this information in
            aggregate and do not intentionally send your Bloxodes account ID, Roblox user ID, comment email, or feedback email to these
            analytics services.
          </p>
          <p>
            The website uses Mediavine Journey and related advertising services. Advertising providers may use cookies and similar
            technologies to deliver and measure ads and prevent fraud. The extension and mobile apps do not currently contain Bloxodes ads.
          </p>
          <p>
            Use the controls shown by our consent partner, our{" "}
            <a href="/cookie-settings">cookie settings page</a>, and your browser or device settings to manage available choices. You can
            also review Mediavine&apos;s{" "}
            <a href="https://www.mediavine.com/privacy-policy/" target="_blank" rel="noopener noreferrer">
              privacy policy
            </a>{" "}
            and industry opt-out choices at{" "}
            <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer">
              YourAdChoices
            </a>
            .
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">6. When We Share Information</h2>
          <p>We do not sell account records, comments, feedback submissions, or synced progress. We disclose data only as needed to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Roblox for OAuth authentication and Roblox profile or game information.</li>
            <li>OpenAI for automated moderation of submitted comment text.</li>
            <li>Google Analytics for website measurement.</li>
            <li>Mediavine Journey and its advertising partners for website advertising and measurement.</li>
            <li>Our self-hosted Umami and Supabase services for analytics, database, storage, and account operations.</li>
            <li>Hosting, CDN, security, and network providers, including infrastructure used to deliver and protect the Services.</li>
            <li>Authorities or other parties when required by law or reasonably necessary to protect rights, safety, and security.</li>
          </ul>
          <p>
            Some U.S. privacy laws define certain personalized advertising disclosures as &quot;sharing&quot; even when no money changes
            hands. Where required, the active consent and advertising controls provide the available opt-out choices.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">7. Retention</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Account and synchronized progress are kept while your account remains active or until deletion is completed.</li>
            <li>Session tokens expire or are revoked; security records can be retained longer when needed to investigate abuse.</li>
            <li>Comments and moderation records are kept while published or while needed for moderation, disputes, and safety.</li>
            <li>Feedback and support messages are kept until resolved and then only as long as reasonably necessary.</li>
            <li>Analytics, advertising, and infrastructure records follow the configured schedules of the relevant systems and providers.</li>
          </ul>
          <p>
            We may retain limited records where required by law, to resolve disputes, prevent abuse, or document a completed privacy
            request. Local data remains until you clear it, uninstall the app or extension, or the browser or operating system removes it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">8. Your Choices and Rights</h2>
          <p>
            Depending on your location, you may have rights to access, correct, delete, restrict, or receive a copy of personal data; object
            to or opt out of certain processing; withdraw consent; or appeal a decision. We may need to verify your Roblox-linked identity,
            comment email, or other relevant information before completing a request.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Signed-in users can edit or delete their own comments through the website.</li>
            <li>Guest-comment removal requests can be sent from the email address used for that comment.</li>
            <li>
              Account and associated-data deletion can be initiated through our{" "}
              <a href="/account-deletion">account deletion page</a>.
            </li>
            <li>Local progress can be removed by clearing website, app, or extension storage.</li>
            <li>Website analytics and advertising choices can be managed through the controls available for your region.</li>
          </ul>
          <p>
            We will not discriminate against you for exercising a privacy right. If applicable law provides a right to complain to a data
            protection authority, you may also contact the authority where you live.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">9. Children&apos;s Privacy</h2>
          <p>
            The Bloxodes Services are intended for people aged 13 and older. If you are under the age of majority where you live, use the
            Services only with permission from a parent or guardian. We do not knowingly collect personal information from children under
            13. A parent or guardian who believes a child submitted personal information can contact us for removal.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">10. Security and International Processing</h2>
          <p>
            We use access controls, HTTPS, restricted server-side credentials, expiring or revocable sessions, and platform-provided secure
            storage where available. No system is completely secure, so we cannot guarantee absolute security.
          </p>
          <p>
            Bloxodes and its providers may process information in countries other than your own. Where required, providers use recognized
            transfer mechanisms and safeguards for international processing.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">11. Changes and Contact</h2>
          <p>
            We may update this policy when the Bloxodes Services, providers, or legal requirements change. Material changes will be
            communicated through an appropriate in-product or website notice where required.
          </p>
          <p>
            <strong>Email:</strong> <a href="mailto:getbloxodes@gmail.com">getbloxodes@gmail.com</a>
            <br />
            <strong>Privacy and deletion requests:</strong> <a href="/account-deletion">Account deletion and data requests</a>
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
