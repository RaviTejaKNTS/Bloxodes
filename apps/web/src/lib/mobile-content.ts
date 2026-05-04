import { listPublishedChecklistsPage, type ChecklistSummaryRow } from "@/lib/db";
import { buildEventsCards } from "@/app/(site)/events/page-data";
import { listPublishedQuizzes, type QuizListEntry } from "@/lib/quizzes";
import { SITE_URL } from "@/lib/seo";
import { listPublishedToolsPage, type ToolListEntry } from "@/lib/tools";
import { resolveModifiedAt } from "@/lib/content-dates";

const PAGE_SIZE = 20;

export type MobileContentKind = "checklists" | "events" | "quizzes" | "tools";

export type MobileContentItem = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  url: string;
  badge: string | null;
};

export type MobileContentIndexPayload = {
  ok: true;
  kind: MobileContentKind;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  latestUpdatedAt: string | null;
  items: MobileContentItem[];
};

function normalizePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function absoluteAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}

function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) return entry;
      if (entry && typeof entry === "object" && "url" in entry) {
        const url = (entry as { url?: unknown }).url;
        if (typeof url === "string" && url.trim()) return url;
      }
    }
  }
  return null;
}

function summarize(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const plain = value.replace(/[#>*_`~[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return fallback;
  if (plain.length <= 160) return plain;
  const slice = plain.slice(0, 157);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 120 ? slice.slice(0, lastSpace) : slice}...`;
}

function latest(values: Array<string | null>): string | null {
  return values.reduce<string | null>((latestValue, value) => {
    if (!value) return latestValue;
    if (!latestValue) return value;
    return new Date(value) > new Date(latestValue) ? value : latestValue;
  }, null);
}

function mapQuiz(row: QuizListEntry): MobileContentItem {
  const universeName = row.universe?.display_name ?? row.universe?.name ?? null;
  const thumbnail = pickThumbnail(row.universe?.thumbnail_urls);
  const coverImage = absoluteAssetUrl(row.universe?.icon_url || thumbnail || "/og-image.png");
  const updatedAt = row.content_updated_at || row.updated_at || row.published_at || row.created_at || null;

  return {
    id: row.id,
    title: row.title,
    subtitle: universeName,
    summary: summarize(row.seo_description ?? row.description_md ?? null, "Quick Roblox quiz from Bloxodes."),
    coverImage,
    updatedAt,
    url: `${SITE_URL}/quizzes/${row.code}`,
    badge: "Quiz"
  };
}

function mapChecklist(row: ChecklistSummaryRow): MobileContentItem {
  const universeName = row.universe?.display_name ?? row.universe?.name ?? null;
  const thumbnail = pickThumbnail(row.universe?.thumbnail_urls);
  const coverImage = absoluteAssetUrl(row.universe?.icon_url || thumbnail || "/og-image.png");
  const updatedAt = row.content_updated_at || row.updated_at || row.published_at || row.created_at || null;
  const itemCount = typeof row.leaf_item_count === "number" ? row.leaf_item_count : typeof row.item_count === "number" ? row.item_count : null;

  return {
    id: row.id,
    title: row.title,
    subtitle: universeName,
    summary: summarize(row.seo_description ?? row.description_md ?? null, "Guided Roblox checklist from Bloxodes."),
    coverImage,
    updatedAt,
    url: `${SITE_URL}/checklists/${row.slug}`,
    badge: itemCount ? `${itemCount} tasks` : "Checklist"
  };
}

function mapTool(row: ToolListEntry): MobileContentItem {
  const updatedAt = resolveModifiedAt(row);
  const coverImage = absoluteAssetUrl(row.thumb_url || row.universe?.icon_url || "/og-image.png");

  return {
    id: row.id ?? row.code,
    title: row.title,
    subtitle: row.universe?.display_name ?? row.universe?.name ?? null,
    summary: summarize(row.meta_description ?? row.intro_md ?? null, "Roblox utility from Bloxodes."),
    coverImage,
    updatedAt,
    url: `${SITE_URL}/tools/${row.code}`,
    badge: "Tool"
  };
}

export async function getMobileContentIndex(kind: MobileContentKind, searchParams: URLSearchParams): Promise<MobileContentIndexPayload> {
  const page = normalizePositiveInt(searchParams.get("page"), 1);
  const pageSize = PAGE_SIZE;

  if (kind === "quizzes") {
    const all = await listPublishedQuizzes();
    const items = all.slice((page - 1) * pageSize, page * pageSize).map(mapQuiz);
    return {
      ok: true,
      kind,
      page,
      pageSize,
      total: all.length,
      totalPages: Math.max(1, Math.ceil(all.length / pageSize)),
      latestUpdatedAt: latest(all.map((item) => item.content_updated_at || item.updated_at || item.published_at || item.created_at || null)),
      items
    };
  }

  if (kind === "checklists") {
    const { checklists, total } = await listPublishedChecklistsPage(page, pageSize);
    return {
      ok: true,
      kind,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      latestUpdatedAt: latest(checklists.map((item) => item.content_updated_at || item.updated_at || item.published_at || item.created_at || null)),
      items: checklists.map(mapChecklist)
    };
  }

  if (kind === "tools") {
    const { tools, total } = await listPublishedToolsPage(page, pageSize);
    return {
      ok: true,
      kind,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      latestUpdatedAt: latest(tools.map((item) => resolveModifiedAt(item))),
      items: tools.map(mapTool)
    };
  }

  const { cards, total } = await buildEventsCards();
  const items = cards.slice((page - 1) * pageSize, page * pageSize).map((card) => ({
    id: card.id,
    title: card.title,
    subtitle: card.universeName,
    summary: card.summary,
    coverImage: absoluteAssetUrl(card.coverImage || card.fallbackIcon || "/og-image.png"),
    updatedAt: card.eventStartUtc || card.eventEndUtc,
    url: `${SITE_URL}/events/${card.slug}`,
    badge: card.eventTimeLabel ?? (card.status === "none" ? "Event" : card.status)
  }));

  return {
    ok: true,
    kind,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    latestUpdatedAt: latest(cards.map((card) => card.eventStartUtc || card.eventEndUtc)),
    items
  };
}

export function isMobileContentKind(value: string): value is MobileContentKind {
  return value === "checklists" || value === "events" || value === "quizzes" || value === "tools";
}
