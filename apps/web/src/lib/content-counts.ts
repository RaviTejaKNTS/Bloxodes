import "server-only";
import { RETIRED_MUSIC_GAME_CATALOG_CODES } from "@/lib/game-specific-id-pages";
import { supabaseAdmin } from "@/lib/supabase";

export type ContentCounts = {
  codes: number;
  wiki: number;
  tools: number;
  catalogs: number;
  checklists: number;
  quizzes: number;
  articles: number;
  events: number;
};

/**
 * Accurate published counts per content type (exact head counts), used for the
 * homepage "browse" tiles. Runs on the homepage render, which is revalidated
 * on-demand when content changes, so the numbers stay correct.
 */
export async function getContentCounts(): Promise<ContentCounts> {
  const sb = supabaseAdmin();
  const countOf = async (table: string, publishColumn = "is_published", excludeCodes: readonly string[] = []): Promise<number> => {
    try {
      let query = sb.from(table).select("id", { count: "exact", head: true }).eq(publishColumn, true);
      if (excludeCodes.length) query = query.not("code", "in", `(${excludeCodes.map((code) => `"${code}"`).join(",")})`);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    } catch (error) {
      console.error(`Failed to count ${table}`, error);
      return 0;
    }
  };

  const [codes, wiki, tools, catalogs, checklists, quizzes, articles, events] = await Promise.all([
    countOf("code_pages"),
    countOf("wiki_pages"),
    countOf("tools"),
    countOf("catalog_pages", "is_published", RETIRED_MUSIC_GAME_CATALOG_CODES),
    countOf("checklist_pages_view", "is_public"),
    countOf("quiz_pages"),
    countOf("articles"),
    countOf("events_pages")
  ]);

  return { codes, wiki, tools, catalogs, checklists, quizzes, articles, events };
}
