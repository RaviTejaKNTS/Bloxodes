import "@/styles/article-content.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getPuzzlePageBySlug, listPublishedPuzzleSlugs } from "@/lib/puzzles";
import { loadPuzzleDetailData, PUZZLES_DESCRIPTION, renderPuzzleDetail } from "../page-data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 0;

export async function generateStaticParams() {
  const slugs = await listPublishedPuzzleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPuzzlePageBySlug(slug);
  if (!page) return {};

  const canonical = `${SITE_URL.replace(/\/$/, "")}/puzzles/${page.slug}`;
  const title = resolveSeoTitle(page.seo_title) || page.title;
  const description = page.meta_description || PUZZLES_DESCRIPTION;

  return {
    title: title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`,
    description,
    alternates: buildAlternates(canonical),
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function PuzzleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadPuzzleDetailData(slug);
  if (!data) notFound();
  return renderPuzzleDetail(data);
}
