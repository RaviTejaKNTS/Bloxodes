import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRedDeadWikiCollectionPageByPath } from "@/lib/red-dead";
import { generateRedDeadCollectionMetadata, renderRedDeadCollectionPageRoute } from "../../page";

type PageProps = { params: Promise<{ slug: string; collection: string; page: string }> };

function parsePage(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2 ? parsed : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, collection, page } = await params;
  return generateRedDeadCollectionMetadata({ slug, collection, currentPage: parsePage(page) ?? 1 });
}

export default async function RedDeadCollectionPaginatedPage({ params }: PageProps) {
  const { slug, collection, page } = await params;
  const currentPage = parsePage(page);
  if (!currentPage) notFound();
  const collectionPage = await getRedDeadWikiCollectionPageByPath(slug, collection);
  if (collectionPage?.page_type === "collectible") notFound();
  return renderRedDeadCollectionPageRoute({ slug, collection, currentPage });
}
