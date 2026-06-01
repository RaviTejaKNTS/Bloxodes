import "server-only";
import fs from "node:fs/promises";
import { publicContentCache } from "@/lib/public-content-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { repoPath } from "@/lib/paths";
import type { QuizData, QuizQuestion } from "@/lib/quiz-types";

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

const QUIZ_DATA_MAP: Record<string, string> = {
  "wizard-alchemy": repoPath("data", "Wizard Alchemy", "quiz.json"),
  "jujutsu-shenanigans": repoPath("data", "Jujutsu Shenanigans", "quiz.json"),
  "the-forge": repoPath("data", "The Forge", "quiz.json"),
  "grow-a-garden": repoPath("data", "Grow a Garden", "quiz.json"),
  "slime-rng": repoPath("data", "Slime RNG", "quiz.json"),
  "dress-to-impress": repoPath("data", "Dress To Impress", "quiz.json"),
  "rivals": repoPath("data", "RIVALS", "quiz.json"),
  "survive-zombie-arena": repoPath("data", "Survive Zombie Arena", "quiz.json"),
  "murderers-vs-sheriffs": repoPath("data", "Murderers VS Sheriffs", "quiz.json"),
  "1-speed-keyboard-escape": repoPath("data", "+1 Speed Keyboard Escape", "quiz.json"),
  "99-nights-in-the-forest": repoPath("data", "99 Nights in the Forest", "quiz.json")
};

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

async function readQuizData(code: string): Promise<QuizData | null> {
  const normalized = normalizeCode(code);
  const filePath = QUIZ_DATA_MAP[normalized];
  if (!filePath) return null;
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as QuizData;
  return parsed;
}

export async function loadQuizData(code: string): Promise<QuizData | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  if (process.env.NODE_ENV === "development") {
    return readQuizData(normalized);
  }

  const cached = publicContentCache(
    async (slug: string) => readQuizData(slug),
    ["quiz-data", normalized],
    { revalidate: 21600 }
  );

  return cached(normalized);
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
