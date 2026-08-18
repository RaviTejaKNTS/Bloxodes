import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  articleContentPageCount,
  generateArticlePageMetadata,
  renderArticlePage
} from "../../article-page";
import { getArticleBySlug } from "@/lib/db";

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
  return generateArticlePageMetadata(slug, pageNumber);
}

export default async function ArticlePaginatedPage({ params }: PageProps) {
  const { slug, page } = await params;
  const pageNumber = Number(page);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) {
    notFound();
  }

  if (pageNumber === 1) {
    redirect(`/articles/${slug}`);
  }

  const article = await getArticleBySlug(slug);
  if (!article || pageNumber > articleContentPageCount(article.content_md)) {
    notFound();
  }

  return renderArticlePage(article, pageNumber);
}
