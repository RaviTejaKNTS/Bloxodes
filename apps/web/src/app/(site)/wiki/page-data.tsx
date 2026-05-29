import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  FiCalendar,
  FiClock,
  FiEye,
  FiMonitor,
  FiRefreshCw,
  FiShield,
  FiSmartphone,
  FiStar,
  FiTablet,
  FiTag,
  FiTv,
  FiUser,
  FiUsers
} from "react-icons/fi";
import { FaCrown, FaDiscord, FaFacebook, FaMedal, FaTrophy, FaTwitch, FaYoutube } from "react-icons/fa";
import { RiTwitterXLine } from "react-icons/ri";
import { SiGuilded, SiGooglechrome, SiRoblox } from "react-icons/si";
import { TbAugmentedReality } from "react-icons/tb";
import { Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { markdownToPlainText, renderMarkdown } from "@/lib/markdown";
import { processHtmlLinks } from "@/lib/link-utils";
import { renderHtmlAsReactNodes } from "@/lib/html-to-react";
import { formatAgeRating } from "@/lib/age-rating";
import {
  EMPTY_WIKI_RELATED_DATA,
  getWikiPageBySlug,
  listPublishedWikiPages,
  loadWikiRelatedData,
  type WikiBadgeItem,
  type WikiGamePassItem,
  type WikiListEntry,
  type WikiMediaItem,
  type WikiPageContent,
  type WikiRelatedData,
  type WikiServerItem
} from "@/lib/wiki";
import { CHECKLISTS_DESCRIPTION, QUIZZES_DESCRIPTION, SITE_NAME, SITE_URL, WIKI_DESCRIPTION, breadcrumbJsonLd } from "@/lib/seo";
import { WikiLinkList, WikiSection, type WikiLinkItem } from "@/components/wiki/WikiPrimitives";
import { ArticleCard } from "@/components/ArticleCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChecklistCard } from "@/components/ChecklistCard";
import { QuizCard } from "@/components/QuizCard";
import { ToolCard } from "@/components/ToolCard";
import { WikiCard } from "@/components/WikiCard";
import { IndexPageStats } from "@/components/IndexPageStats";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { cleanRewardsText, isCodeNew } from "@/lib/code-utils";
import { listGameDatasetCatalogImageUrls } from "@/lib/game-dataset-catalog-images";
import { buildWikiCatalogPath } from "@/lib/wiki-catalog";

const ROBLOX_BASE_URL = "https://www.roblox.com";
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;
const compactNumberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const PT_TIME_ZONE = "America/Los_Angeles";
const ptDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: PT_TIME_ZONE
});

export type WikiIndexPageData = {
  pages: WikiListEntry[];
  total: number;
};

export type WikiDetailPageData = {
  page: WikiPageContent;
  related: WikiRelatedData;
};

type ControlDeviceKey = "desktop" | "mobile" | "tablet" | "console" | "vr";

type ControlDeviceColumn = {
  key: ControlDeviceKey;
  label: string;
  enabled?: boolean | null;
};

type ControlTableRow = {
  action: string;
  values: Partial<Record<ControlDeviceKey, string>>;
};

type SocialLink = {
  platform: string;
  label: string;
  url: string;
  title?: string | null;
};

type HeroStat = {
  icon: IconType;
  label: string;
  value: string;
};

type DeviceBadgeItem = {
  icon: IconType;
  label: string;
  enabled?: boolean | null;
};

type WikiGameDetailItem = {
  icon: IconType;
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
};

type ChecklistCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  itemsCount: number | null;
};

type QuizCardData = {
  code: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  updatedAt: string | null;
};

function normalizeText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function normalizeMarkdownText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return normalized || null;
}

function normalizeImageSrc(value?: string | null): string | null {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return normalizeImageSrc(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picked = pickThumbnail(entry);
      if (picked) return picked;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "imageUrl", "image_url", "thumbnailUrl", "thumbnail_url"]) {
      const candidate = record[key];
      if (typeof candidate === "string") return normalizeImageSrc(candidate);
    }
  }
  return null;
}

function formatNumber(value?: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCompactNumber(value?: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 1000) return value.toLocaleString("en-US");
  return compactNumberFormatter.format(value);
}

function formatRobux(value?: number | null): string | null {
  const formatted = formatNumber(value);
  return formatted ? `${formatted} Robux` : null;
}

function formatPercent(value?: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value.toFixed(value < 1 ? 2 : 1)}%`;
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatIsoDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatUpdated(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
}

function toValidTime(value?: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  const now = Date.now();
  const latest = values.reduce<number | null>((current, value) => {
    const time = toValidTime(value);
    if (time === null) return current;
    if (time > now + 86_400_000) return current;
    return current === null || time > current ? time : current;
  }, null);
  return latest === null ? null : new Date(latest).toISOString();
}

function formatRelativeUpdated(value?: string | null): string | null {
  const time = toValidTime(value);
  if (time === null) return null;
  try {
    return formatDistanceToNow(new Date(time), { addSuffix: true });
  } catch {
    return null;
  }
}

function formatShortDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatPtDateTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return ptDateTimeFormatter.format(date);
}

function yesNo(value?: boolean | null): string | null {
  if (typeof value !== "boolean") return null;
  return value ? "Yes" : "No";
}

function formatKeyLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarizeWords(value: string | null, wordLimit = 100): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) return normalized;
  return `${words.slice(0, wordLimit).join(" ")}…`;
}

function summarizeCardText(value: string | null | undefined, fallback: string): string {
  const plain = value ? markdownToPlainText(value) : "";
  const normalized = normalizeText(plain) ?? fallback;
  if (normalized.length <= 160) return normalized;
  const slice = normalized.slice(0, 157);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 120 ? slice.slice(0, lastSpace) : slice}…`;
}

function getUniverseLabel(page: WikiPageContent): string {
  return normalizeText(page.universe_display_name) ?? normalizeText(page.universe_name) ?? page.title;
}

function getSummary(page: WikiPageContent): string | null {
  return summarizeWords(page.universe_game_description_md ? markdownToPlainText(page.universe_game_description_md) : null, 100);
}

function getHeroImage(page: WikiPageContent, related: WikiRelatedData): string | null {
  const mediaImage = related.media.find((item) => item.is_primary && item.image_url)?.image_url ?? related.media.find((item) => item.image_url)?.image_url;
  return normalizeImageSrc(mediaImage) ?? pickThumbnail(page.thumbnail_urls) ?? normalizeImageSrc(page.icon_url);
}

function compactMeta(items: Array<string | null | undefined>): string | null {
  const values = items.map(normalizeText).filter((item): item is string => Boolean(item));
  return values.length ? values.join(" · ") : null;
}

function buildDeviceBadges(page: WikiPageContent): DeviceBadgeItem[] {
  const items: DeviceBadgeItem[] = [
    { icon: FiMonitor, label: "Desktop", enabled: page.desktop_enabled },
    { icon: FiSmartphone, label: "Mobile", enabled: page.mobile_enabled },
    { icon: FiTablet, label: "Tablet", enabled: page.tablet_enabled },
    { icon: FiTv, label: "Console", enabled: page.console_enabled },
    { icon: TbAugmentedReality, label: "VR", enabled: page.vr_enabled }
  ];
  return items.some((item) => typeof item.enabled === "boolean") ? items : [];
}

function resolveWikiHubUpdatedAt(page: WikiPageContent, related: WikiRelatedData): string | null {
  return latestTimestamp([
    page.content_updated_at,
    page.updated_at,
    page.published_at,
    page.created_at,
    page.universe_updated_at,
    page.updated_at_api,
    ...related.codes.flatMap((game) => [
      game.content_updated_at,
      game.latest_code_first_seen_at,
      game.updated_at,
      game.created_at
    ]),
    ...related.activeCodes.flatMap((code) => [
      code.last_seen_at,
      code.first_seen_at
    ]),
    ...related.tools.flatMap((tool) => [
      tool.content_updated_at,
      tool.updated_at,
      tool.published_at,
      tool.created_at
    ]),
    ...related.articles.flatMap((article) => [
      article.updated_at,
      article.published_at,
      article.created_at
    ]),
    ...related.checklists.flatMap((checklist) => [
      checklist.content_updated_at,
      checklist.updated_at,
      checklist.published_at,
      checklist.created_at
    ]),
    ...related.catalogPages.flatMap((catalogPage) => [
      catalogPage.content_updated_at,
      catalogPage.updated_at,
      catalogPage.published_at,
      catalogPage.created_at
    ]),
    ...related.quizzes.flatMap((quiz) => [
      quiz.content_updated_at,
      quiz.updated_at,
      quiz.published_at,
      quiz.created_at
    ]),
    related.eventsPage?.updated_at,
    related.eventsPage?.published_at,
    related.eventsPage?.created_at,
    ...related.eventTimeline.flatMap((event) => [
      event.updatedUtc,
      event.createdUtc
    ]),
    ...related.media.map((item) => item.fetched_at),
    ...related.servers.map((server) => server.fetched_at)
  ]);
}

function WikiDeviceBadge({ label, icon: Icon, enabled }: DeviceBadgeItem) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        enabled ? "border-accent/60 text-accent" : "border-border/60 text-muted"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}

function WikiGameDetailsBlock({ details }: { details: WikiGameDetailItem[] }) {
  if (!details.length) return null;

  return (
    <dl className="grid max-w-3xl gap-1">
      {details.map((detail) => {
        const label = (
          <dt className="flex min-w-0 items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted">
            <detail.icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0">{detail.label}</span>
          </dt>
        );

        if (detail.fullWidth) {
          return (
            <div key={detail.label} className="rounded-lg py-2.5">
              {label}
              <dd className="mt-2 min-w-0 break-words text-sm font-medium leading-6 text-foreground">{detail.value}</dd>
            </div>
          );
        }

        return (
          <div key={detail.label} className="grid grid-cols-[9.25rem_minmax(0,1fr)] items-start gap-3 rounded-lg py-2.5">
            {label}
            <dd className="min-w-0 break-words pt-0.5 text-sm font-medium leading-6 text-foreground">{detail.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function WikiActiveCodesPreview({
  codes,
  game,
  universeLabel,
  nowMs
}: {
  codes: WikiRelatedData["activeCodes"];
  game: WikiRelatedData["codes"][number] | null;
  universeLabel: string;
  nowMs: number;
}) {
  if (!codes.length || !game) return null;

  const gameName = universeLabel;
  const codesHref = game.slug ? `/codes/${game.slug}` : null;
  const activeCount = game.active_count ?? codes.length;
  const lastChecked = codes.reduce<string | null>((latest, code) => {
    if (!code.last_seen_at) return latest;
    if (!latest || code.last_seen_at > latest) return code.last_seen_at;
    return latest;
  }, null);
  const lastCheckedLabel = formatDate(lastChecked);

  return (
    <section className="min-w-0" id="active-codes">
      <Card className="overflow-hidden rounded-lg border-border/70 bg-card shadow-none">
        <CardHeader className="border-b border-border/60 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl leading-tight text-foreground sm:text-2xl">
                Active {gameName} Codes
              </CardTitle>
              {lastCheckedLabel ? (
                <p className="flex items-center gap-1.5 text-sm leading-5 text-muted-foreground">
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>Checked and verified on {lastCheckedLabel}</span>
                </p>
              ) : null}
            </div>
            <Badge variant="secondary" className="shrink-0 rounded-md px-2 py-1 text-xs">
              {activeCount} active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
            {codes.map((code, index) => {
              const rewardText = cleanRewardsText(code.rewards_text);
              const displayReward = rewardText
                ? (/this code gives you/i.test(rewardText) ? rewardText : `You get ${rewardText}`)
                : "No reward listed yet.";
              const addedAtLabel = formatShortDate(code.first_seen_at);
              return (
                <article key={code.id} className="bg-card">
                  <div className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted/30 text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <code className="font-mono text-base font-semibold tracking-[0.08em] text-foreground sm:text-lg">
                            {code.code}
                          </code>
                          {isCodeNew(code, nowMs) ? (
                            <Badge className="rounded-md px-1.5 py-0 text-[10px] uppercase tracking-[0.12em]">New</Badge>
                          ) : null}
                          {code.level_requirement != null ? (
                            <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px]">
                              Level {code.level_requirement}+
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm leading-5 text-muted-foreground">{displayReward}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 pl-10 sm:items-end sm:pl-0 sm:[&>*]:whitespace-nowrap">
                      <CopyCodeButton
                        code={code.code}
                        tone="accent"
                        analytics={{
                          event: "copy_code",
                          params: {
                            game_slug: game.slug,
                            code: code.code,
                            is_new: isCodeNew(code, nowMs),
                            status: "active",
                            source: "wiki"
                          }
                        }}
                      />
                      {addedAtLabel ? (
                        <span className="text-[11px] font-medium text-muted-foreground">Added {addedAtLabel}</span>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {codesHref ? (
            <p className="text-sm text-muted-foreground">
              {activeCount > codes.length ? (
                <>
                  Showing the latest {codes.length} of {activeCount} active codes.{" "}
                </>
              ) : null}
              <Link href={codesHref} className="font-semibold text-accent underline-offset-4 transition hover:underline">
                View all {gameName} codes
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function getTimelineStatusMeta(event: WikiRelatedData["eventTimeline"][number]) {
  if (event.status === "upcoming") {
    const startTime = event.startUtc ? new Date(event.startUtc) : null;
    const label = startTime && !Number.isNaN(startTime.getTime())
      ? `Starts ${formatDistanceToNow(startTime, { addSuffix: true })}`
      : "Upcoming";
    return {
      label,
      dotClass: "bg-emerald-500",
      pillClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    };
  }

  if (event.status === "current") {
    return {
      label: "Live now",
      dotClass: "bg-sky-500",
      pillClass: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
    };
  }

  return {
    label: "Completed",
    dotClass: "bg-rose-500",
    pillClass: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
  };
}

function WikiEventsTimeline({
  events,
  eventsPageSlug,
  universeLabel
}: {
  events: WikiRelatedData["eventTimeline"];
  eventsPageSlug?: string | null;
  universeLabel: string;
}) {
  if (!events.length) return null;

  return (
    <section className="min-w-0 space-y-5 border-t border-border/60 pt-8" id="events">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-3xl font-semibold leading-tight text-foreground md:text-4xl">{universeLabel} Events</h2>
          <p className="text-sm text-muted">Recent updates, live events, and completed event history for {universeLabel}.</p>
        </div>
        {eventsPageSlug ? (
          <Link href={`/events/${eventsPageSlug}`} className="text-sm font-semibold text-accent underline-offset-4 transition hover:underline">
            Open events page
          </Link>
        ) : null}
      </div>

      <ol className="relative ml-2 space-y-6 border-l border-border/70 pl-6">
        {events.map((event) => {
          const status = getTimelineStatusMeta(event);
          const startLabel = formatPtDateTime(event.startUtc) ?? "TBA";
          const endLabel = formatPtDateTime(event.endUtc) ?? "TBA";
          return (
            <li key={event.eventId} className="relative pl-1">
              <span className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-background ${status.dotClass}`} />
              <div className="min-w-0 space-y-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="m-0 flex min-h-7 min-w-0 items-center text-lg font-semibold leading-none text-foreground">{event.name}</h3>
                  <span className={`inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-semibold leading-none ${status.pillClass}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-sm leading-6 text-muted">
                  <span className="font-semibold text-foreground/80">Starts (PT):</span> {startLabel}
                  <span className="mx-2 text-muted/60">.</span>
                  <span className="font-semibold text-foreground/80">Ends (PT):</span> {endLabel}
                </p>
                {event.description ? <p className="max-w-3xl text-sm leading-6 text-muted">{event.description}</p> : null}
                {event.guideSlug ? (
                  <Link
                    href={`/articles/${event.guideSlug}`}
                    className="inline-flex text-sm font-semibold text-accent underline-offset-4 hover:underline"
                    data-analytics-event="event_guide_click"
                    data-analytics-event-id={event.eventId}
                    data-analytics-guide-slug={event.guideSlug}
                  >
                    Event guide
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function stringifyControlValue(value: unknown): string | null {
  if (typeof value === "string") return normalizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(stringifyControlValue).filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(", ") : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = record.controls ?? record.keys ?? record.value ?? record.description ?? record.action;
    const preferredText = stringifyControlValue(preferred);
    if (preferredText) return preferredText;
    const parts = Object.entries(record)
      .filter(([key]) => !["device", "platform", "label", "title", "name"].includes(key))
      .map(([key, entry]) => {
        const text = stringifyControlValue(entry);
        return text ? `${formatKeyLabel(key)}: ${text}` : null;
      })
      .filter((part): part is string => Boolean(part));
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

const CONTROL_DEVICE_COLUMNS: ControlDeviceColumn[] = [
  { key: "desktop", label: "Desktop" },
  { key: "mobile", label: "Mobile" },
  { key: "tablet", label: "Tablet" },
  { key: "console", label: "Console" },
  { key: "vr", label: "VR" }
];

const CONTROL_DEVICE_ALIASES: Record<ControlDeviceKey, string[]> = {
  desktop: ["desktop", "pc", "computer", "keyboard", "keyboard_mouse", "keyboardMouse"],
  mobile: ["mobile", "phone"],
  tablet: ["tablet"],
  console: ["console", "controller", "xbox", "playstation"],
  vr: ["vr", "virtual_reality", "virtualReality"]
};

function getControlDeviceColumns(page: WikiPageContent): ControlDeviceColumn[] {
  const enabledByDevice: Record<ControlDeviceKey, boolean | null | undefined> = {
    desktop: page.desktop_enabled,
    mobile: page.mobile_enabled,
    tablet: page.tablet_enabled,
    console: page.console_enabled,
    vr: page.vr_enabled
  };
  const columns = CONTROL_DEVICE_COLUMNS.map((column) => ({
    ...column,
    enabled: enabledByDevice[column.key]
  }));
  const enabledColumns = columns.filter((column) => column.enabled === true);
  return enabledColumns.length ? enabledColumns : columns.slice(0, 1);
}

function getControlActionLabel(record: Record<string, unknown>, fallback: string): string {
  return (
    stringifyControlValue(record.action) ??
    stringifyControlValue(record.move) ??
    stringifyControlValue(record.label) ??
    stringifyControlValue(record.title) ??
    stringifyControlValue(record.name) ??
    fallback
  );
}

function getDeviceControlValue(record: Record<string, unknown>, key: ControlDeviceKey): string | null {
  for (const alias of CONTROL_DEVICE_ALIASES[key]) {
    const value = stringifyControlValue(record[alias]);
    if (value) return value;
  }
  return null;
}

function getGenericControlValue(record: Record<string, unknown>): string | null {
  return (
    stringifyControlValue(record.value) ??
    stringifyControlValue(record.controls) ??
    stringifyControlValue(record.keys) ??
    stringifyControlValue(record.description)
  );
}

function parseControlEntry(
  entry: unknown,
  index: number,
  columns: ControlDeviceColumn[],
  labelOverride?: string
): ControlTableRow | null {
  const fallbackLabel = labelOverride ?? `Controls ${index + 1}`;
  const fallbackColumn = columns.find((column) => column.key === "desktop") ?? columns[0];
  if (!fallbackColumn) return null;

  if (typeof entry === "string") {
    const value = stringifyControlValue(entry);
    return value ? { action: fallbackLabel, values: { [fallbackColumn.key]: value } } : null;
  }

  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const action = getControlActionLabel(record, fallbackLabel);
  const values: Partial<Record<ControlDeviceKey, string>> = {};

  for (const column of columns) {
    const value = getDeviceControlValue(record, column.key);
    if (value) values[column.key] = value;
  }

  if (!Object.keys(values).length) {
    const generic = getGenericControlValue(record);
    if (generic) values[fallbackColumn.key] = generic;
  }

  return Object.keys(values).length ? { action, values } : null;
}

function parseControls(raw: unknown, columns: ControlDeviceColumn[]): ControlTableRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((entry, index) => parseControlEntry(entry, index, columns))
      .filter((entry): entry is ControlTableRow => Boolean(entry));
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, value], index) => parseControlEntry(value, index, columns, formatKeyLabel(key)))
      .filter((entry): entry is ControlTableRow => Boolean(entry));
  }
  const value = stringifyControlValue(raw);
  const fallbackColumn = columns.find((column) => column.key === "desktop") ?? columns[0];
  return value && fallbackColumn ? [{ action: "Controls", values: { [fallbackColumn.key]: value } }] : [];
}

function WikiControlsTable({
  columns,
  heading,
  rows
}: {
  columns: ControlDeviceColumn[];
  heading: string;
  rows: ControlTableRow[];
}) {
  if (!columns.length || !rows.length) return null;

  return (
    <section className="min-w-0 space-y-4">
      <h2 className="text-3xl font-semibold leading-tight text-foreground md:text-4xl">{heading}</h2>
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-muted/20 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th scope="col" className="min-w-36 border-b border-border/70 px-4 py-3 font-semibold">
                Action
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="min-w-40 border-b border-border/70 px-4 py-3 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.action} className="align-top">
                <th scope="row" className="px-4 py-3 font-semibold text-foreground">
                  {row.action}
                </th>
                {columns.map((column) => {
                  const value = row.values[column.key];
                  return (
                    <td key={column.key} className="px-4 py-3 leading-6 text-muted">
                      {value ? value : <span className="text-muted/60">Not listed</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function extractSocialLinks(raw: unknown): SocialLink[] {
  if (!raw || typeof raw !== "object") return [];
  const links: SocialLink[] = [];
  for (const [platform, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalizedPlatform = platform.trim().toLowerCase();
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries) {
      if (typeof entry === "string") {
        const url = normalizeText(entry);
        if (url) links.push({ platform: normalizedPlatform, label: formatKeyLabel(platform), url });
        continue;
      }
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const url = typeof record.url === "string" ? normalizeText(record.url) : null;
      if (!url) continue;
      const title = typeof record.title === "string" ? normalizeText(record.title) : null;
      links.push({ platform: normalizedPlatform, label: title ?? formatKeyLabel(platform), title, url });
    }
  }
  return links;
}

const UNIVERSE_SOCIAL_META: Record<string, { label: string; icon: IconType }> = {
  twitter: { label: "Twitter / X", icon: RiTwitterXLine },
  x: { label: "Twitter / X", icon: RiTwitterXLine },
  youtube: { label: "YouTube", icon: FaYoutube },
  discord: { label: "Discord", icon: FaDiscord },
  twitch: { label: "Twitch", icon: FaTwitch },
  facebook: { label: "Facebook", icon: FaFacebook },
  roblox_group: { label: "Roblox Group", icon: SiRoblox },
  roblox: { label: "Roblox Group", icon: SiRoblox },
  guilded: { label: "Guilded", icon: SiGuilded }
};

const DEFAULT_SOCIAL_META: { label: string; icon: IconType } = {
  label: "Website",
  icon: SiGooglechrome
};

type SocialLinkButton = { key: string; url: string; label: string; Icon: IconType; platform: string };

function normalizeUrl(value?: string | null): string | null {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function normalizeLinkForDedup(value: string): string | null {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return null;
  }
}

function extractHandleFromUrl(platform: string, url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    let handle = segments.length ? segments[segments.length - 1] : parsed.hostname;
    if (!handle) return null;
    if (handle.includes("?")) {
      handle = handle.split("?")[0];
    }
    handle = handle.replace(/\/+$/, "");
    if (!handle) return null;
    if (platform === "twitter" || platform === "x") {
      handle = handle.replace(/^@/, "");
      return handle ? `@${handle}` : null;
    }
    if (platform.includes("youtube")) {
      return handle.startsWith("@") ? handle : null;
    }
    return handle;
  } catch {
    return null;
  }
}

function formatSocialLabel(platform: string, link: SocialLink, creatorName?: string | null): string {
  if (platform === "roblox_group" || platform === "roblox") {
    return creatorName ? `${creatorName} Roblox Community` : "Roblox Community";
  }
  if (platform === "discord") {
    return "Discord";
  }
  const handle = extractHandleFromUrl(platform, link.url);
  if (handle) return handle;
  if (platform.includes("youtube")) {
    return "YouTube";
  }
  return link.title?.trim() || UNIVERSE_SOCIAL_META[platform]?.label || DEFAULT_SOCIAL_META.label;
}

function buildSocialLinkButtons(links: SocialLink[], creatorName?: string | null): SocialLinkButton[] {
  const deduped = new Map<string, SocialLinkButton>();
  for (const link of links) {
    const url = normalizeUrl(link.url);
    if (!url) continue;
    const meta = UNIVERSE_SOCIAL_META[link.platform] ?? DEFAULT_SOCIAL_META;
    const dedupeKey = normalizeLinkForDedup(url);
    if (!dedupeKey || deduped.has(dedupeKey)) continue;
    deduped.set(dedupeKey, {
      key: `${link.platform}-${url}`,
      url,
      label: formatSocialLabel(link.platform, link, creatorName),
      Icon: meta.icon,
      platform: link.platform
    });
  }
  return Array.from(deduped.values());
}

function buildCreatorUrl(page: WikiPageContent): string | null {
  if (!page.universe_creator_id || !page.universe_creator_type) return null;
  const creatorType = page.universe_creator_type.toLowerCase();
  if (creatorType === "user") return `${ROBLOX_BASE_URL}/users/${page.universe_creator_id}/profile`;
  if (creatorType === "group") return `${ROBLOX_BASE_URL}/communities/${page.universe_creator_id}`;
  return null;
}

function buildChecklistCards(page: WikiPageContent, related: WikiRelatedData): ChecklistCardData[] {
  return related.checklists.map((row) => {
    const itemsCount =
      typeof row.leaf_item_count === "number"
        ? row.leaf_item_count
        : typeof row.item_count === "number"
          ? row.item_count
          : null;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: summarizeCardText(row.seo_description ?? row.description_md, CHECKLISTS_DESCRIPTION),
      universeName: row.universe?.display_name ?? row.universe?.name ?? getUniverseLabel(page),
      coverImage: row.universe?.icon_url ?? normalizeImageSrc(page.icon_url) ?? `${SITE_URL}/og-image.png`,
      updatedAt: row.content_updated_at ?? row.updated_at ?? row.published_at ?? row.created_at ?? null,
      itemsCount
    };
  });
}

function buildQuizCards(page: WikiPageContent, related: WikiRelatedData): QuizCardData[] {
  return related.quizzes.map((quiz) => ({
    code: quiz.code,
    title: quiz.title,
    summary: summarizeCardText(quiz.seo_description ?? quiz.description_md, QUIZZES_DESCRIPTION),
    universeName: quiz.universe?.display_name ?? quiz.universe?.name ?? getUniverseLabel(page),
    coverImage: quiz.universe?.icon_url ?? pickThumbnail(quiz.universe?.thumbnail_urls) ?? normalizeImageSrc(page.icon_url) ?? `${SITE_URL}/og-image.png`,
    updatedAt: quiz.content_updated_at ?? quiz.updated_at ?? quiz.published_at ?? quiz.created_at ?? null
  }));
}

async function buildWikiCatalogBlocks(related: WikiRelatedData) {
  const pagesWithCopy = related.catalogPages
    .map((page) => ({ page, copy: normalizeText(page.wiki_md) }))
    .filter((entry) => Boolean(entry.copy)) as Array<{
      page: WikiRelatedData["catalogPages"][number];
      copy: string;
    }>;

  return Promise.all(
    pagesWithCopy.map(async ({ page, copy }) => {
      const [html, imageUrls] = await Promise.all([
        renderMarkdown(copy, { paragraphizeLineBreaks: true }),
        listGameDatasetCatalogImageUrls(page.code, 6)
      ]);
      const nodes = renderHtmlAsReactNodes(processHtmlLinks(html).__html, { keyPrefix: `wiki-catalog-${page.code}` });

      return {
        page,
        nodes,
        imageUrls
      };
    })
  );
}

function normalizeWikiImageUrls(value?: string[] | null): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeImageSrc(entry))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 6);
}

function WikiCatalogCta({
  href,
  title,
  imageUrls
}: {
  href: string;
  title: string;
  imageUrls?: string[] | null;
}) {
  const images = normalizeWikiImageUrls(imageUrls);
  const label = normalizeText(title) ?? "Open catalog";

  return (
    <Link
      href={href}
      className="group relative isolate flex min-h-[128px] w-full overflow-hidden rounded-lg border border-border/60 bg-surface/80 px-6 py-5 text-foreground shadow-sm transition hover:border-accent/60 dark:text-white md:min-h-[136px]"
    >
      {images.length ? (
        <div aria-hidden className="absolute inset-0 flex opacity-60">
          {images.map((image, index) => (
            <div key={`${image}-${index}`} className="relative min-w-0 flex-1 border-r border-white/20 last:border-r-0">
              <Image
                src={image}
                alt=""
                fill
                sizes="(max-width: 768px) 20vw, 120px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
      <span
        className="absolute inset-0 bg-gradient-to-r from-white/98 via-white/96 to-white/93 transition group-hover:from-white/97 group-hover:via-white/95 group-hover:to-white/92 dark:from-black/96 dark:via-black/93 dark:to-black/89 dark:group-hover:from-black/95 dark:group-hover:via-black/92 dark:group-hover:to-black/88"
        aria-hidden
      />
      <span className="relative z-10 flex w-full items-center">
        <span className="max-w-3xl text-base font-semibold leading-6 md:text-lg">{label}</span>
      </span>
    </Link>
  );
}

function buildRankLinks(related: WikiRelatedData): WikiLinkItem[] {
  return related.rankingBadges.map((rank) => ({
    href: `/lists/${rank.list_slug}`,
    title: rank.list_title,
    description: `This game is currently ranked #${rank.rank} on this Bloxodes list.`,
    meta: `#${rank.rank}`
  }));
}

function rankBadgeIconForRank(rank: number): IconType {
  if (rank === 1) return FaCrown;
  if (rank === 2) return FaTrophy;
  return FaMedal;
}

function mediaToDisplayItems(page: WikiPageContent, related: WikiRelatedData): WikiMediaItem[] {
  const existing = related.media.filter((item) => item.image_url || item.video_url);
  if (existing.length) return existing;
  const thumbnail = pickThumbnail(page.thumbnail_urls);
  if (!thumbnail) return [];
  return [
    {
      id: "thumbnail",
      media_type: "screenshot",
      image_url: thumbnail,
      video_url: null,
      alt_text: `${getUniverseLabel(page)} thumbnail`,
      is_primary: true,
      fetched_at: null
    }
  ];
}

function renderMediaGrid(page: WikiPageContent, related: WikiRelatedData) {
  const items = mediaToDisplayItems(page, related);
  if (!items.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const image = normalizeImageSrc(item.image_url);
        const video = normalizeText(item.video_url);
        return (
          <div key={item.id} className="overflow-hidden rounded-xl border border-border/60 bg-surface/40">
            {image ? (
              <div className="relative aspect-video bg-surface-muted">
                <Image
                  src={image}
                  alt={item.alt_text ?? `${getUniverseLabel(page)} media`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">{formatKeyLabel(item.media_type)}</p>
              {video ? (
                <a href={video} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline-offset-4 hover:underline">
                  Open video
                </a>
              ) : item.fetched_at ? (
                <p className="text-muted">Updated {formatUpdated(item.fetched_at)}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderImageName({ image, name, description }: { image?: string | null; name: string; description?: string | null }) {
  return (
    <span className="flex min-w-[12rem] items-center gap-3">
      {normalizeImageSrc(image) ? (
        <span className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-border/60 bg-surface-muted">
          <Image src={normalizeImageSrc(image)!} alt="" fill sizes="40px" className="object-cover" />
        </span>
      ) : null}
      <span>
        <span className="block font-semibold text-foreground">{name}</span>
        {description ? <span className="line-clamp-1 text-xs text-muted">{description}</span> : null}
      </span>
    </span>
  );
}

function badgeRows(badges: WikiBadgeItem[]): ReactNode[][] {
  return badges.map((badge) => [
    renderImageName({ image: badge.icon_image_url, name: badge.name, description: badge.enabled === false ? "Disabled" : badge.description }),
    formatNumber(badge.awarded_count) ?? "Not tracked",
    formatPercent(badge.rarity_percent) ?? "Not tracked"
  ]);
}

function gamePassRows(gamePasses: WikiGamePassItem[]): ReactNode[][] {
  return gamePasses.map((pass) => [
    renderImageName({ image: pass.icon_image_url, name: pass.name, description: pass.description }),
    pass.price === 0 ? "Free" : formatRobux(pass.price) ?? "Not listed",
    yesNo(pass.is_for_sale) ?? "Unknown",
    formatNumber(pass.sales) ?? "Not tracked"
  ]);
}

function serverRows(servers: WikiServerItem[]): ReactNode[][] {
  return servers.map((server) => [
    <span key="server" className="font-mono text-xs">{server.server_id.slice(0, 12)}{server.server_id.length > 12 ? "..." : ""}</span>,
    server.region ?? "Unknown",
    compactMeta([formatNumber(server.player_count), formatNumber(server.max_players)])
      ? `${formatNumber(server.player_count) ?? "0"} / ${formatNumber(server.max_players) ?? "?"}`
      : "Not tracked",
    server.ping_ms != null ? `${server.ping_ms} ms` : "Not tracked",
    server.fps != null ? `${server.fps.toFixed(1)} FPS` : "Not tracked",
    formatUpdated(server.fetched_at) ?? "Recently"
  ]);
}

function developerGameLinks(related: WikiRelatedData): WikiLinkItem[] {
  return related.developerGames.map((game) => ({
    href: game.root_place_id ? `${ROBLOX_BASE_URL}/games/${game.root_place_id}` : `${ROBLOX_BASE_URL}/games`,
    title: game.display_name ?? game.name ?? `Universe ${game.universe_id}`,
    description: compactMeta([formatNumber(game.playing) ? `${formatNumber(game.playing)} playing` : null, formatNumber(game.visits) ? `${formatNumber(game.visits)} visits` : null]),
    meta: "Roblox"
  }));
}

async function renderTipsNodes(tipsMd?: string | null): Promise<ReactNode[] | null> {
  const tips = normalizeMarkdownText(tipsMd);
  if (!tips) return null;
  const html = await renderMarkdown(tips, { paragraphizeLineBreaks: true });
  return renderHtmlAsReactNodes(processHtmlLinks(html).__html, { keyPrefix: "wiki-tips" });
}

export async function loadWikiIndexPageData(): Promise<WikiIndexPageData> {
  const pages = await listPublishedWikiPages();
  return { pages, total: pages.length };
}

export async function loadWikiDetailPageData(slug: string): Promise<WikiDetailPageData | null> {
  const page = await getWikiPageBySlug(slug);
  if (!page) return null;
  const related = await loadWikiRelatedData(page);
  return { page, related };
}

export function renderWikiIndexPage({ pages, total }: WikiIndexPageData) {
  const latest = pages.reduce<Date | null>((latestDate, page) => {
    const candidate = page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at;
    if (!candidate) return latestDate;
    const candidateDate = new Date(candidate);
    if (Number.isNaN(candidateDate.getTime())) return latestDate;
    if (!latestDate || candidateDate > latestDate) return candidateDate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox Wiki Hub</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Roblox wiki hubs built from live universe data
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">{WIKI_DESCRIPTION}</p>
        <IndexPageStats
          items={[
            { label: `${total} wiki page${total === 1 ? "" : "s"} tracked`, icon: "wiki", tone: "accent" },
            ...(refreshedLabel ? [{ label: `Updated ${refreshedLabel}`, icon: "clock" as const }] : [])
          ]}
        />
      </header>
      {pages.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pages.map((page) => (
            <WikiCard key={page.id} page={page} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 p-8 text-center text-sm text-muted">
          No wiki pages have been published yet.
        </div>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Wiki",
            description: WIKI_DESCRIPTION,
            url: `${SITE_URL}/wiki`
          })
        }}
      />
    </div>
  );
}

export async function renderWikiDetailPage({ page, related }: WikiDetailPageData) {
  const universeLabel = getUniverseLabel(page);
  const summary = getSummary(page);
  const heroImage = getHeroImage(page, related);
  const controlColumns = getControlDeviceColumns(page);
  const controlRows = parseControls(page.controls_json, controlColumns);
  const hasControlsSection = controlColumns.length > 0 && controlRows.length > 0;
  const tipsNodes = await renderTipsNodes(page.tips_md);
  const tipsSectionClassName = hasControlsSection
    ? "article-content md-copy-scope game-copy min-w-0"
    : "article-content md-copy-scope game-copy min-w-0 border-t border-border/60 pt-8";
  const socialSectionClassName = hasControlsSection && !tipsNodes?.length
    ? "min-w-0 space-y-4"
    : "min-w-0 space-y-4 border-t border-border/60 pt-8";
  const catalogBlocks = await buildWikiCatalogBlocks(related);
  const developerLinks = developerGameLinks(related);
  const creatorUrl = buildCreatorUrl(page);
  const creatorLabel = normalizeText(page.universe_creator_name) ?? "Developer";
  const socialLinks = buildSocialLinkButtons(extractSocialLinks(page.social_links), creatorLabel);
  const heroRankingBadges = related.rankingBadges
    .filter((badge) => badge.rank >= 1 && badge.rank <= 3)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);
  const published = page.published_at ?? page.created_at ?? null;
  const hubUpdatedAt = resolveWikiHubUpdatedAt(page, related) ?? page.content_updated_at ?? page.updated_at ?? published;
  const hubUpdatedRelativeLabel = formatRelativeUpdated(hubUpdatedAt);
  const publishedIso = formatIsoDate(published);
  const updatedIso = formatIsoDate(hubUpdatedAt);
  const canonicalUrl = `${SITE_URL}/wiki/${page.slug}`;
  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Wiki", url: `${SITE_URL}/wiki` },
    { name: page.title, url: canonicalUrl }
  ];
  const robloxGameUrl = page.universe_root_place_id ? `${ROBLOX_BASE_URL}/games/${page.universe_root_place_id}` : null;
  const heroAgeRating = formatAgeRating(page.universe_age_rating);
  const agePillLabel = heroAgeRating ? (/^\d+\+$/.test(heroAgeRating) ? `Ages ${heroAgeRating}` : heroAgeRating) : null;
  const deviceBadges = buildDeviceBadges(page);
  const rawGenre = normalizeText(page.universe_genre_l1) ?? normalizeText(page.universe_genre);
  const rawSubgenre = normalizeText(page.universe_genre_l2);
  const splitGenre = !rawSubgenre && rawGenre?.includes("·")
    ? rawGenre.split("·").map((item) => normalizeText(item)).filter((item): item is string => Boolean(item))
    : [];
  const genre = splitGenre[0] ?? rawGenre;
  const subgenre = rawSubgenre ?? splitGenre[1] ?? null;
  const createdLabel = formatDate(page.created_at_api);
  const updatedLabel = formatDate(page.updated_at_api);
  const heroStats = [
    { icon: FiUsers, label: "Playing Now", value: formatCompactNumber(page.playing) },
    { icon: FiEye, label: "Total Visits", value: formatCompactNumber(page.visits) },
    { icon: FiStar, label: "Favorites", value: formatCompactNumber(page.favorites) }
  ].filter((stat): stat is HeroStat => Boolean(stat.value));
  const checklistCards = buildChecklistCards(page, related);
  const quizCards = buildQuizCards(page, related);
  const primaryCodePage = related.codes[0] ?? null;
  const nowMs = Date.now();
  const gameDetailItems: WikiGameDetailItem[] = [];
  if (page.universe_creator_name) {
    gameDetailItems.push({
      icon: FiUser,
      label: "Creator",
      value: creatorUrl ? (
        <a href={creatorUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 transition hover:text-accent hover:underline">
          {page.universe_creator_name}
        </a>
      ) : (
        page.universe_creator_name
      )
    });
  }
  if (createdLabel) gameDetailItems.push({ icon: FiCalendar, label: "Game Created", value: createdLabel });
  if (updatedLabel) gameDetailItems.push({ icon: FiRefreshCw, label: "Last Updated On", value: updatedLabel });
  if (agePillLabel) gameDetailItems.push({ icon: FiShield, label: "Age Requirement", value: agePillLabel });
  if (genre) gameDetailItems.push({ icon: FiTag, label: "Genre", value: genre });
  if (subgenre) gameDetailItems.push({ icon: FiTag, label: "Subgenre", value: subgenre });
  if (deviceBadges.length) {
    gameDetailItems.push({
      icon: FiMonitor,
      label: "Supported Devices",
      fullWidth: true,
      value: (
        <div className="flex flex-wrap gap-2">
          {deviceBadges.map((device) => (
            <WikiDeviceBadge key={device.label} {...device} />
          ))}
        </div>
      )
    });
  }

  return (
    <div className="space-y-9">
      <header className="space-y-6">
        <nav aria-label="Breadcrumb" className="text-xs uppercase tracking-[0.22em] text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="font-semibold transition hover:text-accent">Home</Link></li>
            <li className="text-muted/60">&gt;</li>
            <li><Link href="/wiki" className="font-semibold transition hover:text-accent">Wiki</Link></li>
            <li className="text-muted/60">&gt;</li>
            <li className="font-semibold text-foreground/80">{page.title}</li>
          </ol>
        </nav>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            {heroImage ? (
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-surface-muted shadow-soft sm:h-28 sm:w-28">
                <Image src={heroImage} alt={`${universeLabel} artwork`} fill sizes="112px" className="object-cover" priority />
              </div>
            ) : (
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-surface text-2xl font-semibold text-foreground shadow-soft sm:h-28 sm:w-28">
                {page.title.charAt(0).toUpperCase() || "W"}
              </div>
            )}

            <div className="min-w-0 max-w-3xl space-y-3">
              <h1 className="mb-0 text-4xl font-semibold leading-tight text-foreground md:text-5xl">{page.title}</h1>
              {hubUpdatedRelativeLabel ? (
                <p className="inline-flex items-center gap-1.5 text-sm leading-5 text-muted">
                  <FiClock className="h-4 w-4 shrink-0" aria-hidden />
                  <span>Updated {hubUpdatedRelativeLabel}</span>
                </p>
              ) : null}
              {robloxGameUrl ? (
                <div className="pt-2 lg:hidden">
                  <a
                    href={robloxGameUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90"
                  >
                    Play on Roblox
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {robloxGameUrl ? (
            <div className="hidden flex-wrap gap-3 lg:flex lg:shrink-0 lg:justify-end">
              <a
                href={robloxGameUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90"
              >
                Play on Roblox
              </a>
            </div>
          ) : null}
        </div>
      </header>

      <div aria-hidden className="border-t border-border/60" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2.2fr)_minmax(20rem,1fr)]">
        <article className="min-w-0 space-y-9">
          {heroRankingBadges.length || summary || gameDetailItems.length || heroStats.length ? (
            <section className="space-y-4">
              {heroRankingBadges.length ? (
                <div className="flex flex-wrap gap-2">
                  {heroRankingBadges.map((badge) => {
                    const Icon = rankBadgeIconForRank(badge.rank);
                    const label = `#${badge.rank} on ${badge.list_title}`;
                    return (
                      <Link
                        key={`${badge.list_id}-${badge.rank}`}
                        href={`/lists/${badge.list_slug}`}
                        prefetch={false}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent"
                      >
                        <Icon className="h-3.5 w-3.5 text-accent" aria-hidden />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}

              {summary ? (
                <p className="max-w-3xl text-base leading-7 text-foreground md:text-lg">
                  {summary}
                </p>
              ) : null}

              {gameDetailItems.length ? (
                <section aria-label="Game details" className="lg:hidden">
                  <WikiGameDetailsBlock details={gameDetailItems} />
                </section>
              ) : null}

              {heroStats.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {heroStats.map((stat) => (
                    <div key={stat.label} className="flex items-center gap-3 rounded-[16px] border border-border/60 bg-background/40 px-3 py-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-border/40 text-muted">
                        <stat.icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">{stat.label}</p>
                        <p className="truncate text-lg font-semibold text-foreground">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <WikiActiveCodesPreview
            codes={related.activeCodes}
            game={primaryCodePage}
            universeLabel={universeLabel}
            nowMs={nowMs}
          />

          {catalogBlocks.length ? (
            <section className="min-w-0">
              <div className="space-y-10">
                {catalogBlocks.map(({ page: catalogPage, nodes, imageUrls }) => (
                  <section
                    key={catalogPage.code}
                    className="space-y-4"
                    data-analytics-event="select_item"
                    data-analytics-item-list-name="wiki_catalog"
                    data-analytics-item-id={catalogPage.code}
                    data-analytics-item-name={catalogPage.title}
                    data-analytics-content-type="catalog"
                  >
                    {nodes ? (
                      <div className="article-content md-copy-scope text-sm leading-7 text-foreground">
                        {nodes}
                      </div>
                    ) : null}
                    <WikiCatalogCta
                      href={buildWikiCatalogPath(catalogPage.wiki_slug, catalogPage.collection_slug)}
                      title={catalogPage.title}
                      imageUrls={imageUrls}
                    />
                  </section>
                ))}
              </div>
            </section>
          ) : null}

          <WikiControlsTable columns={controlColumns} heading={`${universeLabel} Controls`} rows={controlRows} />

          {tipsNodes?.length ? (
            <section className={tipsSectionClassName}>
              <h2>{universeLabel} Gameplay Tips</h2>
              {tipsNodes}
            </section>
          ) : null}

          {socialLinks.length ? (
            <section className={socialSectionClassName}>
              <h2 className="text-3xl font-semibold leading-tight text-foreground md:text-4xl">{creatorLabel} Social Accounts</h2>
              <p className="text-base leading-7 text-muted md:text-lg">Here are the official social media platforms of {universeLabel} developers.</p>
              <div className="flex flex-wrap gap-3">
                {socialLinks.map(({ key, url, label, Icon, platform }) => {
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-analytics-event="social_follow_click"
                      data-analytics-platform={platform}
                      data-analytics-content-type="wiki"
                      data-analytics-item-id={page.slug}
                      className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      <span>{label}</span>
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}

          {developerLinks.length ? (
            <WikiSection title="More From This Developer" description="Other Roblox experiences found under the same creator.">
              <WikiLinkList items={developerLinks} />
            </WikiSection>
          ) : null}

          <WikiEventsTimeline
            events={related.eventTimeline}
            eventsPageSlug={related.eventsPage?.slug ?? null}
            universeLabel={universeLabel}
          />

        </article>

        <aside className="space-y-4">
          {gameDetailItems.length ? (
            <section aria-label="Game details" className="hidden lg:block">
              <WikiGameDetailsBlock details={gameDetailItems} />
            </section>
          ) : null}

          {related.tools.length ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Tools for {universeLabel}</h3>
              <div className="space-y-4">
                {related.tools.slice(0, 3).map((tool) => (
                  <div
                    key={tool.id ?? tool.code}
                    className="block"
                    data-analytics-event="related_content_click"
                    data-analytics-source-type="wiki_sidebar"
                    data-analytics-target-type="tool"
                    data-analytics-target-slug={tool.code}
                  >
                    <ToolCard tool={tool} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {checklistCards.length ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Checklists for {universeLabel}</h3>
              <div className="space-y-3">
                {checklistCards.map((card) => (
                  <div
                    key={card.id}
                    className="block"
                    data-analytics-event="related_content_click"
                    data-analytics-source-type="wiki_sidebar"
                    data-analytics-target-type="checklist"
                    data-analytics-target-slug={card.slug}
                  >
                    <ChecklistCard {...card} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {quizCards.length ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Quizzes for {universeLabel}</h3>
              <div className="space-y-3">
                {quizCards.map((card) => (
                  <div
                    key={card.code}
                    className="block"
                    data-analytics-event="related_content_click"
                    data-analytics-source-type="wiki_sidebar"
                    data-analytics-target-type="quiz"
                    data-analytics-target-slug={card.code}
                  >
                    <QuizCard {...card} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {related.articles.length ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Articles on {universeLabel}</h3>
              <div className="space-y-4">
                {related.articles.slice(0, 5).map((article) => (
                  <div
                    key={article.id}
                    className="block"
                    data-analytics-event="related_content_click"
                    data-analytics-source-type="wiki_sidebar"
                    data-analytics-target-type="article"
                    data-analytics-target-slug={article.slug}
                  >
                    <ArticleCard article={article} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd(breadcrumbs),
            {
              "@context": "https://schema.org",
              "@type": "WebPage",
              name: page.title,
              headline: page.title,
              description: summary,
              url: canonicalUrl,
              ...(publishedIso ? { datePublished: publishedIso } : {}),
              ...(updatedIso ? { dateModified: updatedIso } : {}),
              ...(heroImage ? { image: heroImage } : {}),
              inLanguage: "en-US",
              isAccessibleForFree: true,
              isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
              publisher: {
                "@type": "Organization",
                name: SITE_NAME,
                url: SITE_URL,
                logo: {
                  "@type": "ImageObject",
                  url: `${SITE_URL}/Bloxodes-dark.png`
                }
              },
              about: {
                "@type": "VideoGame",
                name: universeLabel,
                url: page.universe_root_place_id ? `${ROBLOX_BASE_URL}/games/${page.universe_root_place_id}` : undefined
              }
            }
          ])
        }}
      />
    </div>
  );
}
