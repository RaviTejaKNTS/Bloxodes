import type { ReactNode } from "react";
import { HubsSidebarLayout, type HubsSidebarLink } from "@/components/hubs/HubsSidebar";
import { MAP_GUIDE_ID } from "@/components/gta/map-guide-id";
import "@/styles/article-content.css";

export type MapGuideLayoutProps = {
  canonicalPath: string;
  title: string;
  heading: string;
  map: ReactNode;
  children: ReactNode;
  rail: { heading: string; links: HubsSidebarLink[]; footer?: { href: string; label: string } };
  analytics: { contentType: string; itemId: string };
  /** Rendered in the main column after the guide, outside the #article-body stream. */
  after?: ReactNode;
};

/**
 * The map and its guide share one main column beside the ad rail.
 * Interactive map state stays outside the stable #article-body stream.
 * A plain function, not a component, so callers return this exact tree.
 */
export function MapGuideLayout({ canonicalPath, title, heading, map, children, rail, analytics, after }: MapGuideLayoutProps) {
  return (
    <div className="gta-map-guide">
      <HubsSidebarLayout canonicalPath={canonicalPath} title={title} shareHeading="Share this map with your friends" analytics={analytics} heading={rail.heading} links={rail.links} footer={rail.footer}>
        {map}
        <section id={MAP_GUIDE_ID} tabIndex={-1} aria-labelledby={`${MAP_GUIDE_ID}-heading`} className="mt-8 scroll-mt-24 space-y-6 outline-none">
          <h2 id={`${MAP_GUIDE_ID}-heading`} className="text-2xl font-semibold text-foreground sm:text-3xl">{heading}</h2>
          <section id="article-body" itemProp="articleBody" className="article-content prose dark:prose-invert max-w-none game-copy gta-map-guide__body journey-content-stream journey-content-stream--prose">
            {children}
          </section>
        </section>
        {after}
      </HubsSidebarLayout>
    </div>
  );
}
