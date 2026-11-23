import { CommentsSection } from "@/components/comments/CommentsSection";
import { getGameLandingForLinks } from "@/lib/game-landing";
import { gameBreadcrumbs } from "@/lib/game-root-page";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { ContentFaq } from "@/components/ContentFaq";
import { renderPageContentNodes } from "@/lib/page-content";
import { breadcrumbJsonLd, safeJsonLd, buildAlternates, SITE_URL } from "@/lib/seo";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { type GameExtendedPage } from "@/lib/game-page-data";
import "@/styles/article-content.css";
import "@/styles/ads-content.css";
import { load } from "cheerio";
import { PageSidebar } from "@/components/PageSidebar";
import { SocialShare } from "@/components/SocialShare";
import { GameRelatedLinks } from "./GameRelatedLinks";
import { resolveGameCoverImage } from "@/lib/game-images";

// Keep raw HTML copy's existing styles when splitting shared reference pages.
export function ContentHtmlBlocks({ html, group }: { html: string; group: string }) {
  const $ = load(html, null, false);
  return $.root().contents().toArray().filter(node => node.type !== "text" || node.data.trim()).map((node, index) => (
    <div key={`${group}-${index}`} className={`ads-content-plain-copy ads-content-game-${group} article-content`} dangerouslySetInnerHTML={{ __html: $.html(node) }} />
  ));
}

export function gameContentMetadata(page: GameExtendedPage): Metadata {
  const url = SITE_URL + page.canonical_path;
  const description = page.meta_description || markdownToPlainText(page.intro_md ?? "").slice(0,160);
  const image = resolveGameCoverImage(page);
  return { twitter: { card: "summary_large_image", images: image ? [image] : [] }, title: page.seo_title || page.title, description, alternates:buildAlternates(url), openGraph:{title:page.title,description,url,type:"website",images:image ? [image] : []} };
}
function validGameFaqs(page: GameExtendedPage) {
  return (page.faq_json ?? []).filter(faq => faq?.q?.trim() && faq?.a?.trim());
}
export function gameNamespaceTitle(namespace: string) {
  return namespace.split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
}
export function gameContentBreadcrumbs(page: GameExtendedPage, landingPath: string) {
  return gameBreadcrumbs([{ label: "Home", href: "/" }, { label: gameNamespaceTitle(page.namespace), href: landingPath }, { label: page.title }], page.canonical_path);
}
/** WebPage, breadcrumb and FAQ JSON-LD shared by every map, catalog and other shared reference page. */
export function gameContentJsonLd(page: GameExtendedPage, landingPath: string) {
  const image = resolveGameCoverImage(page);
  const validFaqs = validGameFaqs(page);
  const breadcrumbs = gameContentBreadcrumbs(page, landingPath);
  const graph = [
    { "@type": "WebPage", name: page.title, url: SITE_URL + page.canonical_path, description: page.meta_description, dateModified: page.updated_at, image: image || undefined },
    breadcrumbJsonLd(breadcrumbs.map(item => ({ name: item.label, url: SITE_URL + (item.href || page.canonical_path) }))),
    ...(validFaqs.length ? [{ "@type": "FAQPage", mainEntity: validFaqs.map(faq => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) }] : [])
  ];
  return safeJsonLd({ "@context": "https://schema.org", "@graph": graph });
}
export async function gameContentFaqs(page: GameExtendedPage) {
  return Promise.all(validGameFaqs(page).map(async (faq, index) => ({ id: `${page.id}-faq-${index}`, question: faq.q, answer: renderPageContentNodes(await renderMarkdown(faq.a), `${page.id}-answer-${index}`) })));
}
// A game can supply its own body without changing the title, copy or metadata layout.
export async function GameContentPage({ page, children }: { page: GameExtendedPage; children: ReactNode }) {
  const [intro, description] = await Promise.all([renderMarkdown(page.intro_md ?? ""),renderMarkdown(page.description_md ?? "")]);
  const faqs = await gameContentFaqs(page);
  const landing = await getGameLandingForLinks(page.namespace);
  const breadcrumbs = gameContentBreadcrumbs(page, landing.path);
  const isMap = page.renderer_key === "image-pins" || page.canonical_path.includes("/maps/");
  return <div className="grid gap-8 content-sidebar-grid">
    <div className="min-w-0 space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: gameContentJsonLd(page, landing.path) }} />
      <PageBreadcrumb items={breadcrumbs} />
      <header className="space-y-4"><h1 className="text-4xl font-semibold">{page.title}</h1></header>
      {isMap ? children : null}
      <article id="article-body" className={`journey-content-stream space-y-8${isMap ? " journey-content-stream--prose" : ""}`}>
        <ContentHtmlBlocks html={intro} group="intro" />
        {isMap ? null : children}
        <ContentHtmlBlocks html={description} group="description" />
        <ContentFaq items={faqs} />
      </article>
      <CommentsSection entityType={isMap ? "game_map" : "game_catalog"} entityId={page.id} />
    </div>
    <PageSidebar>
      <SocialShare url={SITE_URL + page.canonical_path} title={page.title} heading="Share this page" />
      <GameRelatedLinks namespace={page.namespace} gameId={page.game_id} canonicalPath={page.canonical_path} />
    </PageSidebar>
  </div>;
}
