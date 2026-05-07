import {
  getArticleBySlug,
  getChecklistPageBySlug,
  getGameListBySlug,
  listPublishedArticlesPage,
  listPublishedChecklistsPage,
  listPublishedGameListsPage,
  type ArticleWithRelations,
  type ChecklistSummaryRow,
  type GameList
} from "@/lib/db";
import { buildEventsCards } from "@/app/(site)/events/page-data";
import { getCatalogPageContentByCodes, listPublishedTopLevelCatalogPages, type CatalogIndexEntry } from "@/lib/catalog";
import { getQuizPageByCode, listPublishedQuizzes, loadQuizData, type QuizListEntry } from "@/lib/quizzes";
import { SITE_URL } from "@/lib/seo";
import { getToolContentWithDevFallback, listPublishedToolsPage, type ToolListEntry } from "@/lib/tools";
import { resolveModifiedAt } from "@/lib/content-dates";
import { getWikiPageBySlug, listPublishedWikiPages, type WikiListEntry } from "@/lib/wiki";

const PAGE_SIZE = 20;

export type MobileContentKind = "articles" | "catalog" | "checklists" | "events" | "lists" | "quizzes" | "tools" | "wiki";

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

export type MobileContentDetailItem = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  badge: string | null;
  image: string | null;
};

export type MobileContentDetailSection = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  items: MobileContentDetailItem[];
};

export type MobileContentDetailPayload = {
  ok: true;
  kind: MobileContentKind;
  title: string;
  subtitle: string | null;
  summary: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  url: string;
  badge: string | null;
  sections: MobileContentDetailSection[];
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

function toPlainText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function truncate(value: string | null, max = 900): string | null {
  if (!value || value.length <= max) return value;
  const slice = value.slice(0, max - 3);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > max * 0.7 ? slice.slice(0, lastSpace) : slice}...`;
}

function section(
  id: string,
  title: string,
  options: {
    body?: string | null;
    items?: MobileContentDetailItem[];
    subtitle?: string | null;
  }
): MobileContentDetailSection | null {
  const body = truncate(options.body ?? null);
  const items = options.items?.filter(Boolean) ?? [];
  if (!body && items.length === 0) return null;
  return {
    id,
    title,
    subtitle: options.subtitle ?? null,
    body,
    items
  };
}

function detailItem(
  id: string,
  title: string,
  options: {
    badge?: string | null;
    body?: string | null;
    image?: string | null;
    subtitle?: string | null;
  } = {}
): MobileContentDetailItem {
  return {
    id,
    title,
    subtitle: options.subtitle ?? null,
    body: truncate(toPlainText(options.body) ?? options.body ?? null, 420),
    badge: options.badge ?? null,
    image: absoluteAssetUrl(options.image ?? null)
  };
}

function keyValueItems(values: Record<string, unknown>): MobileContentDetailItem[] {
  return Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 24)
    .map(([key, value]) =>
      detailItem(key, key.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()), {
        body: Array.isArray(value) ? value.join(", ") : String(value)
      })
    );
}

function compactNumber(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
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

function mapArticle(row: ArticleWithRelations): MobileContentItem {
  const updatedAt = row.updated_at || row.published_at || row.created_at || null;
  const authorName = row.author?.name ?? null;
  const universeName = row.universe?.display_name ?? row.universe?.name ?? null;

  return {
    id: row.id,
    title: row.title,
    subtitle: universeName ?? authorName,
    summary: summarize(row.meta_description ?? null, "Latest Roblox guide from Bloxodes."),
    coverImage: absoluteAssetUrl(row.cover_image || row.universe?.icon_url || "/og-image.png"),
    updatedAt,
    url: `${SITE_URL}/articles/${row.slug}`,
    badge: authorName ? `By ${authorName}` : "Article"
  };
}

function mapCatalog(row: CatalogIndexEntry): MobileContentItem {
  const updatedAt = row.content_updated_at || row.updated_at || row.published_at || row.created_at || null;

  return {
    id: row.id ?? row.code,
    title: row.title,
    subtitle: row.universe_name ?? null,
    summary: summarize(row.meta_description ?? row.intro_md ?? null, "Roblox catalog page from Bloxodes."),
    coverImage: absoluteAssetUrl(row.thumb_url || "/og-image.png"),
    updatedAt,
    url: `${SITE_URL}/catalog/${row.code}`,
    badge: "Catalog"
  };
}

function mapList(row: GameList): MobileContentItem {
  const updatedAt = row.refreshed_at || row.updated_at || row.created_at || null;

  return {
    id: row.id,
    title: row.display_name || row.title,
    subtitle: row.primary_metric_label ?? null,
    summary: summarize(row.meta_description ?? row.intro_md ?? row.hero_md ?? null, "Curated Roblox game list from Bloxodes."),
    coverImage: absoluteAssetUrl(row.top_entry_image || row.cover_image || "/og-image.png"),
    updatedAt,
    url: `${SITE_URL}/lists/${row.slug}`,
    badge: row.limit_count ? `${row.limit_count} games` : "List"
  };
}

function mapWiki(row: WikiListEntry): MobileContentItem {
  const updatedAt = row.content_updated_at || row.updated_at || row.published_at || row.created_at || null;
  const thumbnail = pickThumbnail(row.thumbnail_urls);

  return {
    id: row.id,
    title: row.title,
    subtitle: "Roblox wiki",
    summary: summarize(row.meta_description ?? null, "Roblox wiki page from Bloxodes."),
    coverImage: absoluteAssetUrl(row.cover_image || row.icon_url || thumbnail || "/og-image.png"),
    updatedAt,
    url: `${SITE_URL}/wiki/${row.slug}`,
    badge: "Wiki"
  };
}

export async function getMobileContentIndex(kind: MobileContentKind, searchParams: URLSearchParams): Promise<MobileContentIndexPayload> {
  const page = normalizePositiveInt(searchParams.get("page"), 1);
  const pageSize = PAGE_SIZE;

  if (kind === "articles") {
    const { articles, total } = await listPublishedArticlesPage(page, pageSize);
    return {
      ok: true,
      kind,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      latestUpdatedAt: latest(articles.map((item) => item.updated_at || item.published_at || item.created_at || null)),
      items: articles.map(mapArticle)
    };
  }

  if (kind === "catalog") {
    const all = await listPublishedTopLevelCatalogPages();
    const items = all.slice((page - 1) * pageSize, page * pageSize).map(mapCatalog);
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

  if (kind === "lists") {
    const { lists, total } = await listPublishedGameListsPage(page, pageSize);
    return {
      ok: true,
      kind,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      latestUpdatedAt: latest(lists.map((item) => item.refreshed_at || item.updated_at || item.created_at || null)),
      items: lists.map(mapList)
    };
  }

  if (kind === "wiki") {
    const all = await listPublishedWikiPages();
    const items = all.slice((page - 1) * pageSize, page * pageSize).map(mapWiki);
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

export async function getMobileContentDetail(kind: MobileContentKind, slug: string): Promise<MobileContentDetailPayload | null> {
  const normalizedSlug = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  if (!normalizedSlug) return null;

  if (kind === "articles") {
    const article = await getArticleBySlug(normalizedSlug);
    if (!article) return null;
    const updatedAt = article.updated_at || article.published_at || article.created_at || null;
    const universeName = article.universe?.display_name ?? article.universe?.name ?? null;
    const authorName = article.author?.name ?? null;
    const intro = toPlainText(article.meta_description) ?? truncate(toPlainText(article.content_md), 1100);
    const sections = [
      section("overview", "Overview", { body: intro }),
      section("details", "Article details", {
        items: [
          authorName ? detailItem("author", "Author", { body: authorName }) : null,
          universeName ? detailItem("game", "Game", { body: universeName }) : null,
          article.published_at ? detailItem("published", "Published", { body: article.published_at }) : null,
          article.word_count ? detailItem("word-count", "Word count", { body: `${article.word_count} words` }) : null
        ].filter(Boolean) as MobileContentDetailItem[]
      }),
      article.tags?.length ? section("tags", "Tags", { items: article.tags.slice(0, 16).map((tag) => detailItem(tag, tag, { badge: "Tag" })) }) : null
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: article.title,
      subtitle: universeName ?? authorName,
      summary: intro,
      coverImage: absoluteAssetUrl(article.cover_image || article.universe?.icon_url || "/og-image.png"),
      updatedAt,
      url: `${SITE_URL}/articles/${article.slug}`,
      badge: "Article",
      sections
    };
  }

  if (kind === "catalog") {
    const page = await getCatalogPageContentByCodes([normalizedSlug]);
    if (!page) return null;
    const updatedAt = page.content_updated_at || page.updated_at || page.published_at || page.created_at || null;
    const sections = [
      section("overview", "Overview", { body: toPlainText(page.intro_md) ?? page.meta_description }),
      section("how-it-works", "How it works", { body: toPlainText(page.how_it_works_md) }),
      section("details", "Details", { items: keyValueItems(page.description_json ?? {}) }),
      section("faq", "FAQ", {
        items: (page.faq_json ?? []).slice(0, 12).map((entry, index) => detailItem(`faq-${index}`, entry.q, { body: entry.a }))
      })
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: page.title,
      subtitle: null,
      summary: page.meta_description,
      coverImage: absoluteAssetUrl(page.thumb_url || "/og-image.png"),
      updatedAt,
      url: `${SITE_URL}/catalog/${page.code}`,
      badge: "Catalog",
      sections
    };
  }

  if (kind === "checklists") {
    const data = await getChecklistPageBySlug(normalizedSlug);
    if (!data) return null;
    const { page, items } = data;
    const updatedAt = page.content_updated_at || page.updated_at || page.published_at || page.created_at || null;
    const required = items.filter((item) => item.is_required);
    const optional = items.filter((item) => !item.is_required);
    const sections = [
      section("overview", "Overview", { body: toPlainText(page.seo_description) ?? toPlainText(page.description_md) }),
      section("required", "Required tasks", {
        subtitle: `${required.length} tasks`,
        items: required.map((item) => detailItem(item.id, item.title, { body: item.description, badge: item.section_code }))
      }),
      section("optional", "Optional tasks", {
        subtitle: `${optional.length} tasks`,
        items: optional.map((item) => detailItem(item.id, item.title, { body: item.description, badge: item.section_code }))
      })
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: page.title,
      subtitle: page.universe?.display_name ?? page.universe?.name ?? null,
      summary: toPlainText(page.seo_description) ?? toPlainText(page.description_md),
      coverImage: absoluteAssetUrl(page.universe?.icon_url || "/og-image.png"),
      updatedAt,
      url: `${SITE_URL}/checklists/${page.slug}`,
      badge: `${items.length} tasks`,
      sections
    };
  }

  if (kind === "events") {
    const { cards } = await buildEventsCards();
    const card = cards.find((entry) => entry.slug === normalizedSlug);
    if (!card) return null;
    const sections = [
      section("overview", "Overview", { body: card.summary }),
      section("status", "Event status", {
        items: [
          detailItem("event", "Featured event", { body: card.eventName ?? "Event coverage" }),
          detailItem("time", "Timing", { body: card.eventTimeLabel ?? "Timing updates appear when available." }),
          detailItem("state", "State", { body: card.status })
        ]
      })
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: card.title,
      subtitle: card.universeName,
      summary: card.summary,
      coverImage: absoluteAssetUrl(card.coverImage || card.fallbackIcon || "/og-image.png"),
      updatedAt: card.eventStartUtc || card.eventEndUtc,
      url: `${SITE_URL}/events/${card.slug}`,
      badge: card.eventTimeLabel ?? "Event",
      sections
    };
  }

  if (kind === "lists") {
    const data = await getGameListBySlug(normalizedSlug, 1, 30);
    if (!data) return null;
    const { list, entries, total } = data;
    const updatedAt = list.refreshed_at || list.updated_at || list.created_at || null;
    const sections = [
      section("overview", "Overview", { body: toPlainText(list.meta_description) ?? toPlainText(list.intro_md) ?? toPlainText(list.hero_md) }),
      section("games", "Ranked games", {
        subtitle: `${total} games`,
        items: entries.map((entry) => {
          const name = entry.universe.display_name ?? entry.universe.name ?? entry.game?.name ?? `#${entry.rank}`;
          const metric = entry.metric_label || compactNumber(entry.metric_value) || null;
          return detailItem(`${entry.universe_id}`, `#${entry.rank} ${name}`, {
            badge: metric,
            body: entry.reason ?? entry.universe.description,
            image: entry.universe.icon_url
          });
        })
      })
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: list.display_name || list.title,
      subtitle: list.primary_metric_label ?? null,
      summary: toPlainText(list.meta_description) ?? toPlainText(list.intro_md),
      coverImage: absoluteAssetUrl(list.top_entry_image || list.cover_image || "/og-image.png"),
      updatedAt,
      url: `${SITE_URL}/lists/${list.slug}`,
      badge: `${total} games`,
      sections
    };
  }

  if (kind === "quizzes") {
    const [page, quizData] = await Promise.all([getQuizPageByCode(normalizedSlug), loadQuizData(normalizedSlug)]);
    if (!page) return null;
    const updatedAt = page.content_updated_at || page.updated_at || page.published_at || page.created_at || null;
    const questions = [...(quizData?.easy ?? []), ...(quizData?.medium ?? []), ...(quizData?.hard ?? [])].slice(0, 15);
    const sections = [
      section("overview", "Overview", { body: toPlainText(page.seo_description) ?? toPlainText(page.description_md) ?? toPlainText(page.about_md) }),
      section("questions", "Questions", {
        subtitle: questions.length ? `${questions.length} questions` : null,
        items: questions.map((question, index) => detailItem(question.id || `q-${index}`, question.question, { badge: `Q${index + 1}` }))
      }),
      section("about", "About this quiz", { body: toPlainText(page.about_md) })
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: page.title,
      subtitle: page.universe?.display_name ?? page.universe?.name ?? null,
      summary: toPlainText(page.seo_description) ?? toPlainText(page.description_md),
      coverImage: absoluteAssetUrl(page.universe?.icon_url || pickThumbnail(page.universe?.thumbnail_urls) || "/og-image.png"),
      updatedAt,
      url: `${SITE_URL}/quizzes/${page.code}`,
      badge: questions.length ? `${questions.length} questions` : "Quiz",
      sections
    };
  }

  if (kind === "tools") {
    const tool = await getToolContentWithDevFallback(normalizedSlug);
    if (!tool) {
      const { tools } = await listPublishedToolsPage(1, 100);
      const entry = tools.find((item) => item.code === normalizedSlug);
      if (!entry) return null;
      const updatedAt = resolveModifiedAt(entry);
      const summary = entry.meta_description ?? toPlainText(entry.intro_md);
      return {
        ok: true,
        kind,
        title: entry.title,
        subtitle: entry.universe?.display_name ?? entry.universe?.name ?? null,
        summary,
        coverImage: absoluteAssetUrl(entry.thumb_url || entry.universe?.icon_url || "/og-image.png"),
        updatedAt,
        url: `${SITE_URL}/tools/${entry.code}`,
        badge: "Tool",
        sections: [
          section("overview", "Overview", { body: summary }),
          section("details", "Tool details", {
            items: [
              detailItem("type", "Type", { body: "Bloxodes tool" }),
              entry.universe?.display_name || entry.universe?.name
                ? detailItem("game", "Game", { body: entry.universe.display_name ?? entry.universe.name ?? null })
                : null
            ].filter(Boolean) as MobileContentDetailItem[]
          })
        ].filter(Boolean) as MobileContentDetailSection[]
      };
    }
    const updatedAt = tool.content_updated_at || tool.updated_at || tool.published_at || tool.created_at || null;
    const sections = [
      section("overview", "Overview", { body: toPlainText(tool.intro_md) ?? tool.meta_description }),
      section("how-it-works", "How it works", { body: toPlainText(tool.how_it_works_md) }),
      section("details", "Details", { items: keyValueItems(tool.description_json ?? {}) }),
      section("faq", "FAQ", {
        items: (tool.faq_json ?? []).slice(0, 12).map((entry, index) => detailItem(`faq-${index}`, entry.q, { body: entry.a }))
      })
    ].filter(Boolean) as MobileContentDetailSection[];

    return {
      ok: true,
      kind,
      title: tool.title,
      subtitle: null,
      summary: tool.meta_description,
      coverImage: absoluteAssetUrl(tool.thumb_url || "/og-image.png"),
      updatedAt,
      url: `${SITE_URL}/tools/${tool.code}`,
      badge: "Tool",
      sections
    };
  }

  const page = await getWikiPageBySlug(normalizedSlug);
  if (!page) return null;
  const updatedAt = page.content_updated_at || page.updated_at || page.published_at || page.created_at || null;
  const sections = [
    section("overview", "Overview", { body: page.meta_description ?? page.universe_description ?? page.universe_game_description_md }),
    section("stats", "Game stats", {
      items: [
        detailItem("playing", "Playing", { body: compactNumber(page.playing) }),
        detailItem("visits", "Visits", { body: compactNumber(page.visits) }),
        detailItem("favorites", "Favorites", { body: compactNumber(page.favorites) }),
        detailItem("max-players", "Max players", { body: compactNumber(page.max_players) }),
        detailItem("genre", "Genre", { body: page.universe_genre_l2 ?? page.universe_genre_l1 ?? page.universe_genre })
      ].filter((item) => item.body) as MobileContentDetailItem[]
    }),
    section("controls", "Controls", { items: keyValueItems((page.controls_json ?? {}) as Record<string, unknown>) }),
    section("tips", "Tips", { body: toPlainText(page.tips_md) })
  ].filter(Boolean) as MobileContentDetailSection[];

  return {
    ok: true,
    kind,
    title: page.title,
    subtitle: page.universe_display_name ?? page.universe_name ?? null,
    summary: page.meta_description ?? page.universe_description ?? null,
    coverImage: absoluteAssetUrl(page.cover_image || page.icon_url || pickThumbnail(page.thumbnail_urls) || "/og-image.png"),
    updatedAt,
    url: `${SITE_URL}/wiki/${page.slug}`,
    badge: "Wiki",
    sections
  };
}

export function isMobileContentKind(value: string): value is MobileContentKind {
  return (
    value === "articles" ||
    value === "catalog" ||
    value === "checklists" ||
    value === "events" ||
    value === "lists" ||
    value === "quizzes" ||
    value === "tools" ||
    value === "wiki"
  );
}
