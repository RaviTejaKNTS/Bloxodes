import type { Metadata } from "next";
import { ContentCard } from "@/components/ContentCard";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { buildMinecraftWikiPath, listPublishedMinecraftWikiPages, resolveMinecraftWikiCoverImage } from "@/lib/minecraft";
import { breadcrumbJsonLd, buildAlternates, SITE_URL } from "@/lib/seo";
export const revalidate = 21600;
const title = "Minecraft wikis for Java and Bedrock Edition";
const description = "Choose your Minecraft edition for blocks, recipes, equipment and game rules. Java advancements and Bedrock achievements have separate references.";
export const metadata: Metadata = { title, description, alternates: buildAlternates(`${SITE_URL}/minecraft/wiki`), openGraph: { type: "website", title, description, url: `${SITE_URL}/minecraft/wiki` }, twitter: { card: "summary_large_image", title, description } };
export async function MinecraftEditionCards() {
  const pages = (await listPublishedMinecraftWikiPages()).filter(page => page.slug !== "minecraft");
  return <>{pages.map(page => <div key={page.id} data-journey-item><ContentCard type="wiki" href={buildMinecraftWikiPath(page.slug)} title={page.title} subtitle={page.meta_description ?? undefined} image={{ src: resolveMinecraftWikiCoverImage(page), alt: page.title }} /></div>)}</>;
}
export default async function MinecraftWikiIndex() {
  const pages = (await listPublishedMinecraftWikiPages()).filter(page => page.slug !== "minecraft");
  const graph = [breadcrumbJsonLd([{ name: "Home", url: SITE_URL }, { name: "Minecraft", url: `${SITE_URL}/minecraft` }, { name: "Minecraft wikis", url: `${SITE_URL}/minecraft/wiki` }]), { "@type": "CollectionPage", name: title, description, url: `${SITE_URL}/minecraft/wiki`, mainEntity: { "@type": "ItemList", itemListElement: pages.map((page, index) => ({ "@type": "ListItem", position: index + 1, name: page.title, url: `${SITE_URL}${buildMinecraftWikiPath(page.slug)}` })) } }];
  return <div className="space-y-9"><header className="space-y-4"><PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Minecraft", href: "/minecraft" }, { label: "Wikis" }]} /><h1 className="text-4xl font-semibold leading-tight md:text-5xl">{title}</h1><p className="max-w-3xl text-base leading-7 text-muted">{description}</p><p className="max-w-3xl text-base leading-7 text-muted">Java Edition runs on Windows, macOS and Linux. Bedrock Edition connects players on Windows, consoles and mobile devices. Match the edition shown in your game before following a recipe or planning equipment.</p></header><section id="article-body" className="journey-content-stream journey-content-stream--index"><MinecraftEditionCards /></section><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") }} /></div>;
}
