import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseMinecraftEdition } from "@/lib/minecraft-edition";
import { minecraftWikiSlug } from "@/lib/minecraft-paths";
import { generateMinecraftCollectionMetadata, renderMinecraftCollectionPageRoute } from "../collection-page-data";
export const revalidate = 21600;
type Props = { params: Promise<{ edition: string; collection: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { edition: raw, collection } = await params;
  const edition = parseMinecraftEdition(raw);
  if (!edition) return { robots: { index: false, follow: false } };
  return generateMinecraftCollectionMetadata({ slug: minecraftWikiSlug(edition), collection, currentPage: 1 });
}
export default async function CollectionPage({ params }: Props) {
  const { edition: raw, collection } = await params;
  const edition = parseMinecraftEdition(raw);
  if (!edition) notFound();
  return renderMinecraftCollectionPageRoute({ slug: minecraftWikiSlug(edition), collection, currentPage: 1 });
}
