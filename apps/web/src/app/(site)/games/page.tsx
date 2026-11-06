import { listGameCards } from "@/lib/game-site-data";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { safeJsonLd, breadcrumbJsonLd, buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

const description = "Find game wikis, maps, checklists, tools and daily puzzles.";
const canonical = `${SITE_URL}/games`;
const ROW_SIZE = 4;

export const metadata: Metadata = {
  title: `Games | ${SITE_NAME}`,
  description,
  alternates: buildAlternates(canonical),
  openGraph: {
    title: `Games | ${SITE_NAME}`,
    description,
    url: canonical,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: `Games | ${SITE_NAME}`,
    description
  }
};

export default async function GamesPage() {
  const publishedPlatforms = [
    { href: "/wiki", label: "Roblox", image: "/images/games/roblox.webp" },
    ...(await listGameCards()).map(game => ({ href: game.href, label: game.title, image: game.image })),
    { href: "/puzzles", label: "Puzzles", image: "/images/games/puzzles.webp" }
  ];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: "Home", url: SITE_URL },
        { name: "Games", url: canonical }
      ]),
      {
        "@type": "CollectionPage",
        name: "Browse games on Bloxodes",
        description,
        url: canonical,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: publishedPlatforms.length,
          itemListElement: publishedPlatforms.map(({ href, label, image }, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: label,
            url: `${SITE_URL}${href}`,
            image: new URL(image, SITE_URL).toString()
          }))
        }
      }
    ]
  };

  // Each group fills whole rows at 1, 2 and 4 columns, so an ad between groups never splits a row.
  // The grid sits inside a plain wrapper: with the grid as the direct child, the ad audit found only 1 slot on the page.
  const rows = Array.from({ length: Math.ceil(publishedPlatforms.length / ROW_SIZE) }, (_, index) =>
    publishedPlatforms.slice(index * ROW_SIZE, (index + 1) * ROW_SIZE)
  );

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Games", href: null }]} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Browse games on Bloxodes</h1>
        <p className="max-w-2xl text-base leading-7 text-muted md:text-lg">{description}</p>
      </header>

      <section id="article-body" className="journey-content-stream gap-5" aria-label="Games and puzzles">
        {rows.map((row, rowIndex) => (
          <div key={row[0].href}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {row.map(({ href, label, image }, index) => (
              <Link
                key={href}
                href={href}
                data-journey-item
                className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                <Card className="relative aspect-[1200/675] overflow-hidden rounded-xl border-border/70 bg-card shadow-none transition-colors group-hover:border-accent/60">
                  <Image
                    src={image}
                    alt=""
                    width={1200}
                    height={675}
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    priority={rowIndex === 0 && index < ROW_SIZE}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" aria-hidden />
                  <h2 className="absolute inset-x-0 bottom-0 mb-0 px-4 pb-3 text-lg font-semibold leading-snug text-white">
                    {label}
                  </h2>
                </Card>
              </Link>
            ))}
            </div>
          </div>
        ))}
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }} />
    </div>
  );
}
