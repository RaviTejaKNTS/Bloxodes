import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseMinecraftEdition } from "@/lib/minecraft-edition";
import { generateMinecraftCollectionMetadata, renderMinecraftCollectionPageRoute } from "../../page";

type PageProps = { params: Promise<{ collection: string; page: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };
function parsePage(value: string): number | null {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= 2 ? Number(value) : null;
}
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { collection, page } = await params;
  const query = await searchParams;
  return generateMinecraftCollectionMetadata({ slug: "minecraft", collection, currentPage: parsePage(page) ?? 1, edition: parseMinecraftEdition(query?.edition) ?? undefined });
}
export default async function MinecraftCollectionPaginatedPage({ params, searchParams }: PageProps) {
  const { collection, page } = await params;
  const currentPage = parsePage(page);
  if (!currentPage) notFound();
  const query = await searchParams;
  const edition = parseMinecraftEdition(query?.edition) ?? undefined;
  return renderMinecraftCollectionPageRoute({ slug: "minecraft", collection, currentPage, edition, searchParams: query });
}
