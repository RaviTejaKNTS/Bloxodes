import type { Metadata } from "next";
import "@/styles/article-content.css";
import { getCurrentAppUser } from "@/lib/auth/app-session";
import { SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";

const title = "Account Deletion and Data Requests";
const description = "Request deletion of a Bloxodes account or associated personal data.";
const canonical = `${SITE_URL.replace(/\/$/, "")}/account-deletion`;
const ogImage = `${SITE_URL}/Bloxodes.png`;

export const dynamic = "force-dynamic";

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

export default async function AccountDeletionPage() {
  const appUser = await getCurrentAppUser();
  const robloxIdentity = appUser?.roblox_username
    ? `Roblox username: ${appUser.roblox_username}\nRoblox user ID: ${appUser.roblox_user_id ?? "not available"}`
    : "Roblox username or user ID: ";
  const mailtoHref = `mailto:getbloxodes@gmail.com?subject=${encodeURIComponent("Bloxodes account deletion request")}&body=${encodeURIComponent(
    `I request deletion of my Bloxodes account and associated account data.\n\n${robloxIdentity}\n\nI understand that this does not delete my Roblox account.`
  )}`;

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
            Use this page to initiate deletion of your Bloxodes account or request access, correction, or deletion of associated data.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Request Account Deletion</h2>
          <p>
            Send a deletion request using the link below. If you are signed in on this browser, your Roblox username and user ID are added to
            the draft to help us locate the correct Bloxodes account.
          </p>
          <p>
            <a href={mailtoHref}>Email an account deletion request</a>
          </p>
          <p>
            If the email link does not open, email <a href="mailto:getbloxodes@gmail.com">getbloxodes@gmail.com</a> with the subject
            &quot;Bloxodes account deletion request&quot; and include your Roblox username or user ID.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Verification</h2>
          <p>
            We may ask you to sign in again or complete another reasonable verification step before deleting account data. Do not send your
            Roblox password, a Bloxodes session token, or payment information. Bloxodes will never ask for your Roblox password.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">What Account Deletion Covers</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Your Bloxodes account profile and Roblox identity association.</li>
            <li>Active Bloxodes website, mobile, and extension sessions.</li>
            <li>Account-synchronized used-code, checklist, and quiz progress.</li>
            <li>Account associations on comments, which can be removed or anonymized as part of the request.</li>
          </ul>
          <p>
            Limited records can be retained where required for security, fraud prevention, disputes, or legal compliance. Details are in our{" "}
            <a href="/privacy-policy">Privacy Policy</a>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">What It Does Not Delete</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Your Roblox account or any information held independently by Roblox.</li>
            <li>Local data remaining in a signed-out browser, mobile app, or extension.</li>
          </ul>
          <p>
            To remove local data, sign out and clear the app, website, or extension storage, or uninstall the relevant app or extension.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Other Data Requests</h2>
          <p>
            Use the same email address for requests to access or correct account data, remove a guest comment, or delete a feedback
            submission. For guest comments, write from the email address originally submitted and include the page link.
          </p>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      </article>

      <aside aria-hidden className="hidden lg:block" />
    </div>
  );
}
