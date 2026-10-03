import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseMinecraftEdition } from "@/lib/minecraft-edition";
import { minecraftWikiSlug } from "@/lib/minecraft-paths";
import { generateMinecraftCollectionMetadata, renderMinecraftCollectionPageRoute } from "../../../collection-page-data";
export const revalidate = 21600;
type Props = { params: Promise<{ edition: string; collection: string; page: string }> };
function pageNumber(raw: string): number {
  return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) >= 2 ? Number(raw) : 0;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { edition: raw, collection, page } = await params;
  const edition = parseMinecraftEdition(raw);
  if (!edition || !pageNumber(page)) return { robots: { index: false, follow: false } };
  return generateMinecraftCollectionMetadata({ slug: minecraftWikiSlug(edition), collection, currentPage: pageNumber(page) });
}
export default async function CollectionPage({ params }: Props) {
  const { edition: raw, collection, page } = await params;
  const edition = parseMinecraftEdition(raw), currentPage = pageNumber(page);
  if (!edition || !currentPage) notFound();
  return renderMinecraftCollectionPageRoute({ slug: minecraftWikiSlug(edition), collection, currentPage });
}
