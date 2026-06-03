import type { Metadata } from "next";
import "@/styles/article-content.css";
import { SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { getToolContentWithDevFallback } from "@/lib/tools";
import { loadForgeArmorDataset } from "@/lib/forge/armors";
import { loadForgeOreDataset } from "@/lib/forge/ores";
import { loadForgeWeaponDataset } from "@/lib/forge/weapons";
import { ContentSlot } from "@/components/ContentSlot";
import { ForgeInventoryOptimizerClient } from "./ForgeInventoryOptimizerClient";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { resolveModifiedAt, resolvePublishedAt } from "@/lib/content-dates";
import { buildPageContentHtml, renderPageContentNodes } from "@/lib/page-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";

export const revalidate = 21600;

const TOOL_CODE = "the-forge-inventory-optimizer";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/tools/the-forge-inventory-optimizer`;
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;
const TOOL_AD_SLOT = "3529946151";

export async function generateMetadata(): Promise<Metadata> {
    const tool = await getToolContentWithDevFallback(TOOL_CODE);
    if (!tool) {
        return {
            title: "The Forge Inventory Optimizer",
            description: "Optimize your ore inventory for The Forge. Get smart loadout suggestions, maximize damage or defense, and plan efficient batch crafting.",
            alternates: buildAlternates(CANONICAL)
        };
    }

    const title = resolveSeoTitle(tool.seo_title) ?? tool.title ?? undefined;
    const description = tool.meta_description ?? undefined;
    const image = tool.thumb_url || FALLBACK_IMAGE;
    const publishedTime = resolvePublishedAt(tool);
    const modifiedTime = resolveModifiedAt(tool);

    return {
        title,
        description,
        alternates: buildAlternates(CANONICAL),
        openGraph: {
            type: "article",
            url: CANONICAL,
            title,
            description,
            siteName: SITE_NAME,
            images: [image],
            publishedTime: publishedTime ? new Date(publishedTime).toISOString() : undefined,
            modifiedTime: modifiedTime ? new Date(modifiedTime).toISOString() : undefined
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [image]
        }
    };
}

export default async function ForgeInventoryOptimizerPage() {
    const tool = await getToolContentWithDevFallback(TOOL_CODE);
    const contentHtml = await buildPageContentHtml(tool);
    const introNodes = contentHtml?.introHtml ? renderPageContentNodes(contentHtml.introHtml, "tool-intro") : null;
    const descriptionNodes = (contentHtml?.descriptionHtml ?? []).map((entry) => ({
        key: entry.key,
        nodes: renderPageContentNodes(entry.html, `tool-description-${entry.key}`)
    }));
    const howNodes = contentHtml?.howHtml ? renderPageContentNodes(contentHtml.howHtml, "tool-how") : null;
    const faqNodes = (contentHtml?.faqHtml ?? []).map((faq, idx) => ({
        ...faq,
        nodes: renderPageContentNodes(faq.a, `tool-faq-${idx}`)
    }));
    const oreDataset = await loadForgeOreDataset();
    const weaponDataset = await loadForgeWeaponDataset();
    const armorDataset = await loadForgeArmorDataset();
    const publishedTime = tool ? resolvePublishedAt(tool) : null;
    const modifiedTime = tool ? resolveModifiedAt(tool) : null;
    const fallbackIntro =
        "Optimize your ore inventory for The Forge. Input your available ores and get smart loadout suggestions to maximize damage, defense, or resource efficiency. Plan multiple crafts and make the most of your inventory.";

    const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                name: tool?.title ?? "The Forge Inventory Optimizer",
                description: tool?.meta_description ?? "Optimize ore inventory and get smart loadout suggestions for The Forge.",
                url: CANONICAL,
                datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
                dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
                breadcrumb: {
                    "@type": "BreadcrumbList",
                    itemListElement: [
                        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                        { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL.replace(/\/$/, "")}/tools` },
                        { "@type": "ListItem", position: 3, name: tool?.title ?? "The Forge Inventory Optimizer" }
                    ]
                },
                mainEntity: {
                    "@type": "WebApplication",
                    name: tool?.title ?? "The Forge Inventory Optimizer",
                    description: tool?.meta_description ?? "Inventory optimizer with loadout suggestions and batch planning.",
                    applicationCategory: "Utility",
                    operatingSystem: "Web",
                    url: CANONICAL
                }
            }
        ]
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
            <PageBreadcrumb
                className="mb-6 text-xs uppercase tracking-[0.25em] text-muted"
                items={[
                    { label: "Home", href: "/" },
                    { label: "Tools", href: "/tools" },
                    { label: tool?.title ?? "The Forge Inventory Optimizer", href: null }
                ]}
            />

            <header className="space-y-3">
                <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
                    {tool?.title ?? "The Forge Inventory Optimizer"}
                </h1>
                <UpdatedTimestamp value={modifiedTime} />
            </header>

            <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space mt-8 space-y-6">
                {introNodes ? introNodes : <p data-md-copy className="md-copy-node md-copy-p">{fallbackIntro}</p>}
                <ContentSlot
                    slot={TOOL_AD_SLOT}
                    className="mt-8 w-full"
                    adLayout={null}
                    adFormat="auto"
                    fullWidthResponsive
                />
                <div className="mt-8">
                    <ForgeInventoryOptimizerClient
                        ores={oreDataset.ores}
                        weapons={weaponDataset.weapons}
                        armorPieces={armorDataset.armorPieces}
                    />
                </div>
                {howNodes ? howNodes : null}
                <ContentSlot
                    slot={TOOL_AD_SLOT}
                    className="my-8 w-full"
                    adLayout={null}
                    adFormat="auto"
                    fullWidthResponsive
                />
                {(descriptionNodes.length || faqNodes.length) ? (
                    <>
                    {descriptionNodes.length ? descriptionNodes.flatMap((entry) => entry.nodes) : null}

                    {faqNodes.length ? (
                        <>
                            <ContentSlot
                                slot={TOOL_AD_SLOT}
                                className="w-full"
                                adLayout={null}
                                adFormat="auto"
                                fullWidthResponsive
                            />
                            <ContentFaq
                                items={faqNodes.map((faq, idx) => ({
                                    id: `${faq.q}-${idx}`,
                                    question: faq.q,
                                    answer: faq.nodes
                                }))}
                            />
                        </>
                    ) : null}
                    </>
                ) : null}
            </section>

            {tool?.id ? (
                <div className="mt-10">
                    <CommentsSection entityType="tool" entityId={tool.id} />
                </div>
            ) : null}

            <ContentSlot
                slot={TOOL_AD_SLOT}
                className="mt-8 w-full"
                adLayout={null}
                adFormat="auto"
                fullWidthResponsive
            />
        </>
    );
}
