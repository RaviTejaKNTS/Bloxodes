import { safeJsonLd } from "@/lib/seo";
import { ContentCard } from "@/components/ContentCard";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { createGameReader, type SharedGameWikiPage } from "@/lib/shared-game-reader";
import { renderMarkdown } from "@/lib/markdown";
import { renderPageContentNodes } from "@/lib/page-content";
import { breadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { legacyWikiCommentType } from "./GameWikiPage";

export async function GameWikiHub({ page, namespaceTitle }: { page: SharedGameWikiPage; namespaceTitle: string }) {
  const reader = createGameReader(page.namespace);
  const pages = await reader.listPublishedSharedGameWikiPages();
  const html = await renderMarkdown(page.description_md ?? "");
  const graph = [breadcrumbJsonLd([{ name: "Home", url: SITE_URL }, { name: namespaceTitle, url: `${SITE_URL}/${page.namespace}` }, { name: page.title, url: `${SITE_URL}${page.canonical_path}` }]), {
    "@type": "CollectionPage", name: page.title, url: `${SITE_URL}${page.canonical_path}`,
    mainEntity: { "@type": "ItemList", itemListElement: pages.map((child, i) => ({ "@type": "ListItem", position: i + 1, name: child.title, url: `${SITE_URL}${child.canonical_path}` })) }
  }];
  return <div className="space-y-10">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({ "@context": "https://schema.org", "@graph": graph }) }} />
    <header className="space-y-4"><PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: namespaceTitle, href: `/${page.namespace}` }, { label: "Wiki", href: null }]} /><h1 className="text-4xl font-semibold leading-tight md:text-5xl">{page.title}</h1></header>
    <article id="article-body" className="journey-content-stream journey-content-stream--index">
      <div className="article-content md-copy-scope max-w-3xl">{renderPageContentNodes(html, `${page.namespace}-hub-intro`)}</div>
      {pages.map(child => <div key={child.id} data-journey-item><ContentCard type="wiki" variant="overlay" href={child.canonical_path} title={child.title} image={{ src: reader.resolveSharedGameWikiCoverImage(child), alt: child.title, ratio: "1200/675" }} /></div>)}
    </article>
    <CommentsSection entityType={legacyWikiCommentType(page.namespace)} entityId={page.id} />
  </div>;
}
