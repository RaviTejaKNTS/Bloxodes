import type { ReactNode } from "react";
import { PageSidebar } from "@/components/PageSidebar";
import { CatalogSidebarContent } from "@/components/catalog/CatalogSidebarContent";
import { SITE_URL } from "@/lib/seo";
import "@/styles/ads-catalog.css";

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="catalog-ad-layout grid gap-8 content-sidebar-grid">
      <div className="catalog-main min-w-0">{children}</div>
      <PageSidebar className="hidden lg:block">
        <CatalogSidebarContent siteUrl={SITE_URL} />
      </PageSidebar>
    </div>
  );
}
