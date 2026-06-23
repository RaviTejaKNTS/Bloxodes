import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articleGameMetadata, loadArticleGamePageData, renderArticleGamePage } from "../../page-data";

export const revalidate = 86400;

type PageProps = {
  params: Promise<{ slug: string; page: string }>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, page } = await params;
  const pageNumber = Number(page);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) return {};
  const data = await loadArticleGamePageData(slug, pageNumber);
  if (!data) return {};
  return articleGameMetadata(data.game, pageNumber);
}

export default async function ArticleGamePaginatedPage({ params }: PageProps) {
  const { slug, page } = await params;
  const pageNumber = Number(page);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const data = await loadArticleGamePageData(slug, pageNumber);
  if (!data || pageNumber > data.totalPages) {
    notFound();
  }

  return renderArticleGamePage({
    ...data,
    currentPage: pageNumber
  });
}
