import { ROBLOX_QUIZZES } from "@/lib/engagement/config";
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { loadQuizzesPageData, renderQuizzesPage } from "./page-data";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: `${ROBLOX_QUIZZES.title} | ${SITE_NAME}`,
  description: ROBLOX_QUIZZES.description,
  alternates: buildAlternates(`${SITE_URL}${ROBLOX_QUIZZES.basePath}`),
  openGraph: {
    type: "website",
    url: `${SITE_URL}${ROBLOX_QUIZZES.basePath}`,
    title: `${ROBLOX_QUIZZES.title} | ${SITE_NAME}`,
    description: ROBLOX_QUIZZES.description,
    siteName: SITE_NAME
  },
  twitter: {
    card: "summary_large_image",
    title: `${ROBLOX_QUIZZES.title} | ${SITE_NAME}`,
    description: ROBLOX_QUIZZES.description
  }
};

export default async function QuizzesPage() {
  const { cards, total } = await loadQuizzesPageData();
  return renderQuizzesPage({ cards, total });
}
