import { permanentRedirect } from "next/navigation";
import { AVATAR_CATALOG_MASTER_CODE } from "@/lib/roblox-avatar-catalog";
import type { AvatarCatalogSearchParamsInput } from "../../avatar-marketplace/page-data";

export const revalidate = 0;

type PageProps = {
  params?: Promise<{ segments?: string[] }>;
  searchParams?: AvatarCatalogSearchParamsInput;
};

function firstSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildLegacyRedirectPath(segments: string[], searchParams: Record<string, string | string[] | undefined>) {
  const suffix = segments.length ? `/${segments.map(encodeURIComponent).join("/")}` : "";
  const params = new URLSearchParams();

  for (const key of ["q", "sort", "sale", "creator"]) {
    const value = firstSearchParam(searchParams[key]);
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return `/catalog/${AVATAR_CATALOG_MASTER_CODE}${suffix}${query ? `?${query}` : ""}`;
}

export async function generateMetadata() {
  return {
    robots: {
      index: false,
      follow: true
    }
  };
}

export default async function RobloxAvatarItemsLegacyRedirect({ params, searchParams }: PageProps) {
  const resolvedParams = params ? await params : {};
  const resolvedSearchParams = searchParams ? await searchParams : {};
  permanentRedirect(buildLegacyRedirectPath(resolvedParams.segments ?? [], resolvedSearchParams));
}
