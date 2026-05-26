import "server-only";
import { publicContentCache } from "@/lib/public-content-cache";
import { supabaseAdmin } from "@/lib/supabase";

export type PuzzleFaqEntry = { q: string; a: string };

export type PuzzlePage = {
  id: string;
  slug: string;
  provider: string;
  title: string;
  seo_title?: string | null;
  meta_description?: string | null;
  intro_md?: string | null;
  answer_intro_md?: string | null;
  how_to_play_md?: string | null;
  description_md?: string | null;
  faq_json?: PuzzleFaqEntry[] | null;
  source_url?: string | null;
  sort_order?: number | null;
  is_published: boolean;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  content_updated_at?: string | null;
  latest_answer_date?: string | null;
  latest_fetched_at?: string | null;
};

export type PuzzleAnswer = {
  id: string;
  puzzle_slug: string;
  answer_date: string;
  puzzle_id?: string | null;
  source_url?: string | null;
  fetched_at?: string | null;
  extracted_from?: string | null;
  answer_summary?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PuzzlePageWithAnswers = {
  page: PuzzlePage;
  answers: PuzzleAnswer[];
  today: PuzzleAnswer | null;
  yesterday: PuzzleAnswer | null;
  archive: PuzzleAnswer[];
};

const PUZZLE_PAGE_SELECT =
  "id, slug, provider, title, seo_title, meta_description, intro_md, answer_intro_md, how_to_play_md, description_md, faq_json, source_url, sort_order, is_published, published_at, created_at, updated_at, content_updated_at, latest_answer_date, latest_fetched_at";

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function normalizeDate(value: string) {
  return value.trim().slice(0, 10);
}

async function loadPublishedPuzzlePagesRaw(): Promise<PuzzlePage[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("puzzle_pages_view")
    .select(PUZZLE_PAGE_SELECT)
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("Error fetching puzzle pages", error);
    return [];
  }

  return (data ?? []) as PuzzlePage[];
}

export const listPublishedPuzzlePages = publicContentCache(
  loadPublishedPuzzlePagesRaw,
  ["listPublishedPuzzlePages"],
  { revalidate: 900, tags: ["puzzles-index"] }
);

export async function listPublishedPuzzleSlugs(): Promise<string[]> {
  const pages = await listPublishedPuzzlePages();
  return pages.map((page) => page.slug).filter(Boolean);
}

export async function getPuzzlePageBySlug(slug: string): Promise<PuzzlePage | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;

  const cached = publicContentCache(
    async (value: string) => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("puzzle_pages_view")
        .select(PUZZLE_PAGE_SELECT)
        .eq("slug", value)
        .eq("is_published", true)
        .maybeSingle();

      if (error) {
        console.error("Error fetching puzzle page", error);
        return null;
      }

      return (data as PuzzlePage | null) ?? null;
    },
    ["puzzlePage", normalized],
    { revalidate: 900, tags: [`puzzle:${normalized}`, "puzzles-index"] }
  );

  return cached(normalized);
}

export async function getPuzzleAnswers(slug: string, limit = 40): Promise<PuzzleAnswer[]> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return [];

  const cached = publicContentCache(
    async (value: string, rowLimit: number) => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("puzzle_answers")
        .select("id, puzzle_slug, answer_date, puzzle_id, source_url, fetched_at, extracted_from, answer_summary, payload, created_at, updated_at")
        .eq("puzzle_slug", value)
        .order("answer_date", { ascending: false })
        .limit(rowLimit);

      if (error) {
        console.error("Error fetching puzzle answers", error);
        return [];
      }

      return (data ?? []) as PuzzleAnswer[];
    },
    ["puzzleAnswers", normalized],
    { revalidate: 900, tags: [`puzzle:${normalized}`] }
  );

  return cached(normalized, limit);
}

export async function getPuzzleAnswerByDate(slug: string, date: string): Promise<PuzzleAnswer | null> {
  const normalized = normalizeSlug(slug);
  const answerDate = normalizeDate(date);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(answerDate)) return null;

  const cached = publicContentCache(
    async (value: string, dateValue: string) => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("puzzle_answers")
        .select("id, puzzle_slug, answer_date, puzzle_id, source_url, fetched_at, extracted_from, answer_summary, payload, created_at, updated_at")
        .eq("puzzle_slug", value)
        .eq("answer_date", dateValue)
        .maybeSingle();

      if (error) {
        console.error("Error fetching puzzle answer", error);
        return null;
      }

      return (data as PuzzleAnswer | null) ?? null;
    },
    ["puzzleAnswerByDate", normalized, answerDate],
    { revalidate: 900, tags: [`puzzle:${normalized}`] }
  );

  return cached(normalized, answerDate);
}

export async function getPuzzlePageWithAnswers(slug: string): Promise<PuzzlePageWithAnswers | null> {
  const page = await getPuzzlePageBySlug(slug);
  if (!page) return null;
  const answers = await getPuzzleAnswers(page.slug, 45);
  const [today = null, yesterday = null, ...archive] = answers;
  return { page, answers, today, yesterday, archive };
}

export async function listPuzzleSitemapEntries(): Promise<Array<{ slug: string; updatedAt: string | null }>> {
  const pages = await listPublishedPuzzlePages();
  return pages.map((page) => ({
    slug: page.slug,
    updatedAt: page.content_updated_at ?? page.latest_fetched_at ?? page.updated_at ?? page.published_at ?? null
  }));
}
