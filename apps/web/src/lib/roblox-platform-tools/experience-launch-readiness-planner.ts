export const LAUNCH_CHECKLIST_SCHEMA_VERSION = 1;
export const LAUNCH_RULES_VERIFIED_DATE = "2026-08-31";

export type LaunchReach = "16plus" | "allAges";
export type LaunchProfile = {
  reach: LaunchReach;
  groupOwned: boolean;
  visiblePlayerText: boolean;
  purchases: boolean;
  mobile: boolean;
  console: boolean;
};
export type LaunchItemGroup = "Publication and policy" | "Store page and audience" | "Gameplay and reliability" | "Performance and operations";
export type LaunchItem = {
  id: string;
  group: LaunchItemGroup;
  severity: "blocker" | "recommended";
  title: string;
  rationale: string;
  sourceUrl: string;
  applies: (profile: LaunchProfile) => boolean;
};

const always = () => true;
const publishing = "https://create.roblox.com/docs/production/publishing/publish-games-and-places";
const safety = "https://create.roblox.com/docs/safety";
const testing = "https://create.roblox.com/docs/studio/testing-modes";
const performance = "https://create.roblox.com/docs/performance-optimization";

export const LAUNCH_ITEMS: LaunchItem[] = [
  { id: "account-standing-age", group: "Publication and policy", severity: "blocker", title: "Account is in good standing and at least two days old", rationale: "Roblox currently lists both conditions for Public/Limited reach.", sourceUrl: publishing, applies: always },
  { id: "age-check", group: "Publication and policy", severity: "blocker", title: "Required age check is complete", rationale: "Current Public/Limited reach requires facial estimation, phone, or government-ID age checking.", sourceUrl: publishing, applies: always },
  { id: "maturity-questionnaire", group: "Publication and policy", severity: "blocker", title: "Maturity & Compliance answers are submitted and accurate", rationale: "All public games need an accurate questionnaire, updated when content changes.", sourceUrl: safety, applies: always },
  { id: "publish-permission", group: "Publication and policy", severity: "blocker", title: "The launch owner has publish and configuration permission", rationale: "Ownership and group role permissions control publishing and configuration access.", sourceUrl: "https://create.roblox.com/docs/projects/configure-games", applies: always },
  { id: "community-ip-review", group: "Publication and policy", severity: "blocker", title: "Content, metadata, audio, and artwork passed policy and rights review", rationale: "Published content must meet Community Standards and use assets the creator has rights to distribute.", sourceUrl: safety, applies: always },
  { id: "visible-text-filtering", group: "Publication and policy", severity: "blocker", title: "Every visible player-entered text path uses Roblox filtering", rationale: "Roblox requires filtering for user-generated text visible to other players.", sourceUrl: safety, applies: (profile) => profile.visiblePlayerText },
  { id: "all-ages-identity", group: "Publication and policy", severity: "blocker", title: "ID verification or linked parental account is complete", rationale: "Current all-ages reach adds this identity requirement.", sourceUrl: publishing, applies: (profile) => profile.reach === "allAges" },
  { id: "all-ages-2fa", group: "Publication and policy", severity: "blocker", title: "Roblox account 2FA is enabled", rationale: "Current all-ages reach requires 2FA.", sourceUrl: publishing, applies: (profile) => profile.reach === "allAges" },
  { id: "all-ages-publishing-path", group: "Publication and policy", severity: "blocker", title: "Subscription history or refundable publishing-fee path is satisfied", rationale: "Current all-ages reach requires the qualifying subscription duration or fee route.", sourceUrl: publishing, applies: (profile) => profile.reach === "allAges" },
  { id: "all-ages-evaluation", group: "Publication and policy", severity: "blocker", title: "Kids/Select evaluation is complete in Creator Dashboard", rationale: "Roblox currently requires the game to pass evaluation for Kids and Select accounts.", sourceUrl: publishing, applies: (profile) => profile.reach === "allAges" },
  { id: "metadata-accurate", group: "Store page and audience", severity: "recommended", title: "Name and description accurately summarize the game without spam", rationale: "Clear metadata sets player expectations and avoids irrelevant keyword repetition.", sourceUrl: publishing, applies: always },
  { id: "icon-ready", group: "Store page and audience", severity: "recommended", title: "Square 512×512-or-larger icon is readable at small size", rationale: "Roblox's current icon guidance uses square geometry and a 512-pixel minimum.", sourceUrl: "https://create.roblox.com/docs/production/publishing/experience-icons", applies: always },
  { id: "thumbnails-ready", group: "Store page and audience", severity: "recommended", title: "Authentic 16:9 thumbnails are approved and include useful alt text", rationale: "Roblox recommends 1920×1080 image thumbnails and accurate representation of gameplay.", sourceUrl: "https://create.roblox.com/docs/production/publishing/thumbnails", applies: always },
  { id: "audience-regions", group: "Store page and audience", severity: "recommended", title: "Audience, regions, devices, beta mode, and start place are reviewed", rationale: "These settings determine who can access the launch and where players enter.", sourceUrl: "https://create.roblox.com/docs/projects/configure-games", applies: always },
  { id: "localization-source", group: "Store page and audience", severity: "recommended", title: "Source language and player-facing strings are reviewed", rationale: "Localization settings and pseudolocalization help expose untranslated or clipped text.", sourceUrl: "https://create.roblox.com/docs/production/localization", applies: always },
  { id: "onboarding-core-loop", group: "Gameplay and reliability", severity: "recommended", title: "First join, onboarding, core loop, failure, retry, and reconnect work", rationale: "The critical player path needs an end-to-end launch test.", sourceUrl: testing, applies: always },
  { id: "multi-client-test", group: "Gameplay and reliability", severity: "recommended", title: "Client/server and multi-client join, leave, and teleport paths are tested", rationale: "Roblox's client-server model needs testing beyond a single editing session.", sourceUrl: testing, applies: always },
  { id: "mobile-test", group: "Gameplay and reliability", severity: "recommended", title: "Touch, orientation, safe areas, UI, and mobile performance are tested", rationale: "Mobile support adds touch and device-layout requirements.", sourceUrl: testing, applies: (profile) => profile.mobile },
  { id: "gamepad-test", group: "Gameplay and reliability", severity: "recommended", title: "Gamepad focus, prompts, navigation, and platform differences are tested", rationale: "Console support needs complete controller navigation and supported feature checks.", sourceUrl: testing, applies: (profile) => profile.console },
  { id: "save-rejoin-test", group: "Gameplay and reliability", severity: "recommended", title: "Save, retry, duplicate-write, rejoin, shutdown, and migration paths are tested", rationale: "Persistent state needs failure testing without risking production data in Studio.", sourceUrl: "https://create.roblox.com/docs/cloud-services/data-stores", applies: always },
  { id: "purchase-receipts", group: "Gameplay and reliability", severity: "recommended", title: "Receipts, durable entitlements, duplicate delivery, and failures are tested", rationale: "Purchases need server-authoritative and durable fulfillment handling.", sourceUrl: "https://create.roblox.com/docs/production/monetization", applies: (profile) => profile.purchases },
  { id: "client-performance", group: "Performance and operations", severity: "recommended", title: "Low-end client memory, frame rate, load time, and crashes are checked", rationale: "Representative device testing exposes client performance limits.", sourceUrl: performance, applies: always },
  { id: "server-performance", group: "Performance and operations", severity: "recommended", title: "Server memory, heartbeat, scripts, physics, network, and load are checked", rationale: "Realistic server load must fit memory and compute capacity.", sourceUrl: performance, applies: always },
  { id: "errors-crashes", group: "Performance and operations", severity: "recommended", title: "Errors, failed requests, crashes, and long-session memory growth are reviewed", rationale: "Launch monitoring starts with a clean known baseline.", sourceUrl: "https://create.roblox.com/docs/performance-optimization/monitor", applies: always },
  { id: "rollback-version", group: "Performance and operations", severity: "recommended", title: "Launch versions, rollback owner, trigger, and runbook are confirmed", rationale: "Roblox retains Version History, but the team still needs a rollback decision and verification plan.", sourceUrl: "https://create.roblox.com/docs/projects/configure-games", applies: always },
  { id: "analytics-monitoring", group: "Performance and operations", severity: "recommended", title: "Launch monitoring window, owners, and applicable metrics are set", rationale: "Performance, crashes, acquisition, retention, monetization, and safety signals need owners.", sourceUrl: "https://create.roblox.com/docs/production/analytics", applies: always },
  { id: "moderation-response", group: "Performance and operations", severity: "recommended", title: "Reports, bans, UGC abuse, policy restrictions, and escalation are prepared", rationale: "Safety tools and a response owner reduce the impact of launch abuse.", sourceUrl: safety, applies: always }
];

export const DEFAULT_LAUNCH_PROFILE: LaunchProfile = { reach: "16plus", groupOwned: false, visiblePlayerText: false, purchases: false, mobile: true, console: false };

export function getActiveLaunchItems(profile: LaunchProfile): LaunchItem[] {
  return LAUNCH_ITEMS.filter((item) => item.applies(profile));
}

export function summarizeLaunchReadiness(profile: LaunchProfile, completed: Record<string, boolean>) {
  const active = getActiveLaunchItems(profile);
  const blockers = active.filter((item) => item.severity === "blocker");
  const recommended = active.filter((item) => item.severity === "recommended");
  const completedBlockers = blockers.filter((item) => completed[item.id]).length;
  const completedRecommended = recommended.filter((item) => completed[item.id]).length;
  const remaining = active.filter((item) => !completed[item.id]);
  return {
    active,
    blockers,
    recommended,
    completedBlockers,
    completedRecommended,
    remainingBlockers: blockers.length - completedBlockers,
    remainingRecommended: recommended.length - completedRecommended,
    status: completedBlockers < blockers.length ? "blocked" as const : completedRecommended < recommended.length ? "blockers-clear" as const : "complete" as const,
    remaining
  };
}

export function createLaunchChecklistExport(profile: LaunchProfile, completed: Record<string, boolean>, generatedAt: string) {
  const active = getActiveLaunchItems(profile);
  return {
    schemaVersion: LAUNCH_CHECKLIST_SCHEMA_VERSION,
    generatedAt,
    profile,
    activeItemIds: active.map((item) => item.id),
    completed: Object.fromEntries(active.map((item) => [item.id, completed[item.id] === true]))
  };
}

export function buildLaunchPlainText(profile: LaunchProfile, completed: Record<string, boolean>): string {
  const summary = summarizeLaunchReadiness(profile, completed);
  const lines = [
    "Roblox experience launch readiness",
    `Reach: ${profile.reach === "allAges" ? "All ages including Kids/Select" : "16+ and Trusted Friends"}`,
    `Blockers: ${summary.completedBlockers}/${summary.blockers.length} complete`,
    `Recommended: ${summary.completedRecommended}/${summary.recommended.length} complete`,
    "",
    "Unresolved:"
  ];
  if (!summary.remaining.length) lines.push("- None");
  else for (const item of summary.remaining) lines.push(`- [${item.severity === "blocker" ? "BLOCKER" : "RECOMMENDED"}] ${item.title}`);
  return lines.join("\n");
}
