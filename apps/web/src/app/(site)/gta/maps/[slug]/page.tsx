import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "@/styles/gta5-map.css";
import "@/styles/gta-interactive-map.css";
import { GtaInteractiveMap } from "@/components/gta/GtaInteractiveMap";
import { getGtaInteractiveMapDefinition } from "@/lib/gta-interactive-map-registry";
import { getGtaInteractiveMapPageData } from "@/lib/gta-interactive-maps";
import { breadcrumbJsonLd, buildAlternates, SITE_NAME, SITE_URL, webPageJsonLd } from "@/lib/seo";

export const revalidate = 21600;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = getGtaInteractiveMapDefinition(slug);
  if (!config) return { title: "GTA Interactive Map", alternates: buildAlternates(SITE_URL + "/gta/maps/" + slug) };
  const canonical = SITE_URL + config.route;
  const image = SITE_URL + (config.views[0]?.image ?? "/Bloxodes.png");
  return {
    title: config.mapTitle + " | " + SITE_NAME,
    description: config.description,
    alternates: buildAlternates(canonical),
    openGraph: { type: "website", url: canonical, title: config.mapTitle, description: config.description, siteName: SITE_NAME, images: [image] },
    twitter: { card: "summary_large_image", title: config.mapTitle, description: config.description, images: [image] }
  };
}

function structuredData(data: NonNullable<Awaited<ReturnType<typeof getGtaInteractiveMapPageData>>>) {
  const { config, layers, guides, hubTitle } = data;
  const canonical = SITE_URL + config.route;
  const listItems = [
    ...layers.filter((layer) => layer.collectionCode && layer.guideUrl).map((layer) => ({
      name: layer.label,
      url: SITE_URL + layer.guideUrl,
      count: layer.collectionCount ?? layer.pointCount
    })),
    ...guides.map((guide) => ({ name: guide.label, url: SITE_URL + guide.href, count: guide.count }))
  ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      webPageJsonLd({
        siteUrl: SITE_URL,
        slug: config.route.slice(1),
        title: config.mapTitle,
        description: config.description,
        image: SITE_URL + (config.views[0]?.image ?? "/Bloxodes.png"),
        author: null
      }),
      breadcrumbJsonLd([
        { name: "Home", url: SITE_URL },
        { name: "GTA", url: SITE_URL + "/gta" },
        { name: hubTitle, url: SITE_URL + data.hubPath },
        { name: "Interactive map", url: canonical }
      ]),
      {
        "@type": "ItemList",
        name: config.title + " map guides",
        numberOfItems: listItems.length,
        itemListElement: listItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          url: item.url
        }))
      }
    ]
  };
}

export default async function GtaInteractiveMapPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getGtaInteractiveMapPageData(slug);
  if (!data) notFound();
  const jsonLd = structuredData(data);
  const collectionLayers = data.layers.filter((layer) => layer.collectionCode && layer.guideUrl);
  const sourcePages = Array.from(new Map(
    data.layers.map((layer) => [layer.sourceUrl, { title: layer.sourceTitle, url: layer.sourceUrl }])
  ).values());

  return (
    <div className="gta-map-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <GtaInteractiveMap map={data}>
        <div id="article-body" itemProp="articleBody">
          <p>{data.config.description}</p>
          <p>Select a layer to show its locations, zoom to a pin, and open the detail panel for item notes and its linked collection guide. Tracked locations use the same completion state as the Bloxodes guide: progress saves in this browser while signed out and syncs with your account while signed in.</p>
          <p>This page contains {data.config.mappedPointCount.toLocaleString()} mapped points across {data.layers.length} layers. Collection pin numbers and locations are linked to published Bloxodes item rows where the guide has a one-to-one location. Other map markers remain useful place references and are not presented as collection progress.</p>

          <h3>Collection guides</h3>
          {collectionLayers.length ? (
            <ul>
              {collectionLayers.map((layer) => (
                <li key={layer.slug}><Link href={layer.guideUrl!}>{layer.label} ({layer.collectionCount}) ↗</Link></li>
              ))}
            </ul>
          ) : <p>There are no directly tracked collection layers for this map.</p>}

          {data.guides.length ? (
            <>
              <h3>Related guides without plotted collection pins</h3>
              <ul>{data.guides.map((guide) => <li key={guide.code}><Link href={guide.href}>{guide.label} ({guide.count}) ↗</Link>{guide.note ? " — " + guide.note : ""}</li>)}</ul>
            </>
          ) : null}

          <h3>Map notes</h3>
          {data.config.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <p>Jump and flight pins mark the source map's recorded location or approach area. Follow the linked guide and use the in-game completion prompt where the activity requires a successful landing or timed objective.</p>

          <h3>Sources and map artwork</h3>
          <p>Pin names, placement, and map artwork are credited to the linked GTA Wiki community map records. Community text and coordinate annotations are adapted under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>; the game map artwork is separate material © Rockstar Games.</p>
          <ul>{sourcePages.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
          {data.config.views.length > 1 ? (
            <>
              <h3>Map areas</h3>
              <ul>{data.config.views.map((view) => <li key={view.slug}>{view.label} — <a href={view.sourceUrl} target="_blank" rel="noreferrer">source map page</a></li>)}</ul>
            </>
          ) : null}
        </div>
      </GtaInteractiveMap>
    </div>
  );
}
