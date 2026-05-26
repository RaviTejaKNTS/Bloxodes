import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { loadPuzzleArchiveData, renderPuzzleArchive } from "../../page-data";

type PageProps = {
  params: Promise<{ slug: string; date: string }>;
};

export const revalidate = 0;

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, date } = await params;
  if (!isIsoDate(date)) return {};
  const data = await loadPuzzleArchiveData(slug, date);
  if (!data) return {};

  const canonical = `${SITE_URL.replace(/\/$/, "")}/puzzles/${data.page.slug}/${data.answer.answer_date}`;
  const title = `${data.page.title} for ${data.answer.answer_date} | ${SITE_NAME}`;
  const description = data.page.meta_description || `Archived ${data.page.title} answer for ${data.answer.answer_date}.`;

  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    robots: {
      index: false,
      follow: true
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article"
    }
  };
}

export default async function PuzzleArchivePage({ params }: PageProps) {
  const { slug, date } = await params;
  if (!isIsoDate(date)) notFound();
  const data = await loadPuzzleArchiveData(slug, date);
  if (!data) notFound();
  return renderPuzzleArchive(data);
}
