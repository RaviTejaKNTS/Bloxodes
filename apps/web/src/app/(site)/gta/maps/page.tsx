import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Map } from "lucide-react";
import { listGameMapPages } from "@/lib/game-extra-pages";
import { parseGameMapData } from "@/lib/game-page-data";
import { listGtaInteractiveMapDefinitions } from "@/lib/gta-interactive-map-registry";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 21600;

const title = "Interactive GTA Maps";
const description = "Browse zoomable Grand Theft Auto maps with searchable locations, collection progress, edition filters, and linked Bloxodes guides.";

type GtaMapCard = {
  slug: string;
  title: string;
  route: string;
  summary: string;
  count: string;
  modes: string[];
  preview: { type: "tiles"; images: string[] } | { type: "image"; src: string; width: number; height: number };
};

export const metadata: Metadata = {
  title: title + " | " + SITE_NAME,
  description,
  alternates: buildAlternates(SITE_URL + "/gta/maps"),
  openGraph: { type: "website", url: SITE_URL + "/gta/maps", title, description, siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title, description }
};

const GTA5_CARD: GtaMapCard = {
  slug: "gta5",
  title: "GTA V Story Mode",
  route: "/gta/maps/gta5",
  preview: {
    type: "tiles",
    images: [
      "/gta/maps/gta5/roadmap/0/0,1,1.jpg",
      "/gta/maps/gta5/roadmap/0/0,1,2.jpg",
      "/gta/maps/gta5/roadmap/0/0,2,1.jpg",
      "/gta/maps/gta5/roadmap/0/0,2,2.jpg"
    ]
  },
  summary: "Full San Andreas map with Story Mode collectibles, challenges, landmarks, progress tracking, and map styles.",
  count: "377 collection locations",
  modes: ["Story Mode"]
};

export default async function GtaMapsIndexPage() {
  const publishedMaps = await listGameMapPages("gta");
  const publishedSlugs = new Set(publishedMaps.map(page => page.slug));
  const cards: GtaMapCard[] = [
    ...(publishedSlugs.has("gta5") ? [GTA5_CARD] : []),
    ...listGtaInteractiveMapDefinitions()
      .filter((map) => publishedSlugs.has(map.slug))
      .map((map) => ({
        slug: map.slug,
        title: map.title,
        route: map.route,
        preview: { type: "image" as const, src: map.views[0].image, width: map.views[0].width, height: map.views[0].height },
        summary: map.summary,
        count: map.mappedPointCount.toLocaleString() + " map points",
        modes: map.modes.length ? map.modes.map((mode) => mode.label)
          : map.editionOptions.length ? map.editionOptions.map((edition) => edition.label)
          : map.views.map((view) => view.label)
      })),
    ...publishedMaps.filter(page => page.renderer_key === "image-pins").map(page => {
      const data = parseGameMapData(page.map_data);
      return { slug: page.slug, title: page.title, route: page.canonical_path,
        preview: { type: "image" as const, src: data.image, width: data.width, height: data.height },
        summary: page.meta_description ?? "Browse the map locations and linked guides.",
        count: `${data.markers.length.toLocaleString()} map points`, modes: [] };
    })
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted">
          <Map size={14} aria-hidden /> Interactive maps
        </div>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">Explore the Grand Theft Auto maps</h1>
        <p className="text-base leading-7 text-muted md:text-lg">{description} Open a map to search pins, switch layers, inspect item details, and mark supported collection locations complete.</p>
      </header>

      {cards.length ? (
        <section aria-label="Available GTA interactive maps" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.slug} href={card.route} className="group overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lg">
              <div className="relative aspect-[16/9] overflow-hidden bg-[#1a2430]">
                {card.preview.type === "tiles" ? (
                  <div role="img" aria-label={card.title + " full map preview"} className="absolute left-1/2 top-0 grid h-full aspect-square -translate-x-1/2 grid-cols-2 grid-rows-2">
                    {card.preview.images.map((tile) => (
                      <Image key={tile} src={tile} alt="" width={256} height={256} sizes="(max-width: 640px) 50vw, 256px" className="h-full w-full object-fill" />
                    ))}
                  </div>
                ) : (
                  <Image
                    src={card.preview.src}
                    alt={card.title + " map"}
                    width={card.preview.width}
                    height={card.preview.height}
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.025]"
                  />
                )}
                <span className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-black/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{card.count}</span>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-semibold leading-snug text-foreground">{card.title}</h2>
                  <ArrowUpRight size={18} className="mt-1 flex-none text-muted transition group-hover:text-accent" aria-hidden />
                </div>
                <p className="text-sm leading-6 text-muted">{card.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {card.modes.slice(0, 3).map((mode) => <span key={mode} className="rounded-md bg-background px-2.5 py-1 text-xs font-medium text-muted">{mode}</span>)}
                  {card.modes.length > 3 ? <span className="rounded-md bg-background px-2.5 py-1 text-xs font-medium text-muted">+{card.modes.length - 3} areas</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">Interactive maps will appear here as their pages are published.</p>
      )}

      <section className="max-w-3xl border-t border-border pt-6 text-sm leading-6 text-muted">
        <h2 className="text-lg font-semibold text-foreground">How map progress works</h2>
        <p className="mt-2">A map pin links to its Bloxodes collection item when the source location matches a tracked guide row. Checking a location on the map uses the same local or signed-in progress as that collection page. Reference points and seasonal coordinates stay informational, and collections without a verified source location are linked without invented pins.</p>
      </section>
    </div>
  );
}
