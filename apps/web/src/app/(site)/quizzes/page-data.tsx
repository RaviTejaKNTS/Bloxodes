import { pickThumbnail, summarize } from "@/lib/engagement/presentation";
import { GameDiscoverySidebar } from "@/components/game-sidebar/GameDiscoverySidebar";
import { MoreQuizzes } from "@/components/more-content";
import type { QuizTemplateData } from "@/lib/engagement/types";
import { QuizIndexPage } from "@/components/quizzes/QuizIndexPage";
import { ROBLOX_QUIZZES } from "@/lib/engagement/config";
import type { QuizCardData } from "@/lib/engagement/types";
import { getQuizPageByCode, loadQuizData, listPublishedQuizzes, type QuizPage, type QuizListEntry } from "@/lib/quizzes";
import { QUIZZES_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { formatUpdatedLabel } from "@/lib/updated-label";

function mapRowToCard(row: QuizListEntry): QuizCardData {
  const universeName = row.universe?.display_name ?? row.universe?.name ?? null;
  const thumb = pickThumbnail(row.universe?.thumbnail_urls);
  const coverImage = row.universe?.icon_url || thumb || `${SITE_URL}/Bloxodes.png`;
  const updatedAt = row.content_updated_at || row.updated_at || row.published_at || row.created_at || null;
  const summary = summarize(row.seo_description ?? row.description_md ?? null, QUIZZES_DESCRIPTION);

  return {
    code: row.code,
    href: `${ROBLOX_QUIZZES.basePath}/${row.code}`,
    title: row.title,
    summary,
    gameName: universeName ?? "Roblox",
    coverImage,
    updatedAt,
    updatedLabel: formatUpdatedLabel(updatedAt)
  };
}

async function loadQuizzes() {
  const quizzes = await listPublishedQuizzes();
  const cards = (quizzes ?? []).map(mapRowToCard);
  return { cards, total: quizzes.length };
}

export async function loadQuizzesPageData() { return loadQuizzes(); }
export function renderQuizzesPage(props: Awaited<ReturnType<typeof loadQuizzesPageData>>) {
  return <QuizIndexPage {...props} config={ROBLOX_QUIZZES} />;
}

function mapQuizPage(page: QuizPage): QuizTemplateData["page"] {
  return {
    code: page.code, title: page.title, description_md: page.description_md,
    seo_title: page.seo_title, seo_description: page.seo_description,
    created_at: page.created_at, updated_at: page.updated_at,
    published_at: page.published_at, content_updated_at: page.content_updated_at,
    image: pickThumbnail(page.universe?.thumbnail_urls) || page.universe?.icon_url || null,
    gameName: page.universe?.display_name ?? page.universe?.name ?? page.title
  };
}
export async function loadQuizMetadataPage(code: string) {
  const page = await getQuizPageByCode(code);
  return page ? mapQuizPage(page) : null;
}
export async function loadQuizDetailPage(code: string) {
  const page = await getQuizPageByCode(code);
  if (!page) return null;
  const questions = await loadQuizData(page.code);
  if (!questions) return null;
  const viewPage = mapQuizPage(page);
  return {
    data: { page: viewPage, questions },
    sidebar: <GameDiscoverySidebar universeId={page.universe_id ?? null} universeName={viewPage.gameName} currentType="quiz" />,
    relatedContent: <MoreQuizzes excludeCode={page.code} />
  };
}
