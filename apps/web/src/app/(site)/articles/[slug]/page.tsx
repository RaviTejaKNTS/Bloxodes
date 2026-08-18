import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  generateArticlePageMetadata,
  renderArticlePage
} from "./article-page";
import { getArticleBySlug } from "@/lib/db";

export const revalidate = 86400;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return generateArticlePageMetadata(slug, 1);
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  return renderArticlePage(article, 1);
}
