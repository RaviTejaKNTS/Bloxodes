import { ReactNode } from "react";
import { PublicSiteProviders } from "@/components/PublicSiteProviders";
import { SiteShell } from "@/components/SiteShell";
import { SITE_URL, organizationJsonLd, siteJsonLd } from "@/lib/seo";

export default function SiteLayout({ children }: { children: ReactNode }) {
  const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  const isProduction = process.env.NODE_ENV === "production";
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [siteJsonLd({ siteUrl: SITE_URL }), organizationJsonLd({ siteUrl: SITE_URL })]
  });

  return (
    <PublicSiteProviders googleAnalyticsId={googleAnalyticsId} enableJourney={isProduction}>
      <SiteShell
        integrations={
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
        }
      >
        {children}
      </SiteShell>
    </PublicSiteProviders>
  );
}
