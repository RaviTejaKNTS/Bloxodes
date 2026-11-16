import { cleanRewardsText, sortCodesByFirstSeenDesc } from "./code-utils";
import { markdownToPlainText } from "./markdown";

export type SeoCode = {
  code: string;
  status: string;
  rewards_text?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  verified_at?: string | null;
};

export function normalizeActiveCodeTitle(title: string): string {
  return title.replace(/\b1 Active Codes\b/gi, "1 Active Code");
}

export function activeCodeLabel(count: number): string {
  return `${count} Active ${count === 1 ? "Code" : "Codes"}`;
}

/** Use stored checks only. The legacy second argument is an edit date and is ignored. */
export function codePageLastChecked(codes: SeoCode[], _editorialUpdatedAt?: string | null): string | null {
  return codes.flatMap(code => [code.last_seen_at, code.verified_at]).reduce<string | null>((latest, value) => {
    if (!value || !Number.isFinite(Date.parse(value))) return latest;
    return !latest || Date.parse(value) > Date.parse(latest) ? value : latest;
  }, null);
}

export function codePageDescription({ name, codes, lastChecked, legacyExpiredCodes = [], hasRedeemHelp = false, hasExpiryHelp = false }: {
  name: string;
  codes: SeoCode[];
  lastChecked: string | null;
  legacyExpiredCodes?: string[];
  hasRedeemHelp?: boolean;
  hasExpiryHelp?: boolean;
}): string {
  const active = sortCodesByFirstSeenDesc(codes.filter(code => code.status === "active")
    .map(code => ({ ...code, first_seen_at: code.first_seen_at ?? "" })));
  const checked = lastChecked && Number.isFinite(Date.parse(lastChecked))
    ? `, last checked ${new Date(lastChecked).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`
    : "";
  const append = (base: string, sentence: string) => base.length + sentence.length <= 160 ? base + sentence : base;
  if (!active.length) {
    const expired = new Set([
      ...codes.filter(code => code.status === "expired").map(code => code.code),
      ...legacyExpiredCodes.filter(code => typeof code === "string" && !/\s/.test(code))
    ].map(code => code.toUpperCase()));
    let description = `No active ${name} codes right now${checked}.`;
    if (description.length > 160) description = `No active ${name} codes right now.`;
    if (description.length > 160) description = "No active codes right now.";
    if (expired.size) description = append(description, ` ${expired.size} expired ${expired.size === 1 ? "code" : "codes"} listed.`);
    return hasExpiryHelp ? append(description, " See why codes expire and where new ones appear.") : description;
  }
  const newest = active[0];
  let base = `${active.length} active ${name} ${active.length === 1 ? "code" : "codes"}${checked}. Newest code: ${newest.code}.`;
  if (base.length > 160) base = `${active.length} active ${name} ${active.length === 1 ? "code" : "codes"}. Newest code: ${newest.code}.`;
  if (base.length > 160) base = `${active.length} active ${name} ${active.length === 1 ? "code" : "codes"}.`;
  if (base.length > 160) base = `${active.length} active ${active.length === 1 ? "code" : "codes"}.`;
  const cleanedReward = cleanRewardsText(markdownToPlainText(newest.rewards_text ?? ""));
  const reward = cleanedReward && !/[<>…]|\.\.\./.test(cleanedReward) ? cleanedReward.replace(/[.!]+$/, "") : null;
  const withReward = reward ? append(base, ` Reward: ${reward}.`) : base;
  return hasRedeemHelp ? append(withReward, " See how to redeem them and why a code might not work.") : withReward;
}

export function robloxCodePageDescription(game: { name: string; updated_at: string; expired_codes?: string[] | null; redeem_md?: string | null; troubleshoot_md?: string | null }, codes: SeoCode[]): string {
  return codePageDescription({ name: game.name, codes, lastChecked: codePageLastChecked(codes), legacyExpiredCodes: game.expired_codes ?? [], hasRedeemHelp: Boolean(game.redeem_md?.trim() && game.troubleshoot_md?.trim()) });
}

export function gameCodeDescription(
  page: { redeem_md?: string | null; troubleshoot_md?: string | null },
  data: { name: string; codes: SeoCode[] }
) {
  return codePageDescription({ name: data.name, codes: data.codes, lastChecked: codePageLastChecked(data.codes), hasRedeemHelp: Boolean(page.redeem_md?.trim() && page.troubleshoot_md?.trim()) });
}
