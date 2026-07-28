import type { Metadata } from "next";
import "@/styles/article-content.css";
import { SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";

const title = "Contact Us";
const description = "Contact Bloxodes about content, accounts, comments, privacy, the mobile app, or the browser extension.";
const canonical = `${SITE_URL.replace(/\/$/, "")}/contact`;
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

export default function ContactPage() {
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: title,
    description,
    url: canonical,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "getbloxodes@gmail.com"
    }
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
      <article className="article-content prose dark:prose-invert max-w-none game-copy">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Contact Bloxodes</h1>
          <p className="text-base text-muted sm:text-lg">
            Contact us about Bloxodes content, your account, a comment, privacy, the mobile app, or the browser extension.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">How to Reach Us</h2>
          <p>
            Email us at <a href="mailto:getbloxodes@gmail.com">getbloxodes@gmail.com</a>. You can also use the Give feedback button on the
            website for product suggestions and page-specific feedback.
          </p>
          <p>
            We do not subscribe you to marketing messages when you contact us. We use your contact details to review and respond to your
            request, protect the service, and keep any record required to resolve the matter.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">What to Include</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>For code or content corrections: the game, page link, code or claim, and the correction.</li>
            <li>For extension issues: your browser, extension version, Roblox game link, and what you expected to see.</li>
            <li>For mobile issues: your platform, app version, affected screen, and any visible error.</li>
            <li>For signed-in account issues: your Roblox username or user ID. Never send your Roblox password or session token.</li>
            <li>For guest-comment requests: the page and the same email address submitted with the comment.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Privacy and Account Requests</h2>
          <p>
            For access, correction, deletion, or another privacy request, use our{" "}
            <a href="/account-deletion">account deletion and data request page</a>. We may ask for information needed to verify that the
            account, comment, or submission belongs to you.
          </p>
          <p>
            Read our <a href="/privacy-policy">Privacy Policy</a> for the information involved and available choices.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Response Times</h2>
          <p>
            We aim to respond within 5–7 business days. Legal, safety, account, and data requests can take longer while we verify the request,
            but will be handled within any timeframe required by applicable law.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Please Keep Your Message Safe</h2>
          <p>
            Do not send passwords, authentication tokens, payment details, government identification, or other sensitive information unless
            we specifically explain why it is required through a verified support exchange. Bloxodes will never ask for your Roblox
            password.
          </p>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      </article>

      <aside aria-hidden className="hidden lg:block" />
    </div>
  );
}
