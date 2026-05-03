import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  buildGrowGardenCatalogPath,
  GROW_GARDEN_CATALOGS,
  getGrowGardenCatalogConfig
} from "../page-data";
import { generateGrowGardenCollectionMetadata } from "../collection-route";

export const revalidate = 86400;

type PageProps = {
  params: Promise<{ collection: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { collection } = await params;
  return generateGrowGardenCollectionMetadata(collection);
}

export async function generateStaticParams() {
  return GROW_GARDEN_CATALOGS.map((entry) => ({ collection: entry.slug }));
}

export default async function GrowGardenCatalogCollectionPage({ params }: PageProps) {
  const { collection } = await params;
  const config = getGrowGardenCatalogConfig(collection);
  if (!config) {
    notFound();
  }

  permanentRedirect(buildGrowGardenCatalogPath(config.slug));
}
