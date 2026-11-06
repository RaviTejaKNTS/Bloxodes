"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegments } from "next/navigation";
import { PageSidebar } from "@/components/PageSidebar";
import { CatalogSidebarContent } from "./CatalogSidebarContent";

/** The directory uses the full width; nested catalog routes retain their shared rail. */
export function CatalogRouteLayout({ children, siteUrl }: { children: ReactNode; siteUrl: string }) {
  const segments = useSelectedLayoutSegments();
  if (segments.length === 0) return <div className="min-w-0">{children}</div>;

  return (
    <div className="catalog-ad-layout grid gap-8 content-sidebar-grid">
      <div className="catalog-main min-w-0">{children}</div>
      <PageSidebar className="hidden lg:block">
        <CatalogSidebarContent siteUrl={siteUrl} />
      </PageSidebar>
    </div>
  );
}
