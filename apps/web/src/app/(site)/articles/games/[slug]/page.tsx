import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articleGameMetadata, loadArticleGamePageData, renderArticleGamePage } from "./page-data";

export const revalidate = 86400;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadArticleGamePageData(slug, 1);
  if (!data) return {};
  return articleGameMetadata(data.game);
}

export default async function ArticleGamePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadArticleGamePageData(slug, 1);
  if (!data) {
    notFound();
  }

  return renderArticleGamePage({
    ...data,
    currentPage: 1
  });
}
