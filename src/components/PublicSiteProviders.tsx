"use client";

import type { ReactNode } from "react";
import Script from "next/script";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { ConsentMode } from "@/components/consent/ConsentMode";
import { ConsentProvider } from "@/components/consent/ConsentProvider";

const JOURNEY_SCRIPT_SRC = "https://scripts.scriptwrapper.com/tags/75d9ab7d-268c-4e03-bb6c-180ca4b8d5ed.js";

type PublicSiteProvidersProps = {
  children: ReactNode;
  enableJourney?: boolean;
  enableLocalConsent?: boolean;
  googleAnalyticsId?: string;
};

function JourneyScript() {
  return (
    <Script
      id="journey-script-wrapper"
      strategy="afterInteractive"
      src={JOURNEY_SCRIPT_SRC}
      data-noptimize="1"
      data-cfasync="false"
    />
  );
}

export function PublicSiteProviders({
  children,
  enableJourney = false,
  enableLocalConsent = false,
  googleAnalyticsId
}: PublicSiteProvidersProps) {
  return (
    <ConsentProvider>
      {enableLocalConsent ? <ConsentMode /> : null}
      {enableLocalConsent && enableJourney ? (
        <ConsentGate category="marketing">
          <JourneyScript />
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
      <AnalyticsTracker />
      {children}
      {enableLocalConsent ? <ConsentBanner /> : null}
    </ConsentProvider>
  );
}
