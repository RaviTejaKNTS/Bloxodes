import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { markdownToPlainText, renderMarkdown } from "@/lib/markdown";
import { processHtmlLinks } from "@/lib/link-utils";
import { renderHtmlAsReactNodes } from "@/lib/html-to-react";
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
import { SITE_NAME, SITE_URL, WIKI_DESCRIPTION, breadcrumbJsonLd } from "@/lib/seo";
import { WikiInlineList, WikiLinkList, WikiRows, WikiSection, WikiTable, type WikiLinkItem, type WikiRow } from "@/components/wiki/WikiPrimitives";

const ROBLOX_BASE_URL = "https://www.roblox.com";
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;

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

function getDeviceList(page: WikiPageContent): string[] {
  return [
    page.desktop_enabled ? "PC" : null,
    page.mobile_enabled ? "Mobile" : null,
    page.tablet_enabled ? "Tablet" : null,
    page.console_enabled ? "Xbox / Console" : null,
    page.vr_enabled ? "VR" : null
  ].filter((item): item is string => Boolean(item));
}

function getLikeRatio(page: WikiPageContent): string | null {
  const likes = page.likes ?? null;
  const dislikes = page.dislikes ?? null;
  if (typeof likes !== "number" || typeof dislikes !== "number") return null;
  const total = likes + dislikes;
  if (total <= 0) return null;
  return `${Math.round((likes / total) * 100)}%`;
}

function compactMeta(items: Array<string | null | undefined>): string | null {
  const values = items.map(normalizeText).filter((item): item is string => Boolean(item));
  return values.length ? values.join(" · ") : null;
}

function buildMetricRows(page: WikiPageContent): WikiRow[] {
  return [
    ["Playing now", formatNumber(page.playing)],
    ["Total visits", formatNumber(page.visits)],
    ["Favorites", formatNumber(page.favorites)],
    ["Likes", formatNumber(page.likes)],
    ["Dislikes", formatNumber(page.dislikes)],
    ["Like ratio", getLikeRatio(page)]
  ]
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(([label, value]) => ({ label, value }));
}

function buildDetailRows(page: WikiPageContent): WikiRow[] {
  const devices = getDeviceList(page);
  const genre = [page.universe_genre_l1, page.universe_genre_l2, page.universe_genre].map(normalizeText).filter((item): item is string => Boolean(item));
  const rows: Array<WikiRow | null> = [
    page.universe_id ? { label: "Universe ID", value: formatNumber(page.universe_id) } : null,
    page.universe_root_place_id ? { label: "Root place ID", value: formatNumber(page.universe_root_place_id) } : null,
    genre.length ? { label: "Genre", value: <WikiInlineList items={Array.from(new Set(genre))} /> } : null,
    devices.length ? { label: "Supported devices", value: <WikiInlineList items={devices} /> } : null,
    yesNo(page.voice_chat_enabled) ? { label: "Voice enabled", value: yesNo(page.voice_chat_enabled) } : null,
    normalizeText(page.universe_age_rating) ? { label: "Age rating", value: page.universe_age_rating } : null,
    normalizeText(page.universe_avatar_type) ? { label: "Avatar type", value: page.universe_avatar_type } : null,
    formatNumber(page.max_players) ? { label: "Max players", value: formatNumber(page.max_players) } : null,
    formatNumber(page.server_size) ? { label: "Server size", value: formatNumber(page.server_size) } : null,
    yesNo(page.create_vip_servers_allowed) ? { label: "Private servers", value: yesNo(page.create_vip_servers_allowed) } : null,
    formatRobux(page.private_server_price_robux) ? { label: "Private server price", value: formatRobux(page.private_server_price_robux) } : null,
    formatDate(page.created_at_api) ? { label: "Created on", value: formatDate(page.created_at_api) } : null,
    formatDate(page.updated_at_api) ? { label: "Last Roblox update", value: formatDate(page.updated_at_api) } : null,
    formatUpdated(page.universe_updated_at) ? { label: "Data refreshed", value: formatUpdated(page.universe_updated_at) } : null
  ];
  return rows.filter((row): row is WikiRow => Boolean(row));
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

function buildResourceLinks(related: WikiRelatedData): WikiLinkItem[] {
  const codeLinks = related.codes.map((game) => ({
    href: `/codes/${game.slug}`,
    title: `${game.name} Codes`,
    description: game.active_count === 1 ? "1 active code tracked." : `${game.active_count} active codes tracked.`,
    meta: "Codes"
  }));
  const eventLinks = related.eventsPage
    ? [
        {
          href: `/events/${related.eventsPage.slug}`,
          title: related.eventsPage.title,
          description: related.eventsPage.meta_description ?? "Current and past Roblox event coverage.",
          meta: "Events"
        }
      ]
    : [];
  const toolLinks = related.tools.map((tool) => ({
    href: `/tools/${tool.code}`,
    title: tool.title,
    description: tool.meta_description,
    meta: "Tool"
  }));
  const checklistLinks = related.checklists.map((checklist) => ({
    href: `/checklists/${checklist.slug}`,
    title: checklist.title,
    description: checklist.seo_description ?? checklist.description_md ?? null,
    meta: checklist.leaf_item_count ? `${checklist.leaf_item_count} tasks` : "Checklist"
  }));
  const quizLinks = related.quizzes.map((quiz) => ({
    href: `/quizzes/${quiz.code}`,
    title: quiz.title,
    description: quiz.seo_description ?? quiz.description_md ?? null,
    meta: "Quiz"
  }));
  return [...codeLinks, ...eventLinks, ...toolLinks, ...checklistLinks, ...quizLinks];
}

function buildCatalogLinks(related: WikiRelatedData): WikiLinkItem[] {
  return related.catalogPages.map((page) => ({
    href: `/catalog/${page.code}`,
    title: page.title,
    description: page.meta_description,
    meta: "Catalog"
  }));
}

function buildArticleLinks(related: WikiRelatedData): WikiLinkItem[] {
  return related.articles.map((article) => ({
    href: `/articles/${article.slug}`,
    title: article.title,
    description: article.meta_description,
    meta: formatDate(article.published_at ?? article.updated_at)
  }));
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
  const metricRows = buildMetricRows(page);
  const detailRows = buildDetailRows(page);
  const controlRows = parseControls(page.controls_json).map((row) => ({ label: row.label, value: row.value }));
  const tipsNodes = await renderTipsNodes(page.tips_md);
  const resourceLinks = buildResourceLinks(related);
  const catalogLinks = buildCatalogLinks(related);
  const articleLinks = buildArticleLinks(related);
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

  return (
    <div className="mx-auto max-w-6xl space-y-9">
      <nav aria-label="Breadcrumb" className="text-xs uppercase tracking-[0.22em] text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href="/" className="font-semibold transition hover:text-accent">Home</Link></li>
          <li className="text-muted/60">&gt;</li>
          <li><Link href="/wiki" className="font-semibold transition hover:text-accent">Wiki</Link></li>
          <li className="text-muted/60">&gt;</li>
          <li className="font-semibold text-foreground/80">{page.title}</li>
        </ol>
      </nav>

      <header className="grid gap-6 border-b border-border/60 pb-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Roblox Wiki</p>
          <div className="space-y-3">
            <h1 className="mb-0 text-4xl font-semibold leading-tight text-foreground md:text-5xl">{page.title}</h1>
            <p className="max-w-3xl text-base leading-7 text-muted md:text-lg">{summary}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {page.universe_id ? <span>Universe {page.universe_id}</span> : null}
            {formatDate(page.created_at_api) ? <span>Created {formatDate(page.created_at_api)}</span> : null}
            {formatUpdated(updated) ? <span>Updated {formatUpdated(updated)}</span> : null}
          </div>
        </div>
        {heroImage ? (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-surface/40">
            <div className="relative aspect-video bg-surface-muted">
              <Image src={heroImage} alt={`${universeLabel} artwork`} fill sizes="(max-width: 1024px) 100vw, 22rem" className="object-cover" priority />
            </div>
            <div className="px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">{universeLabel}</p>
              {page.universe_creator_name ? <p className="text-muted">By {page.universe_creator_name}</p> : null}
            </div>
          </div>
        ) : null}
      </header>

      {metricRows.length ? (
        <WikiSection title="Live Metrics" description="Snapshot-style Roblox metrics from the connected universe record.">
          <WikiRows rows={metricRows} />
        </WikiSection>
      ) : null}

      {detailRows.length ? (
        <WikiSection title="Game Details" description="Core Roblox metadata that helps players understand the experience quickly.">
          <WikiRows rows={detailRows} />
        </WikiSection>
      ) : null}

      {resourceLinks.length ? (
        <WikiSection title="Useful Pages" description="Related Bloxodes pages connected to this game.">
          <WikiLinkList items={resourceLinks} />
        </WikiSection>
      ) : null}

      {catalogLinks.length ? (
        <WikiSection title="Collections" description="Structured item, place, and game-specific collection pages.">
          <WikiLinkList items={catalogLinks} />
        </WikiSection>
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

      {articleLinks.length ? (
        <WikiSection title="Articles" description="Guides and articles connected to this game.">
          <WikiLinkList items={articleLinks} />
        </WikiSection>
      ) : null}

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
