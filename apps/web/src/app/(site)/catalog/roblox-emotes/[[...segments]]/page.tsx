import { permanentRedirect } from "next/navigation";
import "@/styles/article-content.css";
import {
  generateAvatarCatalogMetadata,
  type AvatarCatalogSearchParamsInput
} from "../../avatar-marketplace/page-data";
import { buildAvatarCatalogRedirectHref } from "@/lib/roblox-avatar-catalog";

export const revalidate = 21600;

type PageProps = {
  params?: Promise<{ segments?: string[] }>;
  searchParams?: AvatarCatalogSearchParamsInput;
};

const PREFIX = "roblox-emotes";

export async function generateMetadata({ params, searchParams }: PageProps) {
  const resolvedParams = params ? await params : {};
  return generateAvatarCatalogMetadata({
    prefix: PREFIX,
    segments: resolvedParams.segments ?? [],
    searchParams
  });
}

export default async function RobloxEmotesPage({ params, searchParams }: PageProps) {
  const resolvedParams = params ? await params : {};
  const resolvedSearchParams = searchParams ? await searchParams : {};
  permanentRedirect(buildAvatarCatalogRedirectHref(PREFIX, resolvedParams.segments ?? [], resolvedSearchParams));
}
