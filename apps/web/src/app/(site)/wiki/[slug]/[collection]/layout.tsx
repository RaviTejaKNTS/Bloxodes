import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAlternates, SITE_URL } from "@/lib/seo";
import { buildWikiCollectionPath, getWikiCollectionPageByPath } from "@/lib/wiki-collections";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; collection: string }>;
}): Promise<Metadata> {
  const { slug, collection } = await params;
  const page = await getWikiCollectionPageByPath(slug, collection);
  if (page?.page_type !== "collectible") return {};

  // Next keeps layout metadata when a child page returns notFound().
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildWikiCollectionPath(slug, collection)}`;
  return { alternates: buildAlternates(canonical) };
}

export default function WikiCollectionLayout({ children }: { children: ReactNode }) {
  return children;
}
