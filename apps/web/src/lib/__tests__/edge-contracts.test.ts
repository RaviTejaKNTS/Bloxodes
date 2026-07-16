import { describe, expect, it } from "vitest";
import {
  addVerificationCacheBust,
  isCloudflareChallengePage,
  requiresOriginCacheTag
} from "../../../../../scripts/quality/edge-contracts";

describe("Cloudflare live-edge quality contracts", () => {
  it("does not treat Cloudflare's injected JS detection as a challenge page", () => {
    expect(
      isCloudflareChallengePage({
        body: '<html><head><title>Roblox Checklists</title><link rel="canonical" href="https://bloxodes.com/checklists"></head><body><main>Checklist content</main><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></body></html>',
        title: "Roblox Checklists",
        hasCanonical: true,
        hasMain: true
      })
    ).toBe(false);
  });

  it("detects an explicit Cloudflare challenge title", () => {
    expect(
      isCloudflareChallengePage({
        body: "<html><head><title>Just a moment...</title></head><body></body></html>",
        title: "Just a moment...",
        hasCanonical: false,
        hasMain: false
      })
    ).toBe(true);
  });

  it("detects a challenge shell without normal page content", () => {
    expect(
      isCloudflareChallengePage({
        body: '<html><body><div id="cf-chl-widget"></div></body></html>',
        title: null,
        hasCanonical: false,
        hasMain: false
      })
    ).toBe(true);
  });

  it("requires Cache-Tag from candidate and local audit responses", () => {
    expect(requiresOriginCacheTag("sitemaps")).toBe(true);
    expect(requiresOriginCacheTag("seo")).toBe(true);
    expect(requiresOriginCacheTag("routes")).toBe(true);
  });

  it("does not require Cloudflare to echo the consumed Cache-Tag header", () => {
    expect(requiresOriginCacheTag("smoke")).toBe(false);
    expect(requiresOriginCacheTag("postdeploy")).toBe(false);
  });

  it("adds a unique verification key without replacing route query parameters", () => {
    expect(
      addVerificationCacheBust(
        "https://bloxodes.com/api/stats/platform/chart?range=1d",
        "22fe3961.12345"
      )
    ).toBe(
      "https://bloxodes.com/api/stats/platform/chart?range=1d&__bloxodes_verify=22fe3961.12345"
    );
    expect(addVerificationCacheBust("https://bloxodes.com/checklists", null)).toBe(
      "https://bloxodes.com/checklists"
    );
  });
});
