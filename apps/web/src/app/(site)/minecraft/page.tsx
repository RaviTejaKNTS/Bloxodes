import type { Metadata } from "next";
import { ContentCard } from "@/components/ContentCard";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { breadcrumbJsonLd, buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getMinecraftWikiPageBySlug, listPublishedMinecraftCollections, listMinecraftTools, resolveMinecraftWikiCoverImage } from "@/lib/minecraft";

const description = "Explore Minecraft collections and calculators for Java and Bedrock Edition.";

const canonical = `${SITE_URL}/minecraft`;
export async function generateMetadata(): Promise<Metadata> {
  const wiki = await getMinecraftWikiPageBySlug("minecraft");
  const image = wiki ? resolveMinecraftWikiCoverImage(wiki) : `${SITE_URL}/Bloxodes.png`;
  const title = `Minecraft Wiki & Tools | ${SITE_NAME}`;
  return { title, description, alternates: buildAlternates(canonical), openGraph: { title, description, url: canonical, type: "website", images: [image] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}

export const revalidate = 21600;

export default async function MinecraftHomePage() {
  const [collections, tools, wiki] = await Promise.all([listPublishedMinecraftCollections(), listMinecraftTools(), getMinecraftWikiPageBySlug("minecraft")]);
  const structuredData = { "@context": "https://schema.org", "@graph": [breadcrumbJsonLd([{ name: "Home", url: SITE_URL }, { name: "Minecraft", url: canonical }]), { "@type": "CollectionPage", name: "Minecraft wiki and tools", description, url: canonical, mainEntity: { "@type": "ItemList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Minecraft Wiki", url: `${canonical}/wiki` }, { "@type": "ListItem", position: 2, name: "Minecraft tools", url: `${canonical}/tools` }] } }] };

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Minecraft", href: null }]} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Minecraft wiki and tools</h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">{description}</p>
        <IndexPageStats items={[{ label: `${collections.length} collections`, icon: "wiki", tone: "accent" }]} />
      </header>

      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--index">
        <div data-journey-item><ContentCard type="wiki" href="/minecraft/wiki" title="Minecraft Wiki" image={wiki ? { src: resolveMinecraftWikiCoverImage(wiki), alt: "Minecraft river and forest" } : undefined} subtitle={`${collections.length} reference collections covering blocks, equipment, creatures and game systems.`} /></div>
        <div data-journey-item><ContentCard type="tool" href="/minecraft/tools" title="Minecraft Tools" subtitle={`${tools.length} calculators and planners for travel, building, crafting, and equipment.`} /></div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </div>
  );
}
