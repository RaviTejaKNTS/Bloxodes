import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { markdownToPlainText } from "@/lib/markdown";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL, WIKI_DESCRIPTION } from "@/lib/seo";
import { getWikiPageBySlug, listPublishedWikiSlugs } from "@/lib/wiki";
import { loadWikiDetailPageData, renderWikiDetailPage } from "../page-data";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function normalizeDescription(value?: string | null): string | null {
  if (!value) return null;
  const plain = markdownToPlainText(value).replace(/\s+/g, " ").trim();
  if (!plain) return null;
  if (plain.length <= 180) return plain;
  const slice = plain.slice(0, 177);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 130 ? slice.slice(0, lastSpace) : slice}…`;
}

function normalizeMetadataImage(value?: string | null): string {
  if (!value) return `${SITE_URL}/og-image.png`;
  try {
    return new URL(value, SITE_URL).toString();
  } catch {
    return `${SITE_URL}/og-image.png`;
  }
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const canonical = `${SITE_URL}/wiki/${slug}`;
  const page = await getWikiPageBySlug(slug);

  if (!page) {
    return {
      alternates: buildAlternates(canonical)
    };
  }

  const title = resolveSeoTitle(page.seo_title) ?? page.title ?? `Roblox Wiki | ${SITE_NAME}`;
  const description =
    normalizeDescription(page.meta_description) ??
    normalizeDescription(page.description_md) ??
    WIKI_DESCRIPTION;
  const image = normalizeMetadataImage(page.cover_image ?? page.icon_url);
  const publishedAt = page.published_at ?? page.created_at ?? null;
  const modifiedAt = page.content_updated_at ?? page.updated_at ?? publishedAt;
  const publishedTime = publishedAt ? new Date(publishedAt).toISOString() : undefined;
  const modifiedTime = modifiedAt ? new Date(modifiedAt).toISOString() : undefined;

  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: [image],
      publishedTime,
      modifiedTime
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function WikiDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadWikiDetailPageData(slug);
  if (!data) {
    notFound();
  }

  return renderWikiDetailPage(data);
}
