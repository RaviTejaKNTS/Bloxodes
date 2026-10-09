"use client";

import type { ReactNode } from "react";
import Script from "next/script";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { UmamiAnalytics } from "@/components/UmamiAnalytics";
import { UmamiEngagementTracker } from "@/components/UmamiEngagementTracker";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { ConsentMode } from "@/components/consent/ConsentMode";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import { MEDIAVINE_SCRIPT_SRC } from "@/config/mediavine";

type PublicSiteProvidersProps = {
  children: ReactNode;
  enableMediavine?: boolean;
  enableLocalConsent?: boolean;
  googleAnalyticsId?: string;
  umamiHostUrl?: string;
  umamiWebsiteId?: string;
};

function MediavineScript() {
  return (
    <Script
      id="mediavine-script"
      type="text/javascript"
      async
      strategy="afterInteractive"
      src={MEDIAVINE_SCRIPT_SRC}
      data-noptimize="1"
      data-cfasync="false"
    />
  );
}

export function PublicSiteProviders({
  children,
  enableMediavine = false,
  enableLocalConsent = false,
  googleAnalyticsId,
  umamiHostUrl,
  umamiWebsiteId
}: PublicSiteProvidersProps) {
  const umamiAnalytics =
    umamiHostUrl && umamiWebsiteId ? (
      <>
        <UmamiAnalytics hostUrl={umamiHostUrl} websiteId={umamiWebsiteId} />
        <UmamiEngagementTracker />
      </>
    ) : null;

  return (
    <ConsentProvider>
      {enableLocalConsent ? <ConsentMode /> : null}
      {enableLocalConsent && enableMediavine ? (
        <ConsentGate category="marketing">
          <MediavineScript />
        </ConsentGate>
      ) : null}
      {googleAnalyticsId ? (
        enableLocalConsent ? (
          <ConsentGate category="analytics">
            <GoogleAnalytics measurementId={googleAnalyticsId} />
          </ConsentGate>
        ) : (
          <GoogleAnalytics measurementId={googleAnalyticsId} />
        )
      ) : null}
      {umamiAnalytics ? (
        enableLocalConsent ? <ConsentGate category="analytics">{umamiAnalytics}</ConsentGate> : umamiAnalytics
      ) : null}
      <AnalyticsTracker />
      {children}
      {enableLocalConsent ? <ConsentBanner /> : null}
    </ConsentProvider>
  );
}
