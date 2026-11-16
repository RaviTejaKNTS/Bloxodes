import { cleanRewardsText, sortCodesByFirstSeenDesc } from "./code-utils";
import { markdownToPlainText } from "./markdown";

export type SeoCode = {
  code: string;
  status: string;
  rewards_text?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
};

export function normalizeActiveCodeTitle(title: string): string {
  return title.replace(/\b1 Active Codes\b/gi, "1 Active Code");
}

export function activeCodeLabel(count: number): string {
  return `${count} Active ${count === 1 ? "Code" : "Codes"}`;
}

/** Use stored checks only. A missing date must never become today's date. */
export function codePageLastChecked(codes: SeoCode[], updatedAt?: string | null): string | null {
  return [updatedAt, ...codes.map(code => code.last_seen_at)].reduce<string | null>((latest, value) => {
    if (!value || !Number.isFinite(Date.parse(value))) return latest;
    return !latest || Date.parse(value) > Date.parse(latest) ? value : latest;
  }, null);
}

export function codePageDescription({ name, codes, lastChecked, legacyExpiredCodes = [] }: {
  name: string;
  codes: SeoCode[];
  lastChecked: string | null;
  legacyExpiredCodes?: string[];
}): string {
  const active = sortCodesByFirstSeenDesc(codes.filter(code => code.status === "active")
    .map(code => ({ ...code, first_seen_at: code.first_seen_at ?? "" })));
  const checked = lastChecked && Number.isFinite(Date.parse(lastChecked))
    ? `, last checked ${new Date(lastChecked).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`
    : "";
  if (!active.length) {
    const expired = new Set([
      ...codes.filter(code => code.status === "expired").map(code => code.code),
      ...legacyExpiredCodes.filter(code => typeof code === "string" && !/\s/.test(code))
    ].map(code => code.toUpperCase()));
    return `No active ${name} codes right now${checked}.${expired.size ? ` ${expired.size} expired ${expired.size === 1 ? "code" : "codes"} listed.` : ""}`;
  }
  const newest = active[0];
  const base = `${active.length} active ${name} ${active.length === 1 ? "code" : "codes"}${checked}. Newest code: ${newest.code}.`;
  const cleanedReward = cleanRewardsText(markdownToPlainText(newest.rewards_text ?? ""));
  const reward = cleanedReward && !/[<>…]|\.\.\./.test(cleanedReward) ? cleanedReward.replace(/[.!]+$/, "") : null;
  const withReward = reward ? `${base} Reward: ${reward}.` : base;
  return reward && withReward.length < 155 ? withReward : base;
}

export function robloxCodePageDescription(game: { name: string; updated_at: string; expired_codes?: string[] | null }, codes: SeoCode[]): string {
  return codePageDescription({ name: game.name, codes, lastChecked: codePageLastChecked(codes, game.updated_at), legacyExpiredCodes: game.expired_codes ?? [] });
}
