"use client";

import Script from "next/script";

type UmamiAnalyticsProps = {
  hostUrl: string;
  websiteId: string;
};

export function UmamiAnalytics({ hostUrl, websiteId }: UmamiAnalyticsProps) {
  const normalizedHost = hostUrl.replace(/\/$/, "");

  return (
    <Script
      id="umami-analytics"
      src={`${normalizedHost}/script.js`}
      strategy="afterInteractive"
      data-website-id={websiteId}
      data-domains="bloxodes.com,www.bloxodes.com"
      data-exclude-search="true"
      data-do-not-track="true"
      data-performance="true"
    />
  );
}
