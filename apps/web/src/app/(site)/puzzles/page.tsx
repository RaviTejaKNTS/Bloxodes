import "@/styles/article-content.css";
import type { Metadata } from "next";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { loadPuzzlesIndexData, PUZZLES_DESCRIPTION, renderPuzzlesIndex } from "./page-data";

export const revalidate = 0;

export const metadata: Metadata = {
  title: `Puzzle Answers | ${SITE_NAME}`,
  description: PUZZLES_DESCRIPTION,
  alternates: buildAlternates(`${SITE_URL.replace(/\/$/, "")}/puzzles`)
};

export default async function PuzzlesPage() {
  const data = await loadPuzzlesIndexData();
  return renderPuzzlesIndex(data);
}
