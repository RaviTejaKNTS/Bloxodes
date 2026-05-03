import fs from "node:fs/promises";
import { repoPath } from "@/lib/paths";
import Link from "next/link";
import Image from "next/image";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { breadcrumbJsonLd, CATALOG_DESCRIPTION, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { PageBreadcrumb, type PageBreadcrumbItem } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { renderPageContentNodes } from "@/lib/page-content";
import { PagePagination } from "@/components/PagePagination";

const PAGE_SIZE = 24;

export const BASE_PATH = "/catalog/roblox-decal-ids";
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;

export type DecalRow = {
    id: string;
    page: number;
    name?: string;
    description?: string;
    creator?: {
        id: number;
        name: string;
        type: string;
    };
    created?: string;
    updated?: string;
    isForSale?: boolean;
    priceInRobux?: number;
    sales?: number;
    thumbnail?: string;
    error?: string;
};

export type CatalogContentHtml = {
    id?: string | null;
    title?: string | null;
    introHtml?: string;
    howHtml?: string;
    descriptionHtml?: Array<{ key: string; html: string }>;
    faqHtml?: Array<{ q: string; a: string }>;
    updatedAt?: string | null;
};

type PageData = {
    decals: DecalRow[];
    total: number;
    totalPages: number;
};

export type BreadcrumbItem = PageBreadcrumbItem;

const DECAL_DATA_FILE = repoPath("data", "decal-ids", "enriched-decal-ids.json");

async function loadAllDecals(): Promise<DecalRow[]> {
    try {
        const fileContent = await fs.readFile(DECAL_DATA_FILE, "utf-8");
        const decals: DecalRow[] = JSON.parse(fileContent);
        // Filter out errors and entries without names
        return decals.filter(d => !d.error && d.name);
    } catch (error) {
        console.error("Failed to load decal data:", error);
        return [];
    }
}

export async function loadRobloxDecalIdsPageData(page: number): Promise<PageData> {
    const allDecals = await loadAllDecals();
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const offset = (safePage - 1) * PAGE_SIZE;
    const total = allDecals.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const decals = allDecals.slice(offset, offset + PAGE_SIZE);

    return { decals, total, totalPages };
}

function buildRobloxUrl(assetId: string): string {
    return `https://www.roblox.com/library/${assetId}`;
}

function buildThumbnailUrl(decal: DecalRow): string {
    if (decal.thumbnail) return decal.thumbnail;
    return `https://www.roblox.com/asset-thumbnail/image?assetId=${decal.id}&width=420&height=420&format=png`;
}

function formatDate(dateString: string | undefined): string | null {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
        return null;
    }
}

export function DecalBreadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
    return <PageBreadcrumb items={items} className={className} />;
}

export function DecalIdGrid({ decals }: { decals: DecalRow[] }) {
    if (!decals.length) {
        return (
            <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
                No decal IDs have been collected yet. Check back soon.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {decals.map((decal) => {
                const uploadDate = formatDate(decal.created);
                return (
                    <article
                        key={decal.id}
                        className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:border-accent/55"
                    >
                        {/* Image Preview */}
                        <div className="relative aspect-square w-full overflow-hidden bg-background/60">
                            <Image
                                src={buildThumbnailUrl(decal)}
                                alt={decal.name || `Decal ${decal.id}`}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                                className="object-cover"
                                unoptimized
                            />
                            {decal.isForSale && decal.priceInRobux ? (
                                <span className="absolute right-2 top-2 rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white">
                                    {decal.priceInRobux} R$
                                </span>
                            ) : null}
                        </div>

                        <div className="flex flex-1 flex-col gap-3 p-4">
                            {/* Decal Name */}
                            <h2 className="text-lg font-semibold leading-snug text-foreground line-clamp-2">
                                {decal.name || `Decal ${decal.id}`}
                            </h2>

                            {/* Creator Info */}
                            {decal.creator?.name ? (
                                <div className="flex items-center gap-2 text-xs text-muted">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide">Creator</span>
                                    <span className="font-semibold text-foreground line-clamp-1">{decal.creator.name}</span>
                                </div>
                            ) : null}

                            {/* Decal ID */}
                            <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
                                <span>Decal ID</span>
                                <span className="font-mono text-[0.82rem]">{decal.id}</span>
                                <CopyCodeButton
                                    code={String(decal.id)}
                                    tone="surface"
                                    size="sm"
                                    analytics={{
                                        event: "decal_id_copy",
                                        params: {
                                            asset_id: decal.id,
                                            creator: decal.creator?.name ?? ""
                                        }
                                    }}
                                />
                            </div>

                            {/* Upload Date & Sales */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                {uploadDate ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2.5 py-0.5">
                                        <span className="text-[9px] font-semibold uppercase tracking-wide">Uploaded</span>
                                        <span className="font-semibold text-foreground">{uploadDate}</span>
                                    </span>
                                ) : null}
                                {decal.sales && decal.sales > 0 ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2.5 py-0.5">
                                        <span className="text-[9px] font-semibold uppercase tracking-wide">Sales</span>
                                        <span className="font-semibold text-foreground">{decal.sales.toLocaleString()}</span>
                                    </span>
                                ) : null}
                            </div>

                            {/* Action Button */}
                            <div className="mt-auto">
                                <a
                                    href={buildRobloxUrl(decal.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
                                >
                                    View on Roblox
                                </a>
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

export function buildDecalItemListSchema({
    title,
    description,
    url,
    decals,
    total,
    startIndex
}: {
    title: string;
    description: string;
    url: string;
    decals: DecalRow[];
    total: number;
    startIndex: number;
}) {
    const itemListElement = decals.map((decal, index) => {
        const item: Record<string, unknown> = {
            "@type": "ImageObject",
            name: decal.name || `Decal ${decal.id}`,
            url: buildRobloxUrl(decal.id),
            contentUrl: buildThumbnailUrl(decal)
        };
        if (decal.creator?.name) {
            item.creator = { "@type": "Person", name: decal.creator.name };
        }
        if (decal.description) {
            item.description = decal.description;
        }
        return {
            "@type": "ListItem",
            position: startIndex + index + 1,
            item
        };
    });

    return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: title,
        description,
        url,
        numberOfItems: total,
        itemListElement
    });
}

export function renderRobloxDecalIdsPage({
    decals,
    total,
    totalPages,
    currentPage,
    showHero,
    contentHtml
}: {
    decals: DecalRow[];
    total: number;
    totalPages: number;
    currentPage: number;
    showHero: boolean;
    contentHtml?: CatalogContentHtml | null;
}) {
    const introHtml = contentHtml?.introHtml?.trim() ? contentHtml?.introHtml : "";
    const descriptionHtml = contentHtml?.descriptionHtml ?? [];
    const howHtml = contentHtml?.howHtml?.trim() ? contentHtml?.howHtml : "";
    const faqHtml = contentHtml?.faqHtml ?? [];
    const baseTitle = contentHtml?.title?.trim() ? contentHtml.title.trim() : "Roblox Decal IDs";
    const updatedDate = contentHtml?.updatedAt ? new Date(contentHtml.updatedAt) : null;
    const canonicalPath = currentPage > 1 ? `${BASE_PATH}/page/${currentPage}` : BASE_PATH;
    const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
    const pageTitle = currentPage > 1 ? `${baseTitle} - Page ${currentPage}` : baseTitle;
    const description = CATALOG_DESCRIPTION;
    const image = `${SITE_URL}/og-image.png`;
    const updatedIso = updatedDate ? updatedDate.toISOString() : undefined;
    const startIndex = (currentPage - 1) * PAGE_SIZE;

    const breadcrumbNavItems: BreadcrumbItem[] = [
        { label: "Home", href: "/" },
        { label: "Catalog", href: "/catalog" },
        { label: "Roblox Decal IDs", href: currentPage > 1 ? BASE_PATH : null }
    ];
    if (currentPage > 1) {
        breadcrumbNavItems.push({ label: `Page ${currentPage}`, href: null });
    }

    const breadcrumbSchemaItems =
        currentPage > 1
            ? [
                { name: "Home", url: SITE_URL },
                { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
                { name: "Roblox Decal IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
                { name: `Page ${currentPage}`, url: canonicalUrl }
            ]
            : [
                { name: "Home", url: SITE_URL },
                { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
                { name: "Roblox Decal IDs", url: canonicalUrl }
            ];

    const hasDetails =
        Boolean(descriptionHtml.length) || Boolean(howHtml) || Boolean(faqHtml.length);
    const introNodes = introHtml ? renderPageContentNodes(introHtml, "decal-intro") : null;
    const descriptionNodes = descriptionHtml.flatMap((entry) =>
        renderPageContentNodes(entry.html, `decal-description-${entry.key}`)
    );
    const howNodes = howHtml ? renderPageContentNodes(howHtml, "decal-how") : null;
    const faqNodes = faqHtml.map((faq, idx) => ({
        ...faq,
        nodes: renderPageContentNodes(faq.a, `decal-faq-${idx}`)
    }));

    const listSchema = buildDecalItemListSchema({
        title: pageTitle,
        description,
        url: canonicalUrl,
        decals,
        total,
        startIndex
    });

    const pageSchema = JSON.stringify(
        webPageJsonLd({
            siteUrl: SITE_URL,
            slug: canonicalPath.replace(/^\//, ""),
            title: pageTitle,
            description,
            image,
            author: null,
            publishedAt: updatedIso,
            updatedAt: updatedIso
        })
    );

    const breadcrumbSchema = JSON.stringify(breadcrumbJsonLd(breadcrumbSchemaItems));

    return (
        <div className="catalog-surface space-y-10">
            {showHero ? (
                <header className="space-y-4">
                    <DecalBreadcrumb items={breadcrumbNavItems} />
                    <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{baseTitle}</h1>
                    <UpdatedTimestamp value={updatedDate} />
                    <p className="text-lg text-muted">
                        Browse {total.toLocaleString()} verified Roblox decal IDs with visual previews. Copy any image ID instantly.
                    </p>
                </header>
            ) : (
                <header className="space-y-2">
                    <DecalBreadcrumb items={breadcrumbNavItems} />
                    <h1 className="text-3xl font-semibold text-foreground">{baseTitle}</h1>
                    <p className="text-sm text-muted">
                        Page {currentPage} of {totalPages}
                    </p>
                </header>
            )}

            <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
                {introNodes && showHero ? introNodes : null}

                <CatalogAdSlot />

                <DecalIdGrid decals={decals} />

                {totalPages > 1 ? (
                    <PagePagination
                        className="flex items-center justify-center gap-2"
                        currentPage={currentPage}
                        totalPages={totalPages}
                        basePath={BASE_PATH}
                    />
                ) : null}

                <CatalogAdSlot />

                {showHero && hasDetails ? (
                    <>
                        {descriptionNodes.length ? descriptionNodes : null}

                        {howNodes ? howNodes : null}

                        <ContentFaq
                            items={faqNodes.map((faq, idx) => ({
                                id: `${faq.q}-${idx}`,
                                question: faq.q,
                                answer: faq.nodes
                            }))}
                        />
                    </>
                ) : null}
            </section>

            {contentHtml?.id ? (
                <div className="mt-10">
                    <CommentsSection entityType="catalog" entityId={contentHtml.id} />
                </div>
            ) : null}

            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
        </div>
    );
}
