import { CommentsSection } from "@/components/comments/CommentsSection";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { buildAlternates, SITE_URL } from "@/lib/seo";
import { safeGameContentUrl, type GameExtendedPage } from "@/lib/game-page-data";
import "@/styles/article-content.css";

export function gameContentMetadata(page: GameExtendedPage): Metadata {
  const url = SITE_URL + page.canonical_path;
  const description = page.meta_description || markdownToPlainText(page.intro_md ?? "").slice(0,160);
  return { title: page.seo_title || page.title, description, alternates:buildAlternates(url), openGraph:{title:page.title,description,url,type:"website"} };
}
// A game can supply its own body without changing the title, copy or metadata layout.
export async function GameContentPage({ page, children }: { page: GameExtendedPage; children: ReactNode }) {
  const [intro, description] = await Promise.all([renderMarkdown(page.intro_md ?? ""),renderMarkdown(page.description_md ?? "")]);
  const sources = (page.sources_json ?? []).filter(source => source && safeGameContentUrl(source.url));
  const schema = { "@context":"https://schema.org","@type":"WebPage",name:page.title,url:SITE_URL+page.canonical_path,description:page.meta_description,dateModified:page.updated_at };
  return <div className="space-y-6"><PageBreadcrumb items={[{label:"Home",href:"/"},{label:page.game_title,href:`/${page.namespace}`},{label:page.title}]} /><article id="article-body" className="journey-content-stream space-y-8"><header className="space-y-4"><h1 className="text-4xl font-semibold">{page.title}</h1>{intro ? <div className="article-content" dangerouslySetInnerHTML={{__html:intro}} /> : null}</header>{children}{description ? <div className="article-content" dangerouslySetInnerHTML={{__html:description}} /> : null}{sources.length ? <section><h2 className="text-2xl font-semibold">Sources</h2><ul>{sources.map(source => <li key={source.url}><a className="text-accent underline" href={source.url} rel="noreferrer" target="_blank">{typeof source.title === "string" ? source.title : source.url}</a></li>)}</ul></section> : null}<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}} /></article><CommentsSection entityType={page.canonical_path.includes("/maps/") ? "game_map" : page.canonical_path.includes("/quizzes/") ? "game_quiz" : "game_catalog"} entityId={page.id} /></div>;
}
