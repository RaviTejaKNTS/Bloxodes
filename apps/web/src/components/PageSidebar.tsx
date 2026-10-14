import type { ReactNode } from "react";

type PageSidebarProps = {
  children?: ReactNode;
  className?: string;
};

/**
 * The right-hand sidebar of a content page. Ad networks place sticky sidebar ads after its
 * last child (Mediavine targets `aside.space-y-4`), so render exactly one per page, keep it a
 * direct grid item of `.content-sidebar-grid` so it stretches to the content height, and never
 * reuse `<aside className="space-y-4">` for panels inside the page content.
 */
export function PageSidebar({ children, className }: PageSidebarProps) {
  return (
    <aside id="sidebar" className={className ? `space-y-4 ${className}` : "space-y-4"}>
      {children}
    </aside>
  );
}
