import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { listMinecraftTools } from "@/lib/minecraft";
import { isMinecraftToolSlug } from "@/lib/minecraft-tools/manifest";
import { SITE_URL, buildAlternates } from "@/lib/seo";
import { MinecraftToolCards } from "./page-data";

export const dynamic = "force-dynamic";
const canonical = `${SITE_URL}/minecraft/tools`;
export const metadata: Metadata = { title: "Minecraft tools and calculators", description: "Plan Minecraft materials, enchantments, brewing, storage, travel, and builds with calculators that state their edition and assumptions.", alternates: buildAlternates(canonical), openGraph: { title: "Minecraft tools and calculators", url: canonical, images: [`${SITE_URL}/Bloxodes.png`] } };
export default async function MinecraftToolsPage() {
  const tools = (await listMinecraftTools()).filter(tool => isMinecraftToolSlug(tool.slug));
  const structuredData = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Minecraft tools and calculators", url: canonical, mainEntity: { "@type": "ItemList", itemListElement: tools.map((tool, index) => ({ "@type": "ListItem", position: index + 1, name: tool.title, url: `${canonical}/${tool.slug}` })) } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /><PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Minecraft", href: "/minecraft" }, { label: "Tools" }]} /><header className="mb-8 mt-6 space-y-3"><h1 className="text-4xl font-semibold leading-tight md:text-5xl">Minecraft tools and calculators</h1><p className="max-w-3xl text-base leading-7 text-muted">Calculate materials, compare equipment, and plan your next build. Choose an edition and check the assumptions that affect your result.</p></header>{tools.length ? <MinecraftToolCards tools={tools} /> : <p className="text-muted">No Minecraft tools are published yet.</p>}</>;
}
