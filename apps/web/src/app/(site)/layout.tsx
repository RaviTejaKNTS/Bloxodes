import { ReactNode } from "react";
import { PublicSiteProviders } from "@/components/PublicSiteProviders";
import { SiteShell } from "@/components/SiteShell";
import { SITE_URL, organizationJsonLd, siteJsonLd } from "@/lib/seo";

const JOURNEY_SCRIPT_SRC = "//scripts.scriptwrapper.com/tags/75d9ab7d-268c-4e03-bb6c-180ca4b8d5ed.js";

export default function SiteLayout({ children }: { children: ReactNode }) {
  const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  const isProduction = process.env.NODE_ENV === "production";
  const enableLocalConsent = process.env.NEXT_PUBLIC_ENABLE_LOCAL_CONSENT === "true";
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [siteJsonLd({ siteUrl: SITE_URL }), organizationJsonLd({ siteUrl: SITE_URL })]
  });

  return (
    <PublicSiteProviders
      googleAnalyticsId={googleAnalyticsId}
      enableJourney={isProduction && enableLocalConsent}
      enableLocalConsent={enableLocalConsent}
    >
      <SiteShell
        integrations={
          <>
            {!enableLocalConsent && isProduction ? (
              <script
                type="text/javascript"
                async
                data-noptimize="1"
                data-cfasync="false"
                src={JOURNEY_SCRIPT_SRC}
              />
            ) : null}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
          </>
        }
      >
        {children}
      </SiteShell>
    </PublicSiteProviders>
  );
}
