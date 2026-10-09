import { ReactNode } from "react";
import { PublicSiteProviders } from "@/components/PublicSiteProviders";
import { SiteShell } from "@/components/SiteShell";
import { MEDIAVINE_SCRIPT_SRC } from "@/config/mediavine";
import { SITE_URL, organizationJsonLd, siteJsonLd } from "@/lib/seo";

export const revalidate = 3600;

export default function SiteLayout({ children }: { children: ReactNode }) {
  const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  const umamiHostUrl = process.env.NEXT_PUBLIC_UMAMI_HOST_URL;
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const isProduction = process.env.NODE_ENV === "production";
  const enableLocalConsent = process.env.NEXT_PUBLIC_ENABLE_LOCAL_CONSENT === "true";
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [siteJsonLd({ siteUrl: SITE_URL }), organizationJsonLd({ siteUrl: SITE_URL })]
  });

  return (
    <PublicSiteProviders
      googleAnalyticsId={googleAnalyticsId}
      umamiHostUrl={umamiHostUrl}
      umamiWebsiteId={umamiWebsiteId}
      enableMediavine={isProduction && enableLocalConsent}
      enableLocalConsent={enableLocalConsent}
    >
      {!enableLocalConsent && isProduction ? (
        <script
          type="text/javascript"
          async
          data-noptimize="1"
          data-cfasync="false"
          src={MEDIAVINE_SCRIPT_SRC}
        />
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <SiteShell>{children}</SiteShell>
    </PublicSiteProviders>
  );
}
