import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { MoreCatalogs } from "@/components/more-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import type { RobloxMeshId } from "@/lib/roblox-mesh-ids";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { MeshIdsBrowser } from "./MeshIdsBrowser";

export const CATALOG_CODE = "roblox-mesh-ids";
export const BASE_PATH = `/catalog/${CATALOG_CODE}`;
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;
export const FALLBACK_TITLE = "Roblox Mesh IDs";
export const FALLBACK_SEO_TITLE = "Roblox Mesh IDs [1,000 3D Mesh Assets]";
export const FALLBACK_DESCRIPTION =
  "Browse 1,000 public Roblox mesh IDs, compare official 3D previews, and copy the exact Mesh ID you need for Roblox Studio.";

function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildItemListSchema({
  title,
  description,
  meshes,
  total,
  currentPage,
  canonical
}: {
  title: string;
  description: string;
  meshes: RobloxMeshId[];
  total: number;
  currentPage: number;
  canonical: string;
}) {
  return serializeJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url: canonical,
    numberOfItems: total,
    itemListElement: meshes.map((mesh, index) => ({
      "@type": "ListItem",
      position: (currentPage - 1) * 40 + index + 1,
      item: {
        "@type": "Thing",
        name: mesh.name,
        identifier: String(mesh.mesh_id),
        url: mesh.creator_store_url,
        ...(mesh.thumbnail_url ? { image: mesh.thumbnail_url } : {}),
        additionalProperty: [
          { "@type": "PropertyValue", name: "Mesh ID", value: String(mesh.mesh_id) },
          ...(mesh.texture_id
            ? [{ "@type": "PropertyValue", name: "Texture ID", value: String(mesh.texture_id) }]
            : [])
        ]
      }
    }))
  });
}

export function renderMeshIdsPage({
  meshes,
  total,
  totalPages,
  currentPage,
  contentHtml,
  description = FALLBACK_DESCRIPTION
}: {
  meshes: RobloxMeshId[];
  total: number;
  totalPages: number;
  currentPage: number;
  contentHtml: PageContentHtml | null;
  description?: string;
}) {
  const baseTitle = contentHtml?.title?.trim() || FALLBACK_TITLE;
  const title = currentPage > 1 ? `${baseTitle} — Page ${currentPage}` : baseTitle;
  const path = currentPage > 1 ? `${BASE_PATH}/page/${currentPage}` : BASE_PATH;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${path}`;
  const updatedAt = contentHtml?.updatedAt ?? meshes[0]?.verified_at ?? meshes[0]?.roblox_updated_at ?? null;
  const introNodes = currentPage === 1 && contentHtml?.introHtml
    ? renderPageContentNodes(contentHtml.introHtml, "mesh-ids-intro")
    : null;
  const descriptionNodes = currentPage === 1
    ? (contentHtml?.descriptionHtml ?? []).flatMap((entry) =>
        renderPageContentNodes(entry.html, `mesh-ids-description-${entry.key}`)
      )
    : [];
  const howNodes = currentPage === 1 && contentHtml?.howHtml
    ? renderPageContentNodes(contentHtml.howHtml, "mesh-ids-how")
    : null;
  const faqNodes = currentPage === 1
    ? (contentHtml?.faqHtml ?? []).map((faq, index) => ({
        id: `${faq.q}-${index}`,
        question: faq.q,
        answer: renderPageContentNodes(faq.a, `mesh-ids-faq-${index}`)
      }))
    : [];
  const pageSchema = serializeJsonLd(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: path.replace(/^\//, ""),
      title,
      description,
      image: meshes[0]?.thumbnail_url || `${SITE_URL}/Bloxodes.png`,
      author: null,
      publishedAt: contentHtml?.publishedAt ?? undefined,
      updatedAt: updatedAt ?? undefined
    })
  );
  const breadcrumbSchema = serializeJsonLd(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: title, url: canonical }
    ])
  );

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Catalog", href: "/catalog" },
            { label: title, href: null }
          ]}
        />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={updatedAt} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-8">
        {introNodes}
        <MeshIdsBrowser
          initialMeshes={meshes}
          initialTotalPages={totalPages}
          currentPage={currentPage}
          basePath={BASE_PATH}
        />
        {currentPage === 1 ? (
          <>
            <CatalogAdSlot />
            {descriptionNodes}
            {howNodes}
            {faqNodes.length ? <ContentFaq items={faqNodes} title="Roblox Mesh IDs FAQ" /> : null}
            <CatalogAdSlot />
          </>
        ) : null}
      </section>

      {currentPage === 1 && contentHtml?.id ? (
        <CommentsSection entityType="catalog" entityId={contentHtml.id} />
      ) : null}
      {currentPage === 1 ? <MoreCatalogs excludeCode={CATALOG_CODE} /> : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      {meshes.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: buildItemListSchema({ title, description, meshes, total, currentPage, canonical })
          }}
        />
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
