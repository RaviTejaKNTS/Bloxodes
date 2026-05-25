import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  buildForgeCatalogPath,
  FORGE_CATALOGS,
  getForgeCatalogConfig
} from "../page-data";
import { generateForgeCollectionMetadata } from "../collection-route";

export const revalidate = 0;

type PageProps = {
  params: Promise<{ collection: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { collection } = await params;
  return generateForgeCollectionMetadata(collection);
}

export async function generateStaticParams() {
  return [];
}

export default async function ForgeCatalogCollectionPage({ params }: PageProps) {
  const { collection } = await params;
  const config = getForgeCatalogConfig(collection);
  if (!config) {
    notFound();
  }

  permanentRedirect(buildForgeCatalogPath(config.slug));
}
