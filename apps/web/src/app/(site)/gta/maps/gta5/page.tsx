import type { Metadata } from "next";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "@/styles/gta5-map.css";
import { Gta5InteractiveMap } from "@/components/gta/Gta5InteractiveMap";
import { getGta5MapMarkers } from "@/lib/gta-map";
import { GTA5_MAP_LAYERS, GTA5_MAP_PATH } from "@/lib/gta-map-types";
import { breadcrumbJsonLd, buildAlternates, SITE_NAME, SITE_URL, webPageJsonLd } from "@/lib/seo";

export const revalidate = 21600;

const title = "GTA 5 Interactive Map: Story Mode Collectibles & Challenges";
const description = "Explore 377 GTA 5 Story Mode collectible and challenge locations on a full-screen Los Santos map. Search 11 collections, browse 92 named places, and track your progress.";
const canonical = `${SITE_URL}${GTA5_MAP_PATH}`;

export const metadata: Metadata = {
  title: `${title} | ${SITE_NAME}`,
  description,
  alternates: buildAlternates(canonical),
  openGraph: { type: "website", url: canonical, title, description, siteName: SITE_NAME, images: [`${SITE_URL}/Bloxodes.png`] },
  twitter: { card: "summary_large_image", title, description, images: [`${SITE_URL}/Bloxodes.png`] }
};

export default async function Gta5MapPage() {
  const markers = await getGta5MapMarkers();
  const structuredData = [
    webPageJsonLd({ siteUrl: SITE_URL, slug: GTA5_MAP_PATH.slice(1), title, description, image: `${SITE_URL}/Bloxodes.png`, author: null }),
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "GTA", url: `${SITE_URL}/gta` },
      { name: "GTA 5", url: `${SITE_URL}/gta/wiki/gta-5` },
      { name: "Interactive map", url: canonical }
    ]),
    {
      "@type": "ItemList",
      name: "GTA 5 Story Mode map collections",
      numberOfItems: 11,
      itemListElement: GTA5_MAP_LAYERS.filter((layer) => layer.group !== "Places").map((layer, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: layer.label,
        url: `${SITE_URL}/gta/wiki/gta-5/${layer.slug}`
      }))
    }
  ];

  return (
    <div className="gta-map-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": structuredData }) }} />
      <Gta5InteractiveMap markers={markers}>
        <div id="article-body" itemProp="articleBody">
          <p>Choose a collection to plan a route, or search by item, location, or landmark. Select a pin for its location details and linked guide. The map covers GTA V Story Mode; GTA Online locations and later updates are outside this map.</p>
          <p>Completed locations use the same progress as the collection guides. Progress saves in this browser when signed out and syncs to your Bloxodes account when signed in. A stunt jump or flight still requires the right approach and the game’s completion message.</p>
          <p>For 100% Story Mode completion, you need all 50 spaceship parts and letter scraps, but only 25 of 50 stunt jumps, 25 of 50 Under the Bridge flights, and 8 of 15 knife flights. You can use the map to finish every challenge.</p>
          <h3>Collection guides</h3>
          <ul>
            {GTA5_MAP_LAYERS.map((layer) => (
              layer.group === "Places" ? null : <li key={layer.slug}><Link href={`/gta/wiki/gta-5/${layer.slug}`}>{layer.label} ↗</Link></li>
            ))}
          </ul>
          <h3>Map notes</h3>
          <p>Pins mark the location or start of each collectible or challenge. Flight and jump pins indicate the approach area; confirm completion in the game. Four Altruist Camp package entries share one area marker.</p>
          <p>Road and satellite tiles and selected, grouped place names are from <a href="https://github.com/rolux/gtadb.org" target="_blank" rel="noreferrer">GTADB contributors</a>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Collectible positions were matched to guide entries using the <a href="https://github.com/rootBrz/collectibles-on-map-gta-5/blob/main/src/collectibles/coords.h" target="_blank" rel="noreferrer">GTA V coordinate list</a>. GTA V is © Rockstar Games.</p>
        </div>
      </Gta5InteractiveMap>
    </div>
  );
}
