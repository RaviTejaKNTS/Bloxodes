import type { Metadata } from "next";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { resolveModifiedAt } from "@/lib/content-dates";
import { listMinecraftTools } from "@/lib/minecraft";
import { getMinecraftToolCover } from "@/lib/minecraft-tools/covers";
import { isMinecraftToolSlug } from "@/lib/minecraft-tools/manifest";
import { SITE_URL, buildAlternates } from "@/lib/seo";
import { MinecraftToolCards } from "./page-data";

export const dynamic = "force-dynamic";
const canonical = `${SITE_URL}/minecraft/tools`;
export const metadata: Metadata = {
  title: "Minecraft tools and calculators",
  description: "Plan Minecraft materials, enchantments, brewing, storage, travel, and builds with calculators that state their edition and assumptions.",
  alternates: buildAlternates(canonical),
  openGraph: {
    title: "Minecraft tools and calculators",
    url: canonical,
    images: [`${SITE_URL}${getMinecraftToolCover("crafting-materials-planner")}`]
  }
};

export default async function MinecraftToolsPage() {
  const tools = (await listMinecraftTools()).filter(tool => isMinecraftToolSlug(tool.slug));
  const latestUpdatedAt = tools.reduce<string | null>((latest, tool) => {
    const candidate = resolveModifiedAt(tool);
    if (!candidate) return latest;
    return !latest || new Date(candidate) > new Date(latest) ? candidate : latest;
  }, null);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Minecraft tools and calculators",
    url: canonical,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: tools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.title,
        url: `${canonical}/${tool.slug}`,
        image: tool.thumb_url ? `${SITE_URL}${tool.thumb_url}` : undefined
      }))
    }
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Minecraft", href: "/minecraft" }, { label: "Tools" }]} />
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Minecraft tools and calculators</h1>
        <UpdatedTimestamp value={latestUpdatedAt} />
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Calculate materials, compare equipment, and plan your next build. Choose an edition and check the assumptions that affect your result.
        </p>
        <IndexPageStats items={[{ label: `${tools.length} tools published`, icon: "tools", tone: "accent" }]} />
      </header>
      {tools.length ? <MinecraftToolCards tools={tools} hub /> : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No Minecraft tools are published yet.
        </div>
      )}
    </div>
  );
}
