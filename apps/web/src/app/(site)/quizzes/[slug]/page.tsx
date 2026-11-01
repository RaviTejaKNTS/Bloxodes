import { resolvePageTypeGameRoute } from "@/lib/page-type-game-route";
import { notFound } from "next/navigation";
import { QuizPageTemplate, quizMetadata } from "@/components/quizzes/QuizPageTemplate";
import { ROBLOX_QUIZZES } from "@/lib/engagement/config";
import { loadQuizDetailPage, loadQuizMetadataPage } from "../page-data";
export const revalidate = 21600;
type PageProps = { params: Promise<{ slug: string }> };
export async function generateStaticParams() { return []; }
export async function generateMetadata({ params }: PageProps) {
  const data = await loadQuizMetadataPage((await params).slug);
  if (!data) {
    const gameRoute = await resolvePageTypeGameRoute(`/quizzes/${(await params).slug}`);
    if (gameRoute) return gameRoute.metadata();
  }
  return quizMetadata(data, ROBLOX_QUIZZES);
}
export default async function QuizPage({ params }: PageProps) {
  const result = await loadQuizDetailPage((await params).slug);
  if (!result) {
    const gameRoute = await resolvePageTypeGameRoute(`/quizzes/${(await params).slug}`);
    if (gameRoute) return gameRoute.render();
    notFound();
  }
  return <QuizPageTemplate {...result} config={ROBLOX_QUIZZES} />;
}
