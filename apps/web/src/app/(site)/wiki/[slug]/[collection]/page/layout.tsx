import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAlternates, SITE_URL } from "@/lib/seo";
import { buildWikiCollectionPath, getWikiCollectionPageByPath } from "@/lib/wiki-collections";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string; collection: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug, collection } = await params;
  const wikiSlug = slug.trim().toLowerCase();
  const collectionSlug = collection.trim().toLowerCase();
  const page = await getWikiCollectionPageByPath(wikiSlug, collectionSlug);
  if (page?.page_type !== "collectible") return {};

  return {
    alternates: buildAlternates(`${SITE_URL.replace(/\/$/, "")}${buildWikiCollectionPath(wikiSlug, collectionSlug)}`)
  };
}

export default function WikiCollectionPaginationLayout({ children }: LayoutProps) {
  return children;
}
