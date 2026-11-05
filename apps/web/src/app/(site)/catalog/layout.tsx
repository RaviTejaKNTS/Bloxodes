import type { ReactNode } from "react";
import { CatalogRouteLayout } from "@/components/catalog/CatalogRouteLayout";
import { SITE_URL } from "@/lib/seo";
import "@/styles/ads-catalog.css";

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return <CatalogRouteLayout siteUrl={SITE_URL}>{children}</CatalogRouteLayout>;
}
