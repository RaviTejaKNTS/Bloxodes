import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import {
  generateAvatarCatalogMetadata,
  renderAvatarCatalogPage,
  resolveAvatarCatalogRoute,
  resolveAvatarCatalogSearch,
  type AvatarCatalogSearchParamsInput
} from "../../avatar-marketplace/page-data";
import { AVATAR_CATALOG_MASTER_CODE } from "@/lib/roblox-avatar-catalog";

export const revalidate = 0;

type PageProps = {
  params?: Promise<{ segments?: string[] }>;
  searchParams?: AvatarCatalogSearchParamsInput;
};

export async function generateMetadata({ params, searchParams }: PageProps) {
  const resolvedParams = params ? await params : {};
  return generateAvatarCatalogMetadata({
    prefix: AVATAR_CATALOG_MASTER_CODE,
    segments: resolvedParams.segments ?? [],
    searchParams
  });
}

export default async function RobloxItemsAndBundlesPage({ params, searchParams }: PageProps) {
  const resolvedParams = params ? await params : {};
  const route = resolveAvatarCatalogRoute(AVATAR_CATALOG_MASTER_CODE, resolvedParams.segments ?? []);
  if (!route) notFound();

  const filters = await resolveAvatarCatalogSearch(searchParams);
  return renderAvatarCatalogPage({ route, filters });
}
