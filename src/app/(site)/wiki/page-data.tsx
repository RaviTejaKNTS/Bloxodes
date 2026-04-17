import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { FiCalendar, FiEye, FiMonitor, FiRefreshCw, FiShield, FiSmartphone, FiStar, FiTablet, FiTag, FiTv, FiUsers } from "react-icons/fi";
import { TbAugmentedReality } from "react-icons/tb";
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
import { CHECKLISTS_DESCRIPTION, EVENTS_DESCRIPTION, QUIZZES_DESCRIPTION, SITE_NAME, SITE_URL, WIKI_DESCRIPTION, breadcrumbJsonLd } from "@/lib/seo";
import { WikiLinkList, WikiRows, WikiSection, WikiTable, type WikiLinkItem, type WikiRow } from "@/components/wiki/WikiPrimitives";
import { ArticleCard } from "@/components/ArticleCard";
import { ChecklistCard } from "@/components/ChecklistCard";
import { EventsPageCard, type EventsPageCardProps } from "@/components/EventsPageCard";
import { GameCard } from "@/components/GameCard";
import { QuizCard } from "@/components/QuizCard";
import { ToolCard } from "@/components/ToolCard";

const ROBLOX_BASE_URL = "https://www.roblox.com";
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;
const compactNumberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export type WikiIndexPageData = {
  pages: WikiListEntry[];
  total: number;
};

export type WikiDetailPageData = {
  page: WikiPageContent;
  related: WikiRelatedData;
};

type ControlRow = {
  label: string;
  value: string;
};

type SocialLink = {
  label: string;
  url: string;
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

function summarizeWords(value: string | null, wordLimit = 100): string {
  const normalized = normalizeText(value) ?? WIKI_DESCRIPTION;
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

function getSummary(page: WikiPageContent): string {
  const candidates = [
    page.meta_description,
    page.universe_game_description_md ? markdownToPlainText(page.universe_game_description_md) : null,
    page.universe_description
  ];
  return summarizeWords(candidates.map(normalizeText).find(Boolean) ?? null, 100);
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

function parseControls(raw: unknown): ControlRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((entry, index) => {
        if (typeof entry === "string") return { label: `Controls ${index + 1}`, value: entry };
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const label =
          stringifyControlValue(record.device) ??
          stringifyControlValue(record.platform) ??
          stringifyControlValue(record.label) ??
          stringifyControlValue(record.title) ??
          stringifyControlValue(record.name) ??
          `Controls ${index + 1}`;
        const value = stringifyControlValue(record);
        return value ? { label, value } : null;
      })
      .filter((entry): entry is ControlRow => Boolean(entry));
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) => {
        const text = stringifyControlValue(value);
        return text ? { label: formatKeyLabel(key), value: text } : null;
      })
      .filter((entry): entry is ControlRow => Boolean(entry));
  }
  const value = stringifyControlValue(raw);
  return value ? [{ label: "Controls", value }] : [];
}

function extractSocialLinks(raw: unknown): SocialLink[] {
  if (!raw || typeof raw !== "object") return [];
  const links: SocialLink[] = [];
  for (const [platform, value] of Object.entries(raw as Record<string, unknown>)) {
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries) {
      if (typeof entry === "string") {
        const url = normalizeText(entry);
        if (url) links.push({ label: formatKeyLabel(platform), url });
        continue;
      }
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const url = typeof record.url === "string" ? normalizeText(record.url) : null;
      if (!url) continue;
      const title = typeof record.title === "string" ? normalizeText(record.title) : null;
      links.push({ label: title ?? formatKeyLabel(platform), url });
    }
  }
  return links;
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
      const html = await renderMarkdown(copy, { paragraphizeLineBreaks: true });
      const nodes = renderHtmlAsReactNodes(processHtmlLinks(html).__html, { keyPrefix: `wiki-catalog-${page.code}` });

      return {
        page,
        nodes
      };
    })
  );
}

function getCatalogCollectionLabel(title: string): string {
  const match = title.match(/^All\s+(.+?)\s+in\s+.+$/i);
  return normalizeText(match?.[1]) ?? title;
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
  count,
  gameName,
  imageUrls
}: {
  href: string;
  title: string;
  count?: number | null;
  gameName: string;
  imageUrls?: string[] | null;
}) {
  const collectionLabel = getCatalogCollectionLabel(title);
  const formattedCount = typeof count === "number" && Number.isFinite(count) ? count.toLocaleString("en-US") : null;
  const images = normalizeWikiImageUrls(imageUrls);
  const label = formattedCount
    ? `Check all ${formattedCount} ${collectionLabel} in ${gameName}`
    : `Check all ${collectionLabel} in ${gameName}`;

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

function buildDeveloperRows(page: WikiPageContent): WikiRow[] {
  const creatorUrl = buildCreatorUrl(page);
  const socialLinks = extractSocialLinks(page.social_links);
  const rows: Array<WikiRow | null> = [
    normalizeText(page.universe_creator_name)
      ? {
          label: "Creator",
          value: creatorUrl ? (
            <a href={creatorUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
              {page.universe_creator_name}
            </a>
          ) : (
            page.universe_creator_name
          )
        }
      : null,
    normalizeText(page.universe_creator_type) ? { label: "Creator type", value: formatKeyLabel(page.universe_creator_type ?? "") } : null,
    yesNo(page.universe_creator_has_verified_badge) ? { label: "Verified creator", value: yesNo(page.universe_creator_has_verified_badge) } : null,
    normalizeText(page.universe_group_name) ? { label: "Group", value: page.universe_group_name } : null,
    socialLinks.length
      ? {
          label: "Official links",
          value: (
            <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
              {socialLinks.map((link) => (
                <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
                  {link.label}
                </a>
              ))}
            </span>
          )
        }
      : null
  ];
  return rows.filter((row): row is WikiRow => Boolean(row));
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
  const tips = normalizeText(tipsMd);
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
  const links: WikiLinkItem[] = pages.map((page) => ({
    href: `/wiki/${page.slug}`,
    title: page.title,
    description: page.meta_description ?? null,
    meta: formatUpdated(page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at) ?? null
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="space-y-4 border-b border-border/60 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Roblox Wiki</p>
        <h1 className="mb-0 text-4xl font-semibold leading-tight text-foreground md:text-5xl">Roblox game wiki pages</h1>
        <p className="max-w-2xl text-base leading-7 text-muted">{WIKI_DESCRIPTION}</p>
        {total ? <p className="text-sm font-medium text-foreground">{total} wiki page{total === 1 ? "" : "s"} published</p> : null}
      </header>
      {links.length ? (
        <WikiLinkList items={links} />
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
  const controlRows = parseControls(page.controls_json).map((row) => ({ label: row.label, value: row.value }));
  const tipsNodes = await renderTipsNodes(page.tips_md);
  const catalogBlocks = await buildWikiCatalogBlocks(related);
  const rankLinks = buildRankLinks(related);
  const developerRows = buildDeveloperRows(page);
  const developerLinks = developerGameLinks(related);
  const updated = page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at ?? null;
  const eventCounts = related.eventSummary?.counts;
  const eventRows: WikiRow[] = eventCounts
    ? ([
        { label: "Current events", value: formatNumber(eventCounts.current) ?? "0" },
        { label: "Upcoming events", value: formatNumber(eventCounts.upcoming) ?? "0" },
        { label: "Past events", value: formatNumber(eventCounts.past) ?? "0" },
        related.eventSummary?.featured
          ? {
              label: "Featured event",
              value: compactMeta([related.eventSummary.featured.name, related.eventSummary.featured.timeLabel]) ?? related.eventSummary.featured.name
            }
          : null
      ] as Array<WikiRow | null>).filter((row): row is WikiRow => Boolean(row))
    : [];
  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Wiki", url: `${SITE_URL}/wiki` },
    { name: page.title, url: `${SITE_URL}/wiki/${page.slug}` }
  ];
  const robloxGameUrl = page.universe_root_place_id ? `${ROBLOX_BASE_URL}/games/${page.universe_root_place_id}` : null;
  const heroAgeRating = formatAgeRating(page.universe_age_rating);
  const deviceBadges = buildDeviceBadges(page);
  const genre = normalizeText(page.universe_genre_l1) ?? normalizeText(page.universe_genre);
  const subgenre = normalizeText(page.universe_genre_l2);
  const genreLabel = compactMeta([genre, subgenre]);
  const heroStats = [
    { icon: FiUsers, label: "Playing Now", value: formatCompactNumber(page.playing) },
    { icon: FiEye, label: "Total Visits", value: formatCompactNumber(page.visits) },
    { icon: FiStar, label: "Favorites", value: formatCompactNumber(page.favorites) }
  ].filter((stat): stat is HeroStat => Boolean(stat.value));
  const dateStats = [
    { icon: FiCalendar, label: "Created", value: formatDate(page.created_at_api) },
    { icon: FiRefreshCw, label: "Updated", value: formatDate(page.updated_at_api) ?? formatUpdated(updated) }
  ].filter((stat): stat is HeroStat => Boolean(stat.value));
  const metaStats = [
    { icon: FiTag, label: "Genre", value: genreLabel },
    { icon: FiShield, label: "Age", value: heroAgeRating }
  ].filter((stat): stat is HeroStat => Boolean(stat.value));
  const checklistCards = buildChecklistCards(page, related);
  const quizCards = buildQuizCards(page, related);
  const eventsCard: EventsPageCardProps | null =
    related.eventsPage && related.eventsPage.slug
      ? {
          slug: related.eventsPage.slug,
          title: related.eventsPage.title,
          summary: related.eventsPage.meta_description?.trim() || EVENTS_DESCRIPTION,
          universeName: related.eventsPage.universe?.display_name ?? related.eventsPage.universe?.name ?? universeLabel,
          coverImage: null,
          fallbackIcon: related.eventsPage.universe?.icon_url ?? normalizeImageSrc(page.icon_url),
          eventName: related.eventSummary?.featured?.name ?? null,
          eventTimeLabel: related.eventSummary?.featured?.timeLabel ?? null,
          status: (related.eventSummary?.featured?.status ?? "none") as EventsPageCardProps["status"],
          counts: related.eventSummary?.counts ?? { upcoming: 0, current: 0, past: 0 },
          updatedLabel: formatUpdated(related.eventsPage.updated_at || related.eventsPage.published_at || related.eventsPage.created_at)
        }
      : null;

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
              {formatUpdated(updated) ? <p className="text-sm font-medium text-muted">Updated {formatUpdated(updated)}</p> : null}
              <p className="max-w-3xl text-base leading-7 text-muted md:text-lg">{summary}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                {page.universe_creator_name ? <span>By {page.universe_creator_name}</span> : null}
                {heroAgeRating ? <span>Age {heroAgeRating}</span> : null}
              </div>
            </div>
          </div>

          {robloxGameUrl ? (
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <a
                href={robloxGameUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90"
              >
                Play on Roblox
              </a>
            </div>
          ) : null}
        </div>
      </header>

      <div aria-hidden className="border-t border-border/60" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
        <article className="min-w-0 space-y-9">
          {heroStats.length || dateStats.length || metaStats.length || deviceBadges.length ? (
            <div className="space-y-3">
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

              {dateStats.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {dateStats.map((stat) => (
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

              {metaStats.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {metaStats.map((stat) => (
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

              {deviceBadges.length ? (
                <div className="flex flex-wrap items-center justify-start gap-2">
                  {deviceBadges.map((device) => (
                    <WikiDeviceBadge key={device.label} {...device} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {catalogBlocks.length ? (
            <section className="min-w-0 border-t border-border/60 pt-8">
              <div className="space-y-10">
                {catalogBlocks.map(({ page: catalogPage, nodes }) => (
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
                      href={`/catalog/${catalogPage.code}`}
                      title={catalogPage.title}
                      count={catalogPage.wiki_item_count}
                      gameName={universeLabel}
                      imageUrls={catalogPage.wiki_image_urls}
                    />
                  </section>
                ))}
              </div>
            </section>
          ) : null}

          {controlRows.length ? (
            <WikiSection title="Controls" description="Device controls and input notes configured for this wiki page.">
              <WikiRows rows={controlRows} />
            </WikiSection>
          ) : null}

          {tipsNodes?.length ? (
            <WikiSection title="Features And Tips" description="Short gameplay notes for new and returning players.">
              <div className="article-content md-copy-scope rounded-xl border border-border/60 bg-surface/40 p-5 text-sm leading-7 text-foreground">
                {tipsNodes}
              </div>
            </WikiSection>
          ) : null}

          {eventRows.length ? (
            <WikiSection title="Events" description="Current and historical event coverage from the Roblox event data we track.">
              <WikiRows rows={eventRows} />
            </WikiSection>
          ) : null}

          {related.badges.length ? (
            <WikiSection title="Badges" description="Badges tracked for this Roblox universe.">
              <WikiTable columns={["Badge", "Awarded", "Rarity"]} rows={badgeRows(related.badges)} />
            </WikiSection>
          ) : null}

          {related.gamePasses.length ? (
            <WikiSection title="Game Passes" description="Game passes and purchase details from the Roblox universe data.">
              <WikiTable columns={["Game Pass", "Price", "For Sale", "Sales"]} rows={gamePassRows(related.gamePasses)} />
            </WikiSection>
          ) : null}

          {related.servers.length ? (
            <WikiSection title="Servers" description="Recently fetched public server details. This section appears only when server data exists.">
              <WikiTable columns={["Server", "Region", "Players", "Ping", "FPS", "Fetched"]} rows={serverRows(related.servers)} />
            </WikiSection>
          ) : null}

          {mediaToDisplayItems(page, related).length ? (
            <WikiSection title="Media" description="Thumbnails, screenshots, and videos available from the Roblox universe data.">
              {renderMediaGrid(page, related)}
            </WikiSection>
          ) : null}

          {developerRows.length ? (
            <WikiSection title="Developer" description="Creator and official link data connected to the Roblox universe.">
              <WikiRows rows={developerRows} />
            </WikiSection>
          ) : null}

          {developerLinks.length ? (
            <WikiSection title="More From This Developer" description="Other Roblox experiences found under the same creator.">
              <WikiLinkList items={developerLinks} />
            </WikiSection>
          ) : null}

          {rankLinks.length ? (
            <WikiSection title="Rankings" description="Bloxodes lists where this game currently appears near the top.">
              <WikiLinkList items={rankLinks} />
            </WikiSection>
          ) : null}

        </article>

        <aside className="space-y-4">
          {related.codes.length ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Codes for {universeLabel}</h3>
              <div className="grid gap-3">
                {related.codes.map((game) => (
                  <div
                    key={game.id}
                    className="block"
                    data-analytics-event="related_content_click"
                    data-analytics-source-type="wiki_sidebar"
                    data-analytics-target-type="codes"
                    data-analytics-target-slug={game.slug}
                  >
                    <GameCard game={game} titleAs="p" articleUpdatedAt={game.content_updated_at} />
                  </div>
                ))}
              </div>
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

          {eventsCard ? (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Events for {universeLabel}</h3>
              <div
                className="block"
                data-analytics-event="related_content_click"
                data-analytics-source-type="wiki_sidebar"
                data-analytics-target-type="event"
                data-analytics-target-slug={eventsCard.slug}
              >
                <EventsPageCard {...eventsCard} />
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
              description: summary,
              url: `${SITE_URL}/wiki/${page.slug}`,
              isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
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
