import "server-only";
import { publicContentCache } from "@/lib/public-content-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { parseQuizData, type QuizData, type QuizQuestion } from "@/lib/quiz-types";

export type { QuizData, QuizOption, QuizQuestion } from "@/lib/quiz-types";

export type QuizPage = {
  id: string;
  universe_id?: number | null;
  code: string;
  title: string;
  description_md?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  is_published: boolean;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  content_updated_at?: string | null;
  universe?: {
    universe_id?: number | null;
    slug?: string | null;
    display_name?: string | null;
    name?: string | null;
    icon_url?: string | null;
    thumbnail_urls?: unknown;
    genre_l1?: string | null;
    genre_l2?: string | null;
  } | null;
};

export type QuizListEntry = Pick<
  QuizPage,
  "id" | "code" | "title" | "description_md" | "seo_description" | "published_at" | "created_at" | "updated_at" | "content_updated_at" | "universe"
> & {
  universe_id?: number | null;
};

const QUIZ_SELECT_FIELDS_VIEW =
  "id, universe_id, code, title, description_md, seo_title, seo_description, is_published, published_at, created_at, updated_at, content_updated_at, universe";
const QUIZ_SELECT_FIELDS_BASE =
  "id, universe_id, code, title, description_md, seo_title, seo_description, is_published, published_at, created_at, updated_at";

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

const cachedLoadQuizData = publicContentCache(
  async (code: string): Promise<QuizData | null> => {
    const { data, error } = await supabaseAdmin()
      .from("quiz_pages")
      .select("quiz_data")
      .eq("code", code)
      .eq("is_published", true)
      .maybeSingle();

    if (error) throw new Error(`Failed to load quiz data for ${code}: ${error.message}`);
    if (!data) return null;
    const quizData = (data as { quiz_data?: unknown }).quiz_data;
    if (quizData == null) throw new Error(`Published quiz ${code} has no quiz_data payload.`);
    return parseQuizData(quizData, `quiz_pages.${code}.quiz_data`);
  },
  ["quiz-data"],
  { revalidate: 21600, tags: ["quizzes-index"] }
);

export async function loadQuizData(code: string): Promise<QuizData | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return cachedLoadQuizData(normalized);
}

export async function getQuizPageByCode(code: string): Promise<QuizPage | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("quiz_pages_view")
    .select(QUIZ_SELECT_FIELDS_VIEW)
    .eq("code", normalized)
    .eq("is_published", true)
    .maybeSingle();

  if (!error && data) {
    return data as QuizPage;
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("quiz_pages")
    .select(QUIZ_SELECT_FIELDS_BASE)
    .eq("code", normalized)
    .eq("is_published", true)
    .maybeSingle();

  if (fallbackError) {
    console.error("Error fetching quiz page", fallbackError);
    return null;
  }

  return (fallback as QuizPage) ?? null;
}

const cachedListPublishedQuizzes = publicContentCache(
  async () => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("quiz_pages_view")
      .select(QUIZ_SELECT_FIELDS_VIEW)
      .eq("is_published", true)
      .order("content_updated_at", { ascending: false })
      .order("id", { ascending: true });

    if (!error && data) {
      return (data ?? []) as QuizListEntry[];
    }

    const { data: fallback, error: fallbackError } = await supabase
      .from("quiz_pages")
      .select(QUIZ_SELECT_FIELDS_BASE)
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true });

    if (fallbackError) {
      console.error("Error fetching quiz pages", fallbackError);
      return [];
    }

    return (fallback ?? []) as QuizListEntry[];
  },
  ["listPublishedQuizzes"],
  {
    revalidate: 21600,
    tags: ["quizzes-index"]
  }
);

export async function getQuizByUniverseId(universeId: number): Promise<QuizListEntry | null> {
  const cached = publicContentCache(
    async () => {
      const supabase = supabaseAdmin();
      const { data } = await supabase
        .from("quiz_pages_view")
        .select(QUIZ_SELECT_FIELDS_VIEW)
        .eq("is_published", true)
        .eq("universe_id", universeId)
        .order("content_updated_at", { ascending: false })
        .limit(1);
      const row = (data ?? [])[0];
      return row ? (row as QuizListEntry) : null;
    },
    [`quiz-by-universe:${universeId}`],
    { revalidate: 21600, tags: ["quizzes-index"] }
  );
  return cached();
}

export async function listPublishedQuizzes(): Promise<QuizListEntry[]> {
  return cachedListPublishedQuizzes();
}

export async function listPublishedQuizCodes(): Promise<string[]> {
  const cached = publicContentCache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("quiz_pages")
        .select("code")
        .eq("is_published", true);

      if (error) throw error;
      return (data ?? []).map((row) => (row as { code: string }).code).filter(Boolean);
    },
    ["listPublishedQuizCodes"],
    {
      revalidate: 21600,
      tags: ["quizzes-index"]
    }
  );

  return cached();
}
