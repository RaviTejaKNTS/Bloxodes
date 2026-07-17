type ChallengePageInput = {
  body: string;
  title: string | null;
  hasCanonical: boolean;
  hasMain: boolean;
};

export function isCloudflareChallengePage({
  body,
  title,
  hasCanonical,
  hasMain
}: ChallengePageInput): boolean {
  const lowerBody = body.toLowerCase();
  const lowerTitle = title?.toLowerCase() ?? "";
  const explicitChallengeTitle =
    lowerTitle.includes("just a moment") ||
    lowerTitle.includes("attention required! | cloudflare");
  const challengeShellWithoutPageContent =
    lowerBody.includes("cf-chl-") && (!hasCanonical || !hasMain);

  return explicitChallengeTitle || challengeShellWithoutPageContent;
}

export function requiresOriginCacheTag(mode: string): boolean {
  // Cloudflare consumes Cache-Tag at the edge and does not expose it to live
  // clients. Candidate/local audits still verify the origin header directly.
  return mode !== "smoke" && mode !== "postdeploy";
}

export function addVerificationCacheBust(rawUrl: string, token: string | null): string {
  if (!token) return rawUrl;
  const url = new URL(rawUrl);
  url.searchParams.set("__bloxodes_verify", token);
  return url.toString();
}
