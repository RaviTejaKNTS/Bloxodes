import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateWikiCatalogMetadata, renderWikiCatalogPage } from "../../page";

type PageProps = {
  params: Promise<{ slug: string; collection: string; page: string }>;
};

function parsePage(value: string): number | null {
  const page = Number(value);
  if (!Number.isInteger(page) || page < 2) return null;
  return page;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, collection, page } = await params;
  const currentPage = parsePage(page);
  if (!currentPage) {
    return generateWikiCatalogMetadata({ slug, collection, currentPage: 1 });
  }
  return generateWikiCatalogMetadata({ slug, collection, currentPage });
}

export default async function WikiCatalogPaginatedPage({ params }: PageProps) {
  const { slug, collection, page } = await params;
  const currentPage = parsePage(page);
  if (!currentPage) notFound();
  return renderWikiCatalogPage({ slug, collection, currentPage });
}
