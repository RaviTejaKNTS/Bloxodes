import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { resolveContentDates } from "@/lib/content-dates";
import { robloxJune2026Report } from "@/data/reports/roblox-june-2026";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type FeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  updatedAtMs: number;
};

type ArticleRow = {
  slug: string | null;
  title: string | null;
  updated_at: string | null;
  published_at: string | null;
  created_at: string | null;
};

type GameRow = {
  slug: string | null;
  name: string | null;
  updated_at: string | null;
  published_at: string | null;
  created_at: string | null;
};

type ChecklistRow = {
  slug: string | null;
  title: string | null;
  updated_at: string | null;
  published_at: string | null;
  created_at: string | null;
};

type EventsRow = {
  slug: string | null;
  title: string | null;
  updated_at: string | null;
  published_at: string | null;
  created_at: string | null;
};

type PuzzleRow = {
  slug: string | null;
  title: string | null;
  meta_description: string | null;
  content_updated_at: string | null;
  latest_fetched_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  created_at: string | null;
};

const FEED_LIMIT = 120;
const FEED_DESCRIPTION =
  "Latest Roblox codes, guides, checklists, stats, puzzle answers, and event updates from Bloxodes.";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toFeedItem(input: {
  title: string;
  path: string;
  description: string;
  updatedAt?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
}): FeedItem | null {
  const dates = resolveContentDates({
    published_at: input.publishedAt,
    created_at: input.createdAt,
    updated_at: input.updatedAt
  });
  if (dates.issues.length || !dates.modifiedAt) return null;
  const date = new Date(dates.modifiedAt);
  return {
    title: input.title,
    link: `${SITE_URL.replace(/\/$/, "")}${input.path}`,
    description: input.description,
    pubDate: date.toUTCString(),
    updatedAtMs: date.getTime()
  };
}

async function loadFeedItems(): Promise<FeedItem[]> {
  const sb = supabaseAdmin();
  const [articlesRes, gamesRes, checklistsRes, eventsRes, puzzlesRes] = await Promise.all([
    sb
      .from("articles")
      .select("slug, title, updated_at, published_at, created_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(60),
    sb
      .from("code_pages")
      .select("slug, name, updated_at, published_at, created_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(60),
    sb
      .from("checklist_pages")
      .select("slug, title, updated_at, published_at, created_at")
      .eq("is_public", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(40),
    sb
      .from("events_pages")
      .select("slug, title, updated_at, published_at, created_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(40),
    sb
      .from("puzzle_pages_view")
      .select("slug, title, meta_description, content_updated_at, latest_fetched_at, updated_at, published_at, created_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("content_updated_at", { ascending: false, nullsFirst: false })
      .limit(40)
  ]);

  const firstError =
    articlesRes.error ||
    gamesRes.error ||
    checklistsRes.error ||
    eventsRes.error ||
    puzzlesRes.error;
  if (firstError) {
    throw firstError;
  }

  const items: FeedItem[] = [];
  const monthlyReport = toFeedItem({
    title: robloxJune2026Report.title,
    path: `/stats/reports/${robloxJune2026Report.slug}`,
    description: robloxJune2026Report.subtitle,
    updatedAt: robloxJune2026Report.updatedAt,
    publishedAt: robloxJune2026Report.publishedAt,
    createdAt: robloxJune2026Report.publishedAt
  });
  if (monthlyReport) items.push(monthlyReport);

  for (const article of (articlesRes.data ?? []) as ArticleRow[]) {
    if (!article.slug || !article.title) continue;
    const item = toFeedItem({
        title: article.title,
        path: `/articles/${article.slug}`,
        description: "Roblox article and guide update.",
        updatedAt: article.updated_at,
        publishedAt: article.published_at,
        createdAt: article.created_at
      });
    if (item) items.push(item);
  }

  for (const game of (gamesRes.data ?? []) as GameRow[]) {
    if (!game.slug || !game.name) continue;
    const item = toFeedItem({
        title: `${game.name} Codes`,
        path: `/codes/${game.slug}`,
        description: `Active and expired code updates for ${game.name}.`,
        updatedAt: game.updated_at,
        publishedAt: game.published_at,
        createdAt: game.created_at
      });
    if (item) items.push(item);
  }

  for (const checklist of (checklistsRes.data ?? []) as ChecklistRow[]) {
    if (!checklist.slug || !checklist.title) continue;
    const item = toFeedItem({
        title: checklist.title,
        path: `/checklists/${checklist.slug}`,
        description: "Checklist update.",
        updatedAt: checklist.updated_at,
        publishedAt: checklist.published_at,
        createdAt: checklist.created_at
      });
    if (item) items.push(item);
  }

  for (const eventsPage of (eventsRes.data ?? []) as EventsRow[]) {
    if (!eventsPage.slug || !eventsPage.title) continue;
    const item = toFeedItem({
        title: eventsPage.title,
        path: `/events/${eventsPage.slug}`,
        description: "Event schedule and status update.",
        updatedAt: eventsPage.updated_at,
        publishedAt: eventsPage.published_at,
        createdAt: eventsPage.created_at
      });
    if (item) items.push(item);
  }

  for (const puzzle of (puzzlesRes.data ?? []) as PuzzleRow[]) {
    if (!puzzle.slug || !puzzle.title) continue;
    const item = toFeedItem({
        title: puzzle.title,
        path: `/puzzles/${puzzle.slug}`,
        description: puzzle.meta_description ?? "Daily puzzle answer update.",
        updatedAt: puzzle.content_updated_at ?? puzzle.latest_fetched_at ?? puzzle.updated_at,
        publishedAt: puzzle.published_at,
        createdAt: puzzle.created_at
      });
    if (item) items.push(item);
  }

  return items.sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, FEED_LIMIT);
}

function buildRssXml(items: FeedItem[]): string {
  const channelLink = SITE_URL.replace(/\/$/, "");
  const feedLink = `${channelLink}/feed.xml`;
  const lastBuildDate = items[0]?.pubDate
    ? `<lastBuildDate>${escapeXml(items[0].pubDate)}</lastBuildDate>`
    : "";

  const xmlItems = items
    .map((item) => {
      const link = escapeXml(item.link);
      return `<item><title>${escapeXml(item.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${escapeXml(item.pubDate)}</pubDate><description>${escapeXml(item.description)}</description></item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXml(SITE_NAME)}</title>
<link>${escapeXml(channelLink)}</link>
<description>${escapeXml(FEED_DESCRIPTION)}</description>
<atom:link href="${escapeXml(feedLink)}" rel="self" type="application/rss+xml" />
<language>en-us</language>
${lastBuildDate}
${xmlItems}
</channel>
</rss>`;
}

export async function GET() {
  try {
    const items = await loadFeedItems();
    return new NextResponse(buildRssXml(items), {
      headers: { "content-type": "application/rss+xml; charset=utf-8" }
    });
  } catch (error) {
    console.error("Failed to build RSS feed", error);
    return new NextResponse(buildRssXml([]), {
      headers: { "content-type": "application/rss+xml; charset=utf-8" }
    });
  }
}
