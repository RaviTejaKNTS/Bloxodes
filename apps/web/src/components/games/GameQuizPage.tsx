import { CommentsSection } from "@/components/comments/CommentsSection";
import { QuizPageTemplate, quizMetadata } from "@/components/quizzes/QuizPageTemplate";
import { SocialShare } from "@/components/SocialShare";
import { parseGameQuizData, type GameExtendedPage } from "@/lib/game-page-data";
import { resolveGameCoverImage } from "@/lib/game-images";
import { SITE_URL } from "@/lib/seo";
import { GameRelatedLinks } from "./GameRelatedLinks";

function quizPresentation(page: GameExtendedPage) {
  return {
    data: {
      page: { ...page, code: page.slug, gameName: page.game_title, image: resolveGameCoverImage(page), seo_description: page.meta_description, description_md: [page.intro_md, page.description_md].filter(Boolean).join("\n\n") },
      questions: parseGameQuizData(page.quiz_data)
    },
    config: { basePath: `/${page.namespace}/quizzes`, homePath: "/", title: "Quizzes", heading: "Quizzes", intro: "", description: page.meta_description || page.title, progressNamespace: page.namespace, progress: { sessionEndpoint: "/api/quizzes/session", progressEndpoint: `/api/games/${page.namespace}/quizzes/progress` } }
  };
}
export function gameQuizMetadata(page: GameExtendedPage) {
  const { data, config } = quizPresentation(page);
  return quizMetadata(data.page, config);
}
export function GameQuizPage({ page }: { page: GameExtendedPage }) {
  const presentation = quizPresentation(page);
  return <QuizPageTemplate {...presentation} sidebar={<><SocialShare url={SITE_URL + page.canonical_path} title={page.title} heading="Share this quiz" /><GameRelatedLinks namespace={page.namespace} gameId={page.game_id} canonicalPath={page.canonical_path} /></>} relatedContent={<CommentsSection entityType="game_quiz" entityId={page.id} />} />;
}
